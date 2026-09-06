import { lt } from 'drizzle-orm';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getDb } from '@/db';
import { zipPendingDrafts } from '@/db/schema';
import { hasCompanyPermission } from '@/lib/company-access';
import { createPendingZipDraft } from '@/lib/zip/approval.ts';
import { createZipDraftService } from '@/lib/zip/draft-service.ts';
import { buildWorkspaceZipSource } from '@/lib/zip/fixtures.ts';
import { createOpenAIProvider } from '@/lib/zip/provider.ts';
import { getWorkspace, parseWorkspace, resolveAccess } from '@/lib/workspace-server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Sign in required' }, { status: 401 });
  const access = await resolveAccess(user.email, user.displayName);
  if (!hasCompanyPermission(access.role, 'edit_tasks')) return Response.json({ error: 'Task editing access required' }, { status: 403 });

  let input: { employeeId?: string; presetId?: string; rawInstruction?: string };
  try { input = await request.json() as typeof input; } catch { return Response.json({ error: 'Invalid request body' }, { status: 400 }); }
  const employeeId = String(input.employeeId ?? '').trim(); const presetId = String(input.presetId ?? '').trim(); const rawInstruction = String(input.rawInstruction ?? '').trim();
  if (!employeeId || !presetId || rawInstruction.length < 1 || rawInstruction.length > 2000) return Response.json({ error: 'Choose an employee and preset, then enter a 1–2,000 character instruction.' }, { status: 400 });

  const row = await getWorkspace(access.ownerEmail); if (!row) return Response.json({ error: 'Workspace not found' }, { status: 404 });
  const workspace = parseWorkspace(row.data); const employee = workspace.crew.find((member) => member.id === employeeId); if (!employee) return Response.json({ error: 'Employee not found in this company' }, { status: 404 });
  const apiKey = process.env.OPENAI_API_KEY?.trim() ?? ''; if (!apiKey) return Response.json({ error: 'ZIP AI is not configured yet', code: 'provider_not_configured' }, { status: 503 });

  const service = createZipDraftService({ source: buildWorkspaceZipSource(workspace.company.name, { id: employee.id, name: employee.name, role: employee.role }), provider: createOpenAIProvider(apiKey), logger: (event) => console.info('zip_draft', event) });
  const result = await service.draft({ employeeId, presetId, rawInstruction });
  if (result.status !== 'ready') return Response.json(result, { status: result.status === 'temporarily_unavailable' ? 503 : 200 });

  const now = new Date(); const createdAt = now.toISOString(); const expiresAt = new Date(now.getTime() + 15 * 60_000).toISOString();
  const pending = createPendingZipDraft({ draftId: result.draftId, ownerEmail: access.ownerEmail, assigneeId: employeeId, professionalAssignment: result.professionalAssignment, checklist: result.checklist, createdBy: access.email, createdAt, expiresAt });
  const db = getDb();
  await db.delete(zipPendingDrafts).where(lt(zipPendingDrafts.expiresAt, createdAt));
  await db.insert(zipPendingDrafts).values({ draftId: pending.draftId, ownerEmail: pending.ownerEmail, assigneeId: pending.assigneeId, professionalAssignment: pending.professionalAssignment, checklistJson: JSON.stringify(pending.checklist), createdBy: pending.createdBy, createdAt: pending.createdAt, expiresAt: pending.expiresAt });
  return Response.json({ status: 'ready', draftId: pending.draftId, professionalAssignment: pending.professionalAssignment, checklist: pending.checklist });
}
