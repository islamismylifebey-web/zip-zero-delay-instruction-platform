'use client';

import { useEffect, useState } from 'react';
import type { WorkspaceViewer } from './models';
import WorkforceApp from './workforce-app';
import ZipChat from './zip-chat';
import ZipOnboarding, { ZipCompanyWelcome } from './onboarding/zip-onboarding';
import { zipApiUrl } from '@/lib/zip/api-origin.ts';

type Bootstrap = {
  authenticated: boolean;
  user: { displayName: string; email: string };
  viewer: WorkspaceViewer;
  ready: boolean;
  presets: Array<{ id: string; name: string }>;
  companyName?: string;
};

export default function CutoverHome() {
  const [data, setData] = useState<Bootstrap | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/session', { signal: controller.signal, cache: 'no-store', credentials: 'include' }).then(async (response) => {
      if (!response.ok) throw new Error(response.status === 401 ? 'signin' : 'session');
      const payload = await response.json() as Bootstrap;
      if (!controller.signal.aborted) setData(payload);
    }).catch((failure) => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'session'); });
    return () => controller.abort();
  }, []);

  if (error === 'signin') {
    const returnTo = typeof window === 'undefined' ? '/' : window.location.href;
    const loginUrl = zipApiUrl(`/api/session?return_to=${encodeURIComponent(returnTo)}`);
    return <main style={{ maxWidth: 720, margin: '0 auto', padding: 28 }}><h1>Sign in to ZIP</h1><p>Use your approved company email. Cloudflare Access will send your one-time sign-in code.</p><a href={loginUrl}>Continue to secure sign in</a></main>;
  }
  if (error) return <main style={{ maxWidth: 720, margin: '0 auto', padding: 28 }}><h1>ZIP cannot reach the company backend</h1><p>No company data was loaded. Refresh after the Cloudflare backend is available.</p></main>;
  if (!data) return <main style={{ maxWidth: 720, margin: '0 auto', padding: 28 }}><h1>ZIP</h1><p>Opening your secure company workspace…</p></main>;
  if (data.viewer.role === 'employee') return <WorkforceApp ownerName={data.user.displayName} />;
  if (data.viewer.role === 'unassigned') return <ZipCompanyWelcome email={data.user.email} />;
  if (data.viewer.role === 'owner' && !data.ready) return <ZipOnboarding />;
  if (!data.ready) return <main style={{ maxWidth: 760, margin: '0 auto', padding: 28 }}><h1>Company setup needs owner confirmation</h1><p>Your owner must confirm company rules, a procedure, and at least one employee’s permissions before ZIP drafts assignments.</p><a href="/ops">Continue to operations</a></main>;
  return <ZipChat ownerName={data.user.displayName} presets={data.presets} />;
}
