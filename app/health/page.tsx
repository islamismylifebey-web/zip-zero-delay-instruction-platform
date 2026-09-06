import Link from 'next/link';
import { requireChatGPTUser } from '../chatgpt-auth';
import { getD1 } from '@/db';
import { buildKnowledgeHealth, describeKnowledgeChangeImpact, type EmployeeFeedback, type FeedbackSignal } from '@/lib/zip/durability.ts';
import { completedProcedures } from '@/lib/zip/onboarding.ts';
import { loadKnowledge } from '@/lib/zip/onboarding-store.ts';
import { getWorkspace, parseWorkspace, resolveAccess } from '@/lib/workspace-server';
import HealthReviewButton from './health-client';
import CutoverHealth from './cutover-health';

export const dynamic = 'force-dynamic';
const allowed = new Set<FeedbackSignal>(['clear', 'need_more_detail', 'wrong_location', 'not_trained']);
export default async function HealthPage() {
  if (process.env.VERCEL === '1' || process.env.ZIP_FRONTEND_ONLY === '1') return <CutoverHealth />;
  const user = await requireChatGPTUser('/health'); const access = await resolveAccess(user.email, user.displayName);
  if (access.role !== 'owner') return <main style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}><h1>ZIP knowledge health</h1><p>Only the company owner can review company knowledge health and employee feedback.</p><Link href="/">Return to ZIP</Link></main>;
  const row = await getWorkspace(access.ownerEmail); const snapshot = await loadKnowledge(getD1(), access.ownerEmail).catch(() => null);
  if (!row || !snapshot) return <main style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}><h1>ZIP knowledge health</h1><p>Finish company onboarding before ZIP can calculate knowledge health.</p><Link href="/onboarding">Continue onboarding</Link></main>;
  const workspace = parseWorkspace(row.data); const db = getD1();
  let feedbackRows: Array<{ id: string; job_id: string; employee_id: string; signal: string; detail: string; created_at: string }> = []; let pendingDrafts = 0;
  try {
    const feedback = await db.prepare('SELECT id, job_id, employee_id, signal, detail, created_at FROM zip_employee_feedback WHERE owner_email = ? AND reviewed_at IS NULL ORDER BY created_at DESC LIMIT 100').bind(access.ownerEmail).all<{ id: string; job_id: string; employee_id: string; signal: string; detail: string; created_at: string }>();
    feedbackRows = feedback.results ?? [];
    const pending = await db.prepare('SELECT COUNT(*) AS count FROM zip_pending_drafts WHERE owner_email = ? AND expires_at > ?').bind(access.ownerEmail, new Date().toISOString()).first<{ count: number }>(); pendingDrafts = Number(pending?.count ?? 0);
  } catch { /* Migration readiness is shown below instead of leaking database details. */ }
  const feedback: EmployeeFeedback[] = feedbackRows.filter((row) => allowed.has(row.signal as FeedbackSignal)).map((row) => ({ signal: row.signal as FeedbackSignal, jobId: row.job_id, employeeId: row.employee_id, detail: row.detail, createdAt: row.created_at }));
  const health = buildKnowledgeHealth(snapshot.knowledge, workspace.crew, feedback); const procedures = completedProcedures(snapshot.knowledge);
  return <main style={{ maxWidth: 1000, margin: '0 auto', padding: '28px 18px 64px' }}>
    <nav style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}><Link href="/">ZIP</Link><Link href="/onboarding">Company knowledge</Link><Link href="/ops">Operations</Link></nav>
    <h1>Company knowledge health</h1><p>ZIP is <strong>{health.ready ? 'ready with review items shown below' : 'blocked until the critical issues below are corrected'}</strong>.</p>
    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}><article><strong>{health.completedProcedures}</strong><p>complete procedures</p></article><article><strong>{health.confirmedEmployees}</strong><p>confirmed employee profiles</p></article><article><strong>{health.feedbackNeedingReview}</strong><p>employee signals to review</p></article><article><strong>{pendingDrafts}</strong><p>active pending drafts</p></article></section>
    <h2>Issues and review items</h2>{health.issues.length ? <ul>{health.issues.map((issue, index) => <li key={`${issue.code}-${issue.subjectId ?? ''}-${index}`}><strong>{issue.severity === 'blocker' ? 'BLOCKED' : 'REVIEW'}:</strong> {issue.message}</li>)}</ul> : <p>No deterministic knowledge issues are currently detected.</p>}
    <h2>Change impact</h2><p>These estimates tell you what a confirmed knowledge edit can affect before you make it. Any knowledge change causes current pending ZIP drafts to require a fresh draft.</p>
    <ul><li>{describeKnowledgeChangeImpact(snapshot.knowledge, 'company', '', 'company rules', workspace.crew, pendingDrafts).message}</li>{procedures.map((procedure) => <li key={procedure.id}><strong>{procedure.name}:</strong> {describeKnowledgeChangeImpact(snapshot.knowledge, 'procedure', procedure.id, 'this procedure', workspace.crew, pendingDrafts).message}</li>)}</ul>
    <h2>Employee feedback</h2><p>Feedback is evidence for owner review only. ZIP never rewrites company knowledge from these signals.</p>{feedbackRows.length ? <div style={{ display: 'grid', gap: 12 }}>{feedbackRows.map((row) => <article key={row.id} style={{ border: '1px solid #d7dce5', borderRadius: 12, padding: 14 }}><strong>{row.signal.replaceAll('_', ' ')}</strong><p>Job {row.job_id} · employee {row.employee_id}</p>{row.detail && <p>{row.detail}</p>}<HealthReviewButton feedbackId={row.id} /></article>)}</div> : <p>No unreviewed employee feedback.</p>}
    <p style={{ marginTop: 24 }}>ZIP uses conservative deterministic checks here. Absence of a warning does not prove every company rule is correct or complete.</p>
  </main>;
}
