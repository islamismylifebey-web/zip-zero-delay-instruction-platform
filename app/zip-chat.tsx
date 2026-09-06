'use client';
import Link from 'next/link';
import { useEffect, useReducer, useRef, useState } from 'react';
import type { CrewMember, WorkspaceViewer } from './models';
import { initialZipUiState, zipUiReducer } from '@/lib/zip/ui-state.ts';
import { useZipSpeech } from './onboarding/use-zip-speech';

const shell = { maxWidth: 900, margin: '0 auto', padding: '28px 18px 64px' } as const;
const card = { border: '1px solid #d7dce5', borderRadius: 18, padding: 20, background: '#fff', boxShadow: '0 10px 30px rgba(15,23,42,.06)' } as const;
const field = { width: '100%', border: '1px solid #b9c1cf', borderRadius: 12, padding: '12px 14px', font: 'inherit', boxSizing: 'border-box' as const };
const primary = { border: 0, borderRadius: 12, padding: '12px 16px', fontWeight: 700, cursor: 'pointer', background: '#0B5FFF', color: '#fff' } as const;
const secondary = { ...primary, background: '#eef3ff', color: '#123' } as const;

export default function ZipChat({ ownerName, presets }: { ownerName: string; presets: Array<{ id: string; name: string }> }) {
  const [ui, dispatch] = useReducer(zipUiReducer, initialZipUiState);
  const [crew, setCrew] = useState<CrewMember[]>([]); const [viewer, setViewer] = useState<WorkspaceViewer | null>(null);
  const [employeeId, setEmployeeId] = useState(''); const [presetId, setPresetId] = useState(presets[0]?.id ?? '');
  const [input, setInput] = useState(''); const [clarification, setClarification] = useState(''); const [reviewText, setReviewText] = useState('');
  const rawRef = useRef(''); const busyRef = useRef(false); const speech = useZipSpeech();
  const editable = ['idle', 'listening', 'error', 'approved'].includes(ui.phase);
  const canDraft = viewer !== null && viewer.role !== 'employee' && viewer.role !== 'unassigned';
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/workspace', { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error('workspace');
      const payload = await response.json() as { workspace?: { crew?: CrewMember[] }; viewer: WorkspaceViewer };
      if (controller.signal.aborted) return;
      const nextCrew = payload.workspace?.crew ?? []; setCrew(nextCrew); setViewer(payload.viewer);
      if (nextCrew[0]) setEmployeeId(nextCrew[0].id);
    }).catch(() => { if (!controller.signal.aborted) dispatch({ type: 'ERROR', message: 'ZIP could not load the company workspace. Refresh this page to retry.' }); });
    return () => { controller.abort(); rawRef.current = ''; };
  }, []);
  async function requestDraft(rawInstruction: string, continuation = false) {
    if (busyRef.current || !canDraft || !employeeId || !presetId || !rawInstruction.trim()) return;
    if (rawInstruction.length > 2000) { setInput(rawInstruction); rawRef.current = ''; dispatch({ type: 'ERROR', message: 'Keep the instruction and clarification within 2,000 characters.' }); return; }
    busyRef.current = true; speech.stop(); dispatch({ type: 'DRAFT_START' });
    try {
      const response = await fetch('/api/zip/draft', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ employeeId, presetId, rawInstruction }) });
      const result = await response.json() as { status?: string; draftId?: string; professionalAssignment?: string; checklist?: string[]; clarifyingQuestion?: string; error?: string };
      if (!response.ok) throw new Error(result.error ?? 'ZIP could not create a grounded assignment. Try again.');
      if (result.status === 'needs_clarification' && result.clarifyingQuestion) {
        if (continuation) throw new Error('ZIP still needs context. Start a new instruction with the missing fact included.');
        setInput(''); setClarification(''); dispatch({ type: 'CLARIFY', question: result.clarifyingQuestion }); return;
      }
      if (result.status === 'ready' && result.draftId && result.professionalAssignment) {
        rawRef.current = ''; setInput(''); setClarification(''); setReviewText(result.professionalAssignment);
        dispatch({ type: 'REVIEW', draftId: result.draftId, professionalAssignment: result.professionalAssignment, checklist: result.checklist ?? [] }); return;
      }
      throw new Error(result.error ?? 'ZIP could not create a grounded assignment. Try again.');
    } catch (error) { rawRef.current = ''; setInput(rawInstruction); dispatch({ type: 'ERROR', message: error instanceof Error ? error.message : 'ZIP could not reach the drafting service.' }); }
    finally { busyRef.current = false; }
  }
  async function submitInitial() { const raw = input.trim(); if (busyRef.current || !raw) return; rawRef.current = raw; await requestDraft(raw); }
  async function submitClarification() { const answer = clarification.trim(); const original = rawRef.current; if (busyRef.current || !answer || !original) return; await requestDraft(`${original}\nClarification answer: ${answer}`, true); }
  async function approve() {
    if (busyRef.current || ui.phase !== 'review' || !ui.draftId || !reviewText.trim() || reviewText.trim().length > 4000) return;
    busyRef.current = true; dispatch({ type: 'APPROVE_START' });
    try {
      const response = await fetch('/api/zip/approve', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ draftId: ui.draftId, professionalAssignment: reviewText.trim() }) });
      const payload = await response.json() as { status?: string; error?: string };
      if (!response.ok || payload.status !== 'approved') throw new Error(payload.error ?? 'Approval was not confirmed. Retry this draft or check operations.');
      dispatch({ type: 'APPROVED' });
    } catch (error) { dispatch({ type: 'ERROR', message: error instanceof Error ? error.message : 'Approval was not confirmed. Retry this draft or check operations.' }); }
    finally { busyRef.current = false; }
  }
  function resetDraft() { if (busyRef.current) return; speech.stop(); rawRef.current = ''; setInput(''); setClarification(''); setReviewText(''); dispatch({ type: 'RESET' }); }
  return <main style={shell}>
    <header style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', marginBottom: 22, flexWrap: 'wrap' }}><div><strong style={{ fontSize: 24 }}>ZIP</strong><div>Say it. ZIP it. Get it done.</div></div><nav style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>{viewer?.role === 'owner' && <Link href="/onboarding">Company knowledge &amp; setup</Link>}<Link href="/ops">Open operations</Link></nav></header>
    <section style={card}><p style={{ marginTop: 0 }}>Signed in as <strong>{viewer?.displayName ?? ownerName}</strong>. ZIP uses owner-confirmed company knowledge and requires your approval before handoff.</p>
      {!viewer && !ui.error && <p role="status">Loading your company workspace…</p>}
      {canDraft && <div style={{ display: 'grid', gap: 14 }}>
        {crew.length === 0 && <p><Link href="/ops">Add your team in operations</Link>, then have the owner confirm employee profiles.</p>}
        {presets.length === 0 && <p>The company owner must confirm a job procedure in ZIP setup.</p>}
        <label>Employee<select style={field} disabled={!editable || speech.listening} value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}><option value="">Choose employee</option>{crew.map((member) => <option key={member.id} value={member.id}>{member.name} — {member.role}</option>)}</select></label>
        <label>Owner-confirmed job procedure<select style={field} disabled={!editable || speech.listening} value={presetId} onChange={(event) => setPresetId(event.target.value)}><option value="">Choose procedure</option>{presets.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}</select></label>
        {(ui.phase === 'idle' || ui.phase === 'listening' || ui.phase === 'error') && <><label>Instruction<textarea style={{ ...field, minHeight: 120 }} maxLength={2000} value={input} onChange={(event) => setInput(event.target.value)} placeholder="Tell ZIP what needs to get done." /></label><small>Voice uses your browser’s speech service, which may process audio remotely. Review the text before drafting.</small><div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}><button style={secondary} type="button" onClick={() => { if (speech.listening) speech.stop(); else { if (ui.phase === 'error') dispatch({ type: 'RESET' }); speech.capture(setInput, 'en-US'); } }}>{speech.listening ? 'Stop listening' : 'Speak'}</button><button style={primary} type="button" disabled={!employeeId || !presetId || !input.trim() || input.length > 2000 || speech.listening} onClick={submitInitial}>ZIP it</button></div></>}
        {ui.phase === 'drafting' && <p role="status" aria-live="polite">ZIP is preparing the assignment…</p>}
        {ui.phase === 'clarifying' && <div><p><strong>One fact is needed:</strong> {ui.clarifyingQuestion}</p><label>Answer<input style={field} maxLength={2000} value={clarification} onChange={(event) => setClarification(event.target.value)} /></label><button style={{ ...primary, marginTop: 10 }} disabled={!clarification.trim()} onClick={submitClarification}>Continue</button></div>}
        {(ui.phase === 'review' || ui.phase === 'approving') && <div><h2>Review before assignment</h2><label>Assignment text<textarea style={{ ...field, minHeight: 190 }} maxLength={4000} disabled={ui.phase === 'approving'} value={reviewText} onChange={(event) => setReviewText(event.target.value)} /></label>{ui.checklist.length > 0 && <><h3>Checklist</h3><ul>{ui.checklist.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul></>}<button style={primary} disabled={ui.phase === 'approving' || !reviewText.trim() || reviewText.trim().length > 4000} onClick={approve}>{ui.phase === 'approving' ? 'Approving…' : 'Approve and assign'}</button></div>}
        {(ui.phase === 'clarifying' || ui.phase === 'review') && <button style={secondary} onClick={resetDraft}>Start over</button>}
        {ui.phase === 'approved' && <div role="status"><h2>Assignment approved</h2><p>The reviewed assignment was added to the employee workflow. ZIP does not claim acknowledgement or completion.</p><div style={{ display: 'flex', gap: 12 }}><button style={secondary} onClick={resetDraft}>Create another</button><Link href="/ops">View operations</Link></div></div>}
      </div>}
      {speech.listening && <p role="status">Listening. Stop the microphone and review the text before choosing ZIP it.</p>}{speech.speechError && <p role="alert">{speech.speechError}</p>}{ui.error && <p role="alert">{ui.error}</p>}
    </section>
  </main>;
}
