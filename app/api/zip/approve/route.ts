import { and, eq } from 'drizzle-orm';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getDb, getD1 } from '@/db';
import { zipPendingDrafts } from '@/db/schema';
import { hasCompanyPermission } from '@/lib/company-access';
import { createApprovedJob, createPendingZipDraft } from '@/lib/zip/approval.ts';
import { compileKnowledge } from '@/lib/zip/onboarding.ts';
import { loadKnowledge, writeGroundedWorkspace } from '@/lib/zip/onboarding-store.ts';
import { readZipJson, zipRequestError } from '@/lib/zip/http.ts';
import { getWorkspace, MAX_WORKSPACE_BYTES, parseWorkspace, resolveAccess, sanitizeWorkspace } from '@/lib/workspace-server';

export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  const user = await getChatGPTUser(); if (!user) return Response.json({ error: 'Sign in required' }, { status: 401 });
  const access = await resolveAccess(user.email, user.displayName);
  if (!hasCompanyPermission(access.role, 'edit_tasks')) return Response.json({ error: 'Task editing access required' }, { status: 403 });
  let input: Record<string, unknown>;
  try { input = await readZipJson(request); } catch (error) { return zipRequestError(error); }
  const draftId = typeof input.draftId === 'string' ? input.draftId.trim() : '';
  if (!draftId || draftId.length > 128) return Response.json({ error: 'Valid draft ID required' }, { status: 400 });
  if (input.professionalAssignment !== undefined && (typeof input.professionalAssignment !== 'string' || !input.professionalAssignment.trim() || input.professionalAssignment.trim().length > 4000)) return Response.json({ error: 'Reviewed assignment must be 1–4,000 characters.' }, { status: 400 });
  try {
    const row = await getWorkspace(access.ownerEmail); if (!row) return Response.json({ error: 'Workspace not found' }, { status: 404 });
    const workspace = parseWorkspace(row.data);
    const existing = workspace.jobs.find((job) => job.zipDraftId === draftId);
    if (existing) {
      if (typeof input.professionalAssignment === 'string' && input.professionalAssignment.trim() !== existing.task) return Response.json({ error: 'This draft was already assigned with different text. Review the saved job in operations.' }, { status: 409 });
      return Response.json({ status: 'approved', jobId: existing.id, assigneeId: existing.assigneeId, updatedAt: row.updatedAt });
    }
    const db = getDb(); const ownedDraft = and(eq(zipPendingDrafts.draftId, draftId), eq(zipPendingDrafts.ownerEmail, access.ownerEmail));
    const [stored] = await db.select().from(zipPendingDrafts).where(ownedDraft).limit(1);
    if (!stored) return Response.json({ error: 'Draft not found. Create a new ZIP draft.' }, { status: 404 });
    if (stored.expiresAt <= new Date().toISOString()) return Response.json({ error: 'Draft expired. Create a new ZIP draft.' }, { status: 410 });
    const snapshot = await loadKnowledge(getD1(), access.ownerEmail);
    if (!snapshot || !stored.knowledgeVersion || snapshot.version !== stored.knowledgeVersion) return Response.json({ error: 'Company knowledge changed or this draft predates onboarding. Create a new draft.' }, { status: 409 });
    const context = compileKnowledge(snapshot.knowledge, snapshot.version, workspace.company.name, workspace.crew, stored.assigneeId, stored.presetId);
    if (!context.ok) return Response.json({ error: context.message, code: context.code }, { status: 409 });
    let checklist: string[];
    try { const parsed: unknown = JSON.parse(stored.checklistJson); if (!Array.isArray(parsed) || !parsed.every((item): item is string => typeof item === 'string')) throw new Error('invalid_checklist'); checklist = parsed; }
    catch { return Response.json({ error: 'Stored draft is invalid. Create a new ZIP draft.' }, { status: 409 }); }
    const pending = createPendingZipDraft({ ...stored, checklist });
    const reviewed = typeof input.professionalAssignment === 'string' ? input.professionalAssignment.trim() : stored.professionalAssignment;
    const approved = createApprovedJob(pending, reviewed, workspace.jobs.map((job) => job.id), new Date().toISOString(), context.source.company.timeZone);
    workspace.jobs.unshift(approved);
    const data = JSON.stringify(sanitizeWorkspace(workspace));
    if (new TextEncoder().encode(data).byteLength > MAX_WORKSPACE_BYTES) return Response.json({ error: 'Workspace is too large. Archive older work before assigning more.' }, { status: 413 });
    const saved = await writeGroundedWorkspace(getD1(), access.ownerEmail, data, row.updatedAt, snapshot.version);
    if (!saved.saved) return Response.json({ error: 'Company knowledge or work changed before approval. Retry this draft; create a new one if company rules changed.' }, { status: 409 });
    try { await db.delete(zipPendingDrafts).where(ownedDraft); } catch { console.warn('zip_draft_cleanup_failed'); }
    return Response.json({ status: 'approved', jobId: approved.id, assigneeId: approved.assigneeId, updatedAt: saved.updatedAt }, { headers: { 'cache-control': 'no-store' } });
  } catch {
    return Response.json({ error: 'Approval was not confirmed. Retry the same draft or check operations.', code: 'approval_storage_unavailable' }, { status: 503 });
  }
}
