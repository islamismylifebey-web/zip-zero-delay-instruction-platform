import { requireChatGPTUser } from './chatgpt-auth';
import WorkforceApp from './workforce-app';
import ZipChat from './zip-chat';
import { resolveAccess } from '@/lib/workspace-server';

export const dynamic = 'force-dynamic';
export default async function Home() {
  const user = await requireChatGPTUser('/');
  const access = await resolveAccess(user.email, user.displayName);
  if (access.role === 'employee' || access.role === 'unassigned') return <WorkforceApp ownerName={user.displayName} />;
  return <ZipChat ownerName={user.displayName} />;
}
