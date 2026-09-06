import { and, eq } from 'drizzle-orm';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getDb } from '@/db';
import { zipPendingDrafts } from '@/db/schema';
import { hasCompanyPermission } from '@/lib/company-access';
import { createApprovedJob, createPendingZipDraft } from '@/lib/zip/approval.ts';
import { readZipJson, zipRequestError } from '@/lib/zip/http.ts';
import { getWorkspace, parseWorkspace, resolveAccess, saveWorkspace } from '@/lib/workspace-server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Sign in required' }, { status: 401 });
  const access = await resolveAccess(user.email, user.displayName);
  if (!hasCompanyPermission(access.role, 'edit_tasks')) return Response.json({ error: 'Task editing access required' }, { status: 403 });
  let input: Record<string, unknown>;
  try { input = await readZipJson(request); } catch (error) { return zipRequestError(error); }
  const draftId = typeof input.draftId === 'string' ? input.draftId.trim() : '';
  if (!draftId || draftId.length > 128) return Response.json({ error: 'Valid draft ID required' }, { status: 400 });
  if (input.professionalAssignment !== undefined && (typeof input.professionalAssignment !== 'string' || !input.professionalAssignment.trim() || input.professionalAssignment.trim().length > 4000)) return Response.json({ error: 'Reviewed assignment must be 1–4,000 characters.' }, { status: 400 });

  const row = await getWorkspace(access.ownerEmail);
  if (!row) return Response.json({ error: 'Workspace not found' }, { status: 404 });
  const workspace = parseWorkspace(row.data);
  // The receipt survives pending-draft cleanup and a lost HTTP response.
  const existing = workspace.jobs.find((job) => job.zipDraftId === draftId);
  if (existing) return Response.json({ status: 'approved', jobId: existing.id, assigneeId: existing.assigneeId, updatedAt: row.updatedAt });

  const db = getDb();
  const ownedDraft = and(eq(zipPendingDrafts.draftId, draftId), eq(zipPendingDrafts.ownerEmail, access.ownerEmail));
  const [stored] = await db.select().from(zipPendingDrafts).where(ownedDraft).limit(1);
  if (!stored) return Response.json({ error: 'Draft not found. Create a new ZIP draft.' }, { status: 404 });
  if (stored.expiresAt <= new Date().toISOString()) return Response.json({ error: 'Draft expired. Create a new ZIP draft.' }, { status: 410 });
  if (!workspace.crew.some((member) => member.id === stored.assigneeId)) return Response.json({ error: 'Assigned employee is no longer available' }, { status: 409 });
  let checklist: string[];
  try {
    const parsed: unknown = JSON.parse(stored.checklistJson);
    if (!Array.isArray(parsed) || !parsed.every((item): item is string => typeof item === 'string')) throw new Error('invalid_checklist');
    checklist = parsed;
  } catch { return Response.json({ error: 'Stored draft is invalid. Create a new ZIP draft.' }, { status: 409 }); }
  const pending = createPendingZipDraft({ ...stored, checklist });
  const reviewed = typeof input.professionalAssignment === 'string' ? input.professionalAssignment.trim() : stored.professionalAssignment;
  let approved: ReturnType<typeof createApprovedJob>;
  try { approved = createApprovedJob(pending, reviewed, workspace.jobs.map((job) => job.id), new Date().toISOString()); }
  catch { return Response.json({ error: 'Reviewed assignment must be 1–4,000 characters.' }, { status: 400 }); }
  workspace.jobs.unshift(approved);
  const saved = await saveWorkspace(access.ownerEmail, workspace, row.updatedAt);
  if (!saved.ok) return saved.response;
  // Saving the job is the commit point. Cleanup failure must not report a failed assignment.
  try { await db.delete(zipPendingDrafts).where(ownedDraft); }
  catch { console.warn('zip_draft_cleanup_failed'); }
  return Response.json({ status: 'approved', jobId: approved.id, assigneeId: approved.assigneeId, updatedAt: saved.updatedAt });
}
