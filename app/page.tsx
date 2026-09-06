import Link from 'next/link';
import { requireChatGPTUser } from './chatgpt-auth';
import WorkforceApp from './workforce-app';
import ZipChat from './zip-chat';
import ZipOnboarding, { ZipCompanyWelcome } from './onboarding/zip-onboarding';
import CutoverHome from './cutover-home';
import { getD1 } from '@/db';
import { getWorkspace, parseWorkspace, resolveAccess } from '@/lib/workspace-server';
import { compileKnowledge, completedProcedures, missingCompanyFields } from '@/lib/zip/onboarding.ts';
import { loadKnowledge } from '@/lib/zip/onboarding-store.ts';

export const dynamic = 'force-dynamic';
export default async function Home() {
  if (process.env.VERCEL === '1' || process.env.ZIP_FRONTEND_ONLY === '1') return <CutoverHome />;
  const user = await requireChatGPTUser('/');
  const access = await resolveAccess(user.email, user.displayName);
  if (access.role === 'employee') return <><WorkforceApp ownerName={user.displayName} /><aside style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 20, background: '#fff', border: '1px solid #d7dce5', borderRadius: 12, padding: '10px 12px', boxShadow: '0 8px 24px rgba(15,23,42,.12)' }}><Link href="/feedback">Tell ZIP what was unclear</Link></aside></>;
  if (access.role === 'unassigned') return <ZipCompanyWelcome email={user.email} />;
  const row = await getWorkspace(access.ownerEmail);
  const snapshot = await loadKnowledge(getD1(), access.ownerEmail).catch(() => null);
  const workspace = row ? parseWorkspace(row.data) : null;
  const presets = snapshot ? completedProcedures(snapshot.knowledge) : [];
  const ready = !!snapshot && !!workspace && missingCompanyFields(snapshot.knowledge).length === 0 && presets.some((preset) => workspace.crew.some((member) => compileKnowledge(snapshot.knowledge, snapshot.version, workspace.company.name, workspace.crew, member.id, preset.id).ok));
  if (access.role === 'owner' && !ready) return <><ZipOnboarding /><aside style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 20, background: '#fff', border: '1px solid #d7dce5', borderRadius: 12, padding: '10px 12px' }}><Link href="/health">Knowledge health</Link></aside></>;
  if (!snapshot || !ready) return <main style={{ padding: 24 }}><h1>Company setup needs owner confirmation</h1><p>Your owner must confirm company rules, a procedure, and at least one employee’s permissions before ZIP drafts assignments.</p><Link href="/ops">Continue to operations</Link></main>;
  return <><ZipChat ownerName={user.displayName} presets={presets} />{access.role === 'owner' && <aside style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 20, background: '#fff', border: '1px solid #d7dce5', borderRadius: 12, padding: '10px 12px', boxShadow: '0 8px 24px rgba(15,23,42,.12)' }}><Link href="/health">Knowledge health</Link></aside>}</>;
}
