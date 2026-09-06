import Link from 'next/link';
import { requireChatGPTUser } from './chatgpt-auth';
import WorkforceApp from './workforce-app';
import ZipChat from './zip-chat';
import ZipOnboarding, { ZipCompanyWelcome } from './onboarding/zip-onboarding';
import { getD1 } from '@/db';
import { getWorkspace, parseWorkspace, resolveAccess } from '@/lib/workspace-server';
import { compileKnowledge, completedProcedures, missingCompanyFields } from '@/lib/zip/onboarding.ts';
import { loadKnowledge } from '@/lib/zip/onboarding-store.ts';

export const dynamic = 'force-dynamic';
export default async function Home() {
  const user = await requireChatGPTUser('/');
  const access = await resolveAccess(user.email, user.displayName);
  if (access.role === 'employee') return <WorkforceApp ownerName={user.displayName} />;
  if (access.role === 'unassigned') return <ZipCompanyWelcome email={user.email} />;
  const row = await getWorkspace(access.ownerEmail);
  const snapshot = await loadKnowledge(getD1(), access.ownerEmail).catch(() => null);
  const workspace = row ? parseWorkspace(row.data) : null;
  const presets = snapshot ? completedProcedures(snapshot.knowledge) : [];
  const ready = !!snapshot && !!workspace && missingCompanyFields(snapshot.knowledge).length === 0 && presets.some((preset) => workspace.crew.some((member) => compileKnowledge(snapshot.knowledge, snapshot.version, workspace.company.name, workspace.crew, member.id, preset.id).ok));
  if (access.role === 'owner' && !ready) return <ZipOnboarding />;
  if (!snapshot || !ready) return <main style={{ padding: 24 }}><h1>Company setup needs owner confirmation</h1><p>Your owner must confirm company rules, a procedure, and at least one employee’s permissions before ZIP drafts assignments.</p><Link href="/ops">Continue to operations</Link></main>;
  return <ZipChat ownerName={user.displayName} presets={presets} />;
}
