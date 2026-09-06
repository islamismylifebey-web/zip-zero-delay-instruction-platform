'use client';
import { useState } from 'react';
export default function HealthReviewButton({ feedbackId }: { feedbackId: string }) {
  const [state, setState] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');
  async function review() {
    if (state === 'saving' || state === 'done') return; setState('saving');
    try {
      const response = await fetch('/api/zip/feedback', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'review', feedbackId }) });
      if (!response.ok) throw new Error('review'); setState('done');
    } catch { setState('error'); }
  }
  return <><button type="button" onClick={review} disabled={state === 'saving' || state === 'done'}>{state === 'saving' ? 'Saving…' : state === 'done' ? 'Reviewed' : 'Mark reviewed'}</button>{state === 'error' && <span role="alert"> Could not save.</span>}</>;
}
