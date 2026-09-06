import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { buildKnowledgeHealth, describeKnowledgeChangeImpact, type EmployeeFeedback, type FeedbackSignal } from '@/lib/zip/durability.ts';
import { completedProcedures } from '@/lib/zip/onboarding.ts';
import { loadKnowledge } from '@/lib/zip/onboarding-store.ts';
import { getWorkspace, parseWorkspace, resolveAccess } from '@/lib/workspace-server';

export const dynamic = 'force-dynamic';
const allowed = new Set<FeedbackSignal>(['clear', 'need_more_detail', 'wrong_location', 'not_trained']);
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return json({ error: 'Sign in required.' }, 401);
  const access = await resolveAccess(user.email, user.displayName);
  if (access.role !== 'owner') return json({ error: 'Only the company owner can review knowledge health.' }, 403);
  const row = await getWorkspace(access.ownerEmail);
  const snapshot = await loadKnowledge(getD1(), access.ownerEmail).catch(() => null);
  if (!row || !snapshot) return json({ ready: false, setupRequired: true, issues: [], feedback: [], impacts: [], metrics: { completedProcedures: 0, confirmedEmployees: 0, feedbackNeedingReview: 0, pendingDrafts: 0 } });
  const workspace = parseWorkspace(row.data); const db = getD1();
  let feedbackRows: Array<{ id: string; job_id: string; employee_id: string; signal: string; detail: string; created_at: string }> = []; let pendingDrafts = 0;
  try {
    const feedback = await db.prepare('SELECT id, job_id, employee_id, signal, detail, created_at FROM zip_employee_feedback WHERE owner_email = ? AND reviewed_at IS NULL ORDER BY created_at DESC LIMIT 100').bind(access.ownerEmail).all<{ id: string; job_id: string; employee_id: string; signal: string; detail: string; created_at: string }>();
    feedbackRows = feedback.results ?? [];
    const pending = await db.prepare('SELECT COUNT(*) AS count FROM zip_pending_drafts WHERE owner_email = ? AND expires_at > ?').bind(access.ownerEmail, new Date().toISOString()).first<{ count: number }>();
    pendingDrafts = Number(pending?.count ?? 0);
  } catch { /* migration readiness remains visible through missing records */ }
  const feedback: EmployeeFeedback[] = feedbackRows.filter((row) => allowed.has(row.signal as FeedbackSignal)).map((row) => ({ signal: row.signal as FeedbackSignal, jobId: row.job_id, employeeId: row.employee_id, detail: row.detail, createdAt: row.created_at }));
  const health = buildKnowledgeHealth(snapshot.knowledge, workspace.crew, feedback); const procedures = completedProcedures(snapshot.knowledge);
  const impacts = [{ id: 'company', name: 'Company rules', message: describeKnowledgeChangeImpact(snapshot.knowledge, 'company', '', 'company rules', workspace.crew, pendingDrafts).message }, ...procedures.map((procedure) => ({ id: procedure.id, name: procedure.name, message: describeKnowledgeChangeImpact(snapshot.knowledge, 'procedure', procedure.id, 'this procedure', workspace.crew, pendingDrafts).message }))];
  return json({ ready: health.ready, setupRequired: false, issues: health.issues, impacts, feedback: feedbackRows, metrics: { completedProcedures: health.completedProcedures, confirmedEmployees: health.confirmedEmployees, feedbackNeedingReview: health.feedbackNeedingReview, pendingDrafts } });
}
