import { and, eq, lt } from 'drizzle-orm';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getDb, getD1 } from '@/db';
import { zipPendingDrafts } from '@/db/schema';
import { hasCompanyPermission } from '@/lib/company-access';
import { createPendingZipDraft } from '@/lib/zip/approval.ts';
import { createZipDraftService } from '@/lib/zip/draft-service.ts';
import { compileKnowledge } from '@/lib/zip/onboarding.ts';
import { loadKnowledge } from '@/lib/zip/onboarding-store.ts';
import { readZipJson, zipRequestError } from '@/lib/zip/http.ts';
import { createOpenAIProvider } from '@/lib/zip/provider.ts';
import { getWorkspace, parseWorkspace, resolveAccess } from '@/lib/workspace-server';

export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Sign in required' }, { status: 401 });
  const access = await resolveAccess(user.email, user.displayName);
  if (!hasCompanyPermission(access.role, 'edit_tasks')) return Response.json({ error: 'Task editing access required' }, { status: 403 });
  let input: Record<string, unknown>;
  try { input = await readZipJson(request); } catch (error) { return zipRequestError(error); }
  const employeeId = typeof input.employeeId === 'string' ? input.employeeId.trim() : '';
  const presetId = typeof input.presetId === 'string' ? input.presetId.trim() : '';
  const rawInstruction = typeof input.rawInstruction === 'string' ? input.rawInstruction.trim() : '';
  if (!employeeId || employeeId.length > 128 || !presetId || presetId.length > 128 || rawInstruction.length < 1 || rawInstruction.length > 2000) return Response.json({ error: 'Choose an employee and procedure, then enter a 1–2,000 character instruction.' }, { status: 400 });
  try {
    const row = await getWorkspace(access.ownerEmail);
    if (!row) return Response.json({ error: 'Workspace not found' }, { status: 404 });
    const workspace = parseWorkspace(row.data);
    const snapshot = await loadKnowledge(getD1(), access.ownerEmail);
    if (!snapshot) return Response.json({ error: 'The owner must complete ZIP company setup first.', code: 'company_setup_required' }, { status: 409 });
    const context = compileKnowledge(snapshot.knowledge, snapshot.version, workspace.company.name, workspace.crew, employeeId, presetId);
    if (!context.ok) return Response.json({ error: context.message, code: context.code }, { status: 409 });
    const apiKey = process.env.OPENAI_API_KEY?.trim() ?? '';
    if (!apiKey) return Response.json({ error: 'ZIP AI is not configured yet', code: 'provider_not_configured' }, { status: 503 });
    const service = createZipDraftService({ source: context.source, provider: createOpenAIProvider(apiKey), logger: (event) => console.info('zip_draft', event) });
    const result = await service.draft({ employeeId, presetId, rawInstruction });
    if (result.status !== 'ready') return Response.json(result, { status: result.status === 'temporarily_unavailable' ? 503 : 200 });
    // Recheck actor and context after the external model call. Approval checks them again.
    const currentAccess = await resolveAccess(user.email, user.displayName);
    const currentKnowledge = await loadKnowledge(getD1(), access.ownerEmail);
    if (currentAccess.ownerEmail !== access.ownerEmail || !hasCompanyPermission(currentAccess.role, 'edit_tasks')) return Response.json({ error: 'Company permissions changed. Sign in again.' }, { status: 403 });
    if (currentKnowledge?.version !== snapshot.version) return Response.json({ error: 'Company knowledge changed while drafting. Create a new draft.' }, { status: 409 });
    const now = new Date(); const createdAt = now.toISOString(); const expiresAt = new Date(now.getTime() + 15 * 60_000).toISOString();
    const pending = createPendingZipDraft({ draftId: result.draftId, ownerEmail: access.ownerEmail, assigneeId: employeeId, professionalAssignment: result.professionalAssignment, checklist: result.checklist, createdBy: access.email, createdAt, expiresAt });
    const db = getDb();
    await db.delete(zipPendingDrafts).where(and(eq(zipPendingDrafts.ownerEmail, access.ownerEmail), lt(zipPendingDrafts.expiresAt, createdAt)));
    await db.insert(zipPendingDrafts).values({ draftId: pending.draftId, ownerEmail: pending.ownerEmail, assigneeId: pending.assigneeId, professionalAssignment: pending.professionalAssignment, checklistJson: JSON.stringify(pending.checklist), createdBy: pending.createdBy, createdAt, expiresAt, knowledgeVersion: snapshot.version, presetId });
    return Response.json({ status: 'ready', draftId: pending.draftId, professionalAssignment: pending.professionalAssignment, checklist: pending.checklist }, { headers: { 'cache-control': 'no-store' } });
  } catch {
    return Response.json({ error: 'ZIP could not prepare the draft. Check company setup storage and try again.', code: 'draft_storage_unavailable' }, { status: 503 });
  }
}
