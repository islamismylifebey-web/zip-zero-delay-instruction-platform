import { requireChatGPTUser } from '../chatgpt-auth';
import WorkforceApp from '../workforce-app';

export const dynamic = 'force-dynamic';
export default async function OperationsPage() { const user = await requireChatGPTUser('/ops'); return <WorkforceApp ownerName={user.displayName} />; }
