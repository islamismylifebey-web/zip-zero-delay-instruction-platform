'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import FeedbackClient from './feedback-client';

type JobOption = { id: string; task: string; status: string };

export default function CutoverFeedback() {
  const [jobs, setJobs] = useState<JobOption[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/zip/feedback', { signal: controller.signal, cache: 'no-store', credentials: 'include' }).then(async (response) => {
      if (!response.ok) throw new Error('Employee feedback access is unavailable.');
      const payload = await response.json() as { jobs?: JobOption[] };
      if (!controller.signal.aborted) setJobs(payload.jobs ?? []);
    }).catch((failure) => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Employee feedback access is unavailable.'); });
    return () => controller.abort();
  }, []);
  return <main style={{ maxWidth: 760, margin: '0 auto', padding: '28px 18px 64px' }}><Link href="/">← Back to my jobs</Link><h1>Tell ZIP what was unclear</h1><p>Use this to flag missing detail, a wrong location, or a training concern. The owner reviews these signals before company knowledge changes.</p>{error ? <p role="alert">{error}</p> : jobs === null ? <p role="status">Loading your ZIP assignments…</p> : <FeedbackClient jobs={jobs} />}</main>;
}
