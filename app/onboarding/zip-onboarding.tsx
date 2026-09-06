'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { completedProcedures, employeeIdentity, nextQuestion, ONBOARDING_QUESTIONS, targetAnswers, type AnswerValue, type CompanyKnowledge, type OnboardingTarget, type RosterMember } from '@/lib/zip/onboarding.ts';
import { resumeTarget, reviewAnswer } from '@/lib/zip/interview.ts';
import { useZipSpeech } from './use-zip-speech';

type Payload = { companyName: string; viewer: { role: string }; knowledge: CompanyKnowledge; crew: RosterMember[]; version: string | null };
const shell = { maxWidth: 900, margin: '0 auto', padding: '28px 18px 64px' } as const;
const card = { border: '1px solid #d7dce5', borderRadius: 18, padding: 22, background: '#fff', marginTop: 18 } as const;
const field = { width: '100%', border: '1px solid #b9c1cf', borderRadius: 10, padding: 12, font: 'inherit', boxSizing: 'border-box' as const, marginTop: 6 };
const button = { border: 0, borderRadius: 10, padding: '12px 16px', background: '#0B5FFF', color: '#fff', fontWeight: 700, cursor: 'pointer' } as const;
const secondary = { ...button, background: '#eef3ff', color: '#123' } as const;
const row = { display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginTop: 16 } as const;

export default function ZipOnboarding() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [target, setTarget] = useState<OnboardingTarget>('company'); const [subjectId, setSubjectId] = useState('');
  const [editField, setEditField] = useState(''); const [raw, setRaw] = useState(''); const [selected, setSelected] = useState<string[]>([]);
  const [none, setNone] = useState(false); const [review, setReview] = useState<AnswerValue | null>(null);
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false);
  const busyRef = useRef(false); const [voiceConsent, setVoiceConsent] = useState(false); const [speechLanguage, setSpeechLanguage] = useState('en-US');
  const speech = useZipSpeech();
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/zip/onboarding', { signal: controller.signal, cache: 'no-store' }).then(async (response) => {
      const data = await response.json() as Payload & { error?: string };
      if (!response.ok || data.viewer?.role !== 'owner' || !data.knowledge) throw new Error(data.error ?? 'Only the company owner can complete this interview.');
      if (controller.signal.aborted) return;
      setPayload(data); const resume = resumeTarget(data.knowledge, data.crew); setTarget(resume.target); setSubjectId(resume.subjectId);
    }).catch((failure) => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Setup could not load.'); });
    return () => controller.abort();
  }, []);
  function clearEditor() { speech.stop(); setRaw(''); setSelected([]); setNone(false); setReview(null); setEditField(''); setError(''); }
  async function save(change: Record<string, unknown>): Promise<Payload | null> {
    if (!payload || busyRef.current) return null;
    busyRef.current = true; setBusy(true); setError(''); speech.stop();
    try {
      const response = await fetch('/api/zip/onboarding', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...change, version: payload.version }) });
      const data = await response.json() as Payload & { saved?: boolean; error?: string };
      if (!response.ok || data.saved !== true) throw new Error(data.error ?? 'No save was confirmed.');
      setPayload(data); return data;
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'No save was confirmed.'); return null; }
    finally { busyRef.current = false; setBusy(false); }
  }
  async function refreshSaved() {
    if (busyRef.current) return;
    try {
      const response = await fetch('/api/zip/onboarding', { cache: 'no-store' }); const data = await response.json() as Payload & { error?: string };
      if (!response.ok || !data.knowledge) throw new Error(data.error ?? 'Reload failed.');
      if (question) setEditField(question.id); setPayload(data); setError(''); setNotice('Saved answers reloaded. Review your unsaved answer before confirming it.');
    } catch { setError('Saved answers could not be reloaded. Your unsaved answer is still on this page.'); }
  }
  async function addProcedure() {
    if (!payload) return; const existing = new Set(Object.keys(payload.knowledge.procedures));
    const data = await save({ action: 'add_procedure' }); if (!data) return;
    const id = Object.keys(data.knowledge.procedures).find((key) => !existing.has(key));
    if (id) { clearEditor(); setTarget('procedure'); setSubjectId(id); setNotice('New procedure started. Nothing is approved until you confirm each answer.'); }
  }
  async function beginEmployee(id: string) {
    if (!id) return; const data = await save({ action: 'begin_employee', subjectId: id });
    if (data) { clearEditor(); setTarget('employee'); setSubjectId(id); setNotice('Confirm this employee’s responsibilities and permissions.'); }
  }
  if (!payload) return <main style={shell}><h1>Set up ZIP for your company</h1><p role={error ? 'alert' : 'status'}>{error || 'Loading your company setup…'}</p><Link href="/">Return to ZIP</Link></main>;
  const answers = targetAnswers(payload.knowledge, target, subjectId) ?? {};
  const question = editField ? ONBOARDING_QUESTIONS[target].find((item) => item.id === editField) : nextQuestion(payload.knowledge, target, subjectId);
  const member = payload.crew.find((item) => item.id === subjectId);
  const employeeStarted = target !== 'employee' || (!!member && payload.knowledge.employees[subjectId]?.identity === employeeIdentity(member));
  const presets = completedProcedures(payload.knowledge);
  const title = target === 'company' ? payload.companyName : target === 'employee' ? member?.name ?? 'Employee profile' : String(answers.name?.value ?? 'New job procedure');
  const count = ONBOARDING_QUESTIONS[target].filter((item) => Object.hasOwn(answers, item.id)).length;
  const displayValue = (value: AnswerValue) => Array.isArray(value) ? value.length ? value.map((item) => presets.find((preset) => preset.id === item)?.name ?? item).join('\n') : 'None — explicitly confirmed' : value;
  function changeTarget(nextTarget: OnboardingTarget, id: string) { if (busyRef.current) return; clearEditor(); setTarget(nextTarget); setSubjectId(id); setNotice('Only confirmed answers are saved.'); }
  async function confirmAnswer() {
    if (!question || review === null) return;
    const data = await save({ action: 'confirm', target, subjectId, field: question.id, value: review, confirmed: true });
    if (data) { clearEditor(); setNotice('Answer confirmed and saved.'); }
  }
  function openReview() {
    if (!question) return; speech.stop();
    try { setReview(reviewAnswer(question, raw, selected, none)); setError(''); } catch (failure) { setError(failure instanceof Error ? failure.message : 'Please review this answer.'); }
  }
  return <main style={shell}>
    <header><strong style={{ fontSize: 26 }}>ZIP · Company setup</strong><p>Teach ZIP how your company works. One question, then your confirmation.</p><nav style={row}><Link href="/">Open ZIP</Link><Link href="/ops">Team and operations</Link><Link href="/ops">Pause interview</Link></nav></header>
    <p>Confirmed answers are saved as company knowledge, with your identity and confirmation time. Unconfirmed text stays on this page. Your statements are owner-confirmed, not independently verified credentials.</p>
    <section style={card} aria-label="Interview sections"><div style={row}>
      <button style={secondary} disabled={busy} onClick={() => changeTarget('company', '')}>Company</button>
      <label style={{ flex: 1, minWidth: 180 }}>Job procedure<select style={field} disabled={busy} value={target === 'procedure' ? subjectId : ''} onChange={(event) => { if (event.target.value) changeTarget('procedure', event.target.value); }}><option value="">Choose a procedure</option>{Object.entries(payload.knowledge.procedures).map(([id, record]) => <option key={id} value={id}>{String(record.answers.name?.value ?? 'Unfinished procedure')}</option>)}</select></label>
      <button style={secondary} disabled={busy} onClick={addProcedure}>Add procedure</button>
      <label style={{ flex: 1, minWidth: 180 }}>Employee<select style={field} disabled={busy} value={target === 'employee' ? subjectId : ''} onChange={(event) => { if (event.target.value) void beginEmployee(event.target.value); }}><option value="">Choose an employee</option>{payload.crew.map((entry) => <option key={entry.id} value={entry.id}>{entry.name} — {entry.role}</option>)}</select></label>
    </div>{payload.crew.length === 0 && <p><Link href="/ops">Add your real team in operations</Link>, then return here to confirm employee profiles.</p>}</section>
    <section style={card} aria-labelledby="zip-interview-title"><p>{count} of {ONBOARDING_QUESTIONS[target].length} answers confirmed</p><h1 id="zip-interview-title">{title}</h1>
      {!employeeStarted ? <><p>The employee’s current identity, responsibilities, and permissions need confirmation.</p><button style={button} disabled={busy || !member} onClick={() => void beginEmployee(subjectId)}>Start or reconfirm employee profile</button></> : question ? <>
        <h2>{question.prompt}</h2>{question.help && <p>{question.help}</p>}
        {target === 'employee' && question.id === 'training' && <p>Recorded requirements: {[...new Set(Object.values(payload.knowledge.procedures).flatMap((entry) => Array.isArray(entry.answers.requiredTraining?.value) ? entry.answers.requiredTraining.value : []))].join('; ') || 'No required training recorded yet.'}</p>}
        {review === null ? <>
          {question.kind === 'permissions' ? <fieldset disabled={busy}><legend>Explicitly permitted procedures</legend>{presets.length === 0 && <p>Complete a procedure before granting access.</p>}{presets.map((preset) => <label key={preset.id} style={{ display: 'block', padding: 8 }}><input type="checkbox" checked={selected.includes(preset.id)} disabled={none} onChange={(event) => setSelected((current) => event.target.checked ? [...current, preset.id] : current.filter((id) => id !== preset.id))} /> {preset.name}</label>)}</fieldset>
            : question.kind === 'select' ? <label>Your answer<select style={field} disabled={busy} value={raw} onChange={(event) => setRaw(event.target.value)}><option value="">Choose explicitly</option>{question.options?.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
            : <label>Your answer{question.kind === 'list' ? ' — one item per line' : ''}<textarea style={{ ...field, minHeight: 120 }} disabled={busy || none} value={raw} onChange={(event) => setRaw(event.target.value)} /></label>}
          {question.allowEmpty && <label style={{ display: 'block', marginTop: 12 }}><input type="checkbox" checked={none} disabled={busy || !!raw.trim() || selected.length > 0} onChange={(event) => setNone(event.target.checked)} /> I explicitly confirm none for this question.</label>}
          <details style={{ marginTop: 16 }}><summary>Voice input and read-aloud</summary><p>Your browser’s speech service may process audio remotely. ZIP does not record or save onboarding audio. Review the recognized text before confirming.</p><label><input type="checkbox" checked={voiceConsent} onChange={(event) => { setVoiceConsent(event.target.checked); if (!event.target.checked) speech.stop(); }} /> Allow microphone use for this interview.</label><label style={{ display: 'block', marginTop: 12 }}>Speech language<select style={field} value={speechLanguage} onChange={(event) => setSpeechLanguage(event.target.value)}><option value="en-US">English</option><option value="es-US">Spanish</option><option value="fr-FR">French</option></select></label><div style={row}><button style={secondary} disabled={busy} onClick={() => speech.speak(question.prompt)}>Hear question</button>{question.kind === 'text' || question.kind === 'list' ? <button style={secondary} disabled={busy || !voiceConsent || none} onClick={() => { if (speech.listening) speech.stop(); else { const prefix = raw.trim(); speech.capture((spoken) => setRaw([prefix, spoken].filter(Boolean).join(question.kind === 'list' ? '\n' : ' ')), speechLanguage); } }}>{speech.listening ? 'Stop microphone' : 'Speak answer'}</button> : null}</div></details>
          <div style={row}><button style={button} disabled={busy || speech.listening} onClick={openReview}>Review my answer</button></div>
        </> : <div><h3>Here is what ZIP will remember</h3><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', font: 'inherit', lineHeight: 1.6 }}>{displayValue(review)}</pre><p>This confirmed answer may be used in your company’s assignments. ZIP’s approval, safety, and respect rules still apply.</p><div style={row}><button style={secondary} disabled={busy} onClick={() => setReview(null)}>Correct answer</button><button style={secondary} disabled={busy} onClick={() => speech.speak(displayValue(review))}>Read answer aloud</button><button style={button} disabled={busy} onClick={confirmAnswer}>{busy ? 'Saving confirmation…' : 'Confirm and save'}</button></div></div>}
      </> : <><h2>This section is confirmed.</h2><p>Review saved answers below, add another procedure, or configure an employee. Assignments still require an authorized review before handoff.</p><div style={row}>{target === 'company' && <button style={button} disabled={busy} onClick={addProcedure}>Add a job procedure</button>}<Link href="/">Return to ZIP</Link></div></>}
    </section>
    {!!Object.keys(answers).length && <details style={card}><summary>Review or update confirmed answers</summary>{ONBOARDING_QUESTIONS[target].filter((item) => Object.hasOwn(answers, item.id)).map((item) => <div key={item.id} style={{ borderTop: '1px solid #ddd', padding: '16px 0' }}><strong>{item.prompt}</strong><p style={{ whiteSpace: 'pre-wrap' }}>{displayValue(answers[item.id].value)}</p><small>Confirmed by {answers[item.id].confirmedBy} · {answers[item.id].confirmedAt}</small><div style={row}><button style={secondary} disabled={busy} onClick={() => { clearEditor(); const value = answers[item.id].value; setEditField(item.id); if (item.kind === 'permissions') setSelected(value as string[]); else setRaw(Array.isArray(value) ? value.join('\n') : value); setNone(Array.isArray(value) && value.length === 0); }}>Edit and reconfirm</button></div></div>)}</details>}
    {speech.listening && <p role="status">Microphone is listening. Nothing is saved until you review and confirm.</p>}
    {speech.speechError && <p role="alert">{speech.speechError}</p>}
    {notice && <p role="status">{notice}</p>}
    {error && <div role="alert"><p>{error}</p><button style={secondary} disabled={busy} onClick={refreshSaved}>Reload saved answers</button></div>}
  </main>;
}

export function ZipCompanyWelcome({ email }: { email: string }) {
  const [name, setName] = useState(''); const [confirmed, setConfirmed] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const lock = useRef(false);
  async function create() {
    if (lock.current || !confirmed || name.trim().length < 2) return;
    lock.current = true; setBusy(true); setError('');
    try { const response = await fetch('/api/workspace', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'create_company', companyName: name.trim() }) }); const data = await response.json() as { error?: string }; if (!response.ok) throw new Error(data.error ?? 'Company creation was not confirmed.'); window.location.assign('/onboarding'); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Company creation failed.'); }
    finally { lock.current = false; setBusy(false); }
  }
  return <main style={shell}><h1>Set up ZIP for the right company</h1><p>Signed in as {email}.</p><section style={card}><h2>Joining an existing team?</h2><p>Ask your employer to add this exact email. Do not create a separate company.</p><button style={secondary} onClick={() => window.location.reload()}>Check my team access</button></section><section style={card}><h2>Company owner?</h2><p>Create your private workspace, then ZIP will guide you through your company rules and job procedures by voice or typing.</p><label>Company name<input style={field} value={name} maxLength={120} disabled={busy} onChange={(event) => setName(event.target.value)} /></label><p><label><input type="checkbox" checked={confirmed} disabled={busy} onChange={(event) => setConfirmed(event.target.checked)} /> I am authorized to create and manage this company.</label></p><button style={button} disabled={busy || !confirmed || name.trim().length < 2} onClick={create}>{busy ? 'Creating workspace…' : 'Create company and start interview'}</button></section>{error && <p role="alert">{error}</p>}<p><a href="/signout-with-chatgpt?return_to=/">Sign in with another account</a></p></main>;
}
