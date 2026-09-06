'use client';
import { useState } from 'react';

type JobOption = { id: string; task: string; status: string };
type Signal = 'clear' | 'need_more_detail' | 'wrong_location' | 'not_trained';
const labels: Array<[Signal, string]> = [
  ['clear', 'Clear'],
  ['need_more_detail', 'Need more detail'],
  ['wrong_location', 'Wrong location'],
  ['not_trained', 'I am not trained for this'],
];
export default function FeedbackClient({ jobs }: { jobs: JobOption[] }) {
  const [jobId, setJobId] = useState(jobs[0]?.id ?? ''); const [signal, setSignal] = useState<Signal>('clear');
  const [detail, setDetail] = useState(''); const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  async function submit() {
    if (!jobId || state === 'saving') return; setState('saving');
    try {
      const response = await fetch('/api/zip/feedback', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jobId, signal, detail }) });
      if (!response.ok) throw new Error('save'); setState('saved');
    } catch { setState('error'); }
  }
  if (!jobs.length) return <p>No ZIP-generated assignments are available for feedback.</p>;
  return <section style={{ display: 'grid', gap: 16 }}>
    <label>Assignment<select value={jobId} onChange={(event) => { setJobId(event.target.value); setState('idle'); }} style={{ display: 'block', width: '100%', padding: 10, marginTop: 6 }}>{jobs.map((job) => <option key={job.id} value={job.id}>{job.id} — {job.task.slice(0, 90)}</option>)}</select></label>
    <fieldset><legend>How clear was ZIP?</legend>{labels.map(([value, label]) => <label key={value} style={{ display: 'block', padding: '7px 0' }}><input type="radio" name="signal" value={value} checked={signal === value} onChange={() => { setSignal(value); setState('idle'); }} /> {label}</label>)}</fieldset>
    <label>Optional detail<textarea value={detail} maxLength={500} onChange={(event) => { setDetail(event.target.value); setState('idle'); }} placeholder="Tell the owner what needs correction." style={{ display: 'block', width: '100%', minHeight: 100, marginTop: 6 }} /></label>
    <p style={{ margin: 0 }}>Your feedback alerts the company owner. It does not change company rules, permissions, training records, or the assignment automatically.</p>
    <button type="button" onClick={submit} disabled={state === 'saving'} style={{ padding: '11px 16px', fontWeight: 700 }}>{state === 'saving' ? 'Saving…' : 'Send feedback'}</button>
    {state === 'saved' && <p role="status">Feedback saved for owner review.</p>}{state === 'error' && <p role="alert">Feedback could not be saved. Try again.</p>}
  </section>;
}
