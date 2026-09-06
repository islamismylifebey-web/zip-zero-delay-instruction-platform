'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import HealthReviewButton from './health-client';

type HealthPayload = {
  ready: boolean;
  setupRequired: boolean;
  issues: Array<{ code: string; severity: string; message: string; subjectId?: string }>;
  impacts: Array<{ id: string; name: string; message: string }>;
  feedback: Array<{ id: string; job_id: string; employee_id: string; signal: string; detail: string; created_at: string }>;
  metrics: { completedProcedures: number; confirmedEmployees: number; feedbackNeedingReview: number; pendingDrafts: number };
};

export default function CutoverHealth() {
  const [data, setData] = useState<HealthPayload | null>(null); const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/zip/health', { signal: controller.signal, cache: 'no-store', credentials: 'include' }).then(async (response) => {
      if (!response.ok) throw new Error('Knowledge health is unavailable for this account.');
      const payload = await response.json() as HealthPayload;
      if (!controller.signal.aborted) setData(payload);
    }).catch((failure) => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Knowledge health is unavailable.'); });
    return () => controller.abort();
  }, []);
  if (error) return <main style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}><h1>ZIP knowledge health</h1><p role="alert">{error}</p><Link href="/">Return to ZIP</Link></main>;
  if (!data) return <main style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}><h1>ZIP knowledge health</h1><p>Loading owner-confirmed company knowledge…</p></main>;
  if (data.setupRequired) return <main style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}><h1>ZIP knowledge health</h1><p>Finish company onboarding before ZIP can calculate knowledge health.</p><Link href="/onboarding">Continue onboarding</Link></main>;
  return <main style={{ maxWidth: 1000, margin: '0 auto', padding: '28px 18px 64px' }}>
    <nav style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}><Link href="/">ZIP</Link><Link href="/onboarding">Company knowledge</Link><Link href="/ops">Operations</Link></nav>
    <h1>Company knowledge health</h1><p>ZIP is <strong>{data.ready ? 'ready with review items shown below' : 'blocked until the critical issues below are corrected'}</strong>.</p>
    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}><article><strong>{data.metrics.completedProcedures}</strong><p>complete procedures</p></article><article><strong>{data.metrics.confirmedEmployees}</strong><p>confirmed employee profiles</p></article><article><strong>{data.metrics.feedbackNeedingReview}</strong><p>employee signals to review</p></article><article><strong>{data.metrics.pendingDrafts}</strong><p>active pending drafts</p></article></section>
    <h2>Issues and review items</h2>{data.issues.length ? <ul>{data.issues.map((issue, index) => <li key={`${issue.code}-${issue.subjectId ?? ''}-${index}`}><strong>{issue.severity === 'blocker' ? 'BLOCKED' : 'REVIEW'}:</strong> {issue.message}</li>)}</ul> : <p>No deterministic knowledge issues are currently detected.</p>}
    <h2>Change impact</h2><p>Any confirmed knowledge change causes current pending ZIP drafts to require a fresh draft.</p><ul>{data.impacts.map((impact) => <li key={impact.id}><strong>{impact.name}:</strong> {impact.message}</li>)}</ul>
    <h2>Employee feedback</h2><p>Feedback is evidence for owner review only. ZIP never rewrites company knowledge from these signals.</p>{data.feedback.length ? <div style={{ display: 'grid', gap: 12 }}>{data.feedback.map((row) => <article key={row.id} style={{ border: '1px solid #d7dce5', borderRadius: 12, padding: 14 }}><strong>{row.signal.replaceAll('_', ' ')}</strong><p>Job {row.job_id} · employee {row.employee_id}</p>{row.detail && <p>{row.detail}</p>}<HealthReviewButton feedbackId={row.id} /></article>)}</div> : <p>No unreviewed employee feedback.</p>}
    <p style={{ marginTop: 24 }}>ZIP uses conservative deterministic checks here. Absence of a warning does not prove every company rule is correct or complete.</p>
  </main>;
}
