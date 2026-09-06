'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import AccountActions from './account-actions';

type Session = { user: { email: string }; contact: { companyName: string; name: string; email: string; phone: string } | null };
const phoneHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;
export default function CutoverAccount() {
  const [session, setSession] = useState<Session | null>(null); const [error, setError] = useState('');
  useEffect(() => { const controller = new AbortController(); fetch('/api/session', { signal: controller.signal, cache: 'no-store', credentials: 'include' }).then(async (response) => { if (!response.ok) throw new Error('Account session unavailable.'); const data = await response.json() as Session; if (!controller.signal.aborted) setSession(data); }).catch((failure) => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Account session unavailable.'); }); return () => controller.abort(); }, []);
  if (error) return <main className="legal-page"><article><h1>Account &amp; Data</h1><p role="alert">{error}</p><Link href="/">Return to ZIP</Link></article></main>;
  if (!session) return <main className="legal-page"><article><h1>Account &amp; Data</h1><p>Loading secure account details…</p></article></main>;
  const contact = session.contact;
  return <main className="legal-page"><header><Link href="/" className="legal-brand">Speak. Assign. Done.</Link><span>{contact?.companyName ?? 'Account & Data'}</span></header><article><Link href="/" className="legal-back">← Back to app</Link><span className="eyebrow">Signed in securely</span><h1>Control your information</h1><p>You are signed in as <strong>{session.user.email}</strong>.</p><h2>Delete application data</h2><p>For a company owner, deletion permanently removes the workspace, team access, jobs, messages, and mileage. For an employee, deletion disconnects that login and removes direct contact information while keeping anonymized business records.</p><AccountActions /><h2>Need help first?</h2>{contact ? <p>Contact <strong>{contact.name}</strong>{contact.email ? <> at <a href={`mailto:${contact.email}`}>{contact.email}</a></> : null}{contact.phone ? <> or <a href={phoneHref(contact.phone)}>{contact.phone}</a></> : null}. The owner manages these details in Company settings.</p> : <p>Ask your company owner or administrator to connect your sign-in email to the correct workspace.</p>}</article><footer><Link href="/">Return to app</Link><Link href="/privacy">Privacy Policy</Link><Link href="/terms">Terms of Use</Link></footer></main>;
}
