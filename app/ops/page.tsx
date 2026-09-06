import { requireChatGPTUser } from '../chatgpt-auth';
import WorkforceApp from '../workforce-app';

export const dynamic = 'force-dynamic';
export default async function OperationsPage() {
  if (process.env.VERCEL === '1' || process.env.ZIP_FRONTEND_ONLY === '1') return <WorkforceApp ownerName="ZIP" />;
  const user = await requireChatGPTUser('/ops');
  return <WorkforceApp ownerName={user.displayName} />;
}
