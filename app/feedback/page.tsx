import Link from 'next/link';
import { requireChatGPTUser } from '../chatgpt-auth';
import { getWorkspace, parseWorkspace, resolveAccess } from '@/lib/workspace-server';
import FeedbackClient from './feedback-client';
import CutoverFeedback from './cutover-feedback';

export const dynamic = 'force-dynamic';
export default async function FeedbackPage() {
  if (process.env.VERCEL === '1' || process.env.ZIP_FRONTEND_ONLY === '1') return <CutoverFeedback />;
  const user = await requireChatGPTUser('/feedback');
  const access = await resolveAccess(user.email, user.displayName);
  if (access.role !== 'employee' || !access.crewId) return <main style={{ maxWidth: 760, margin: '0 auto', padding: 24 }}><h1>Employee feedback</h1><p>This page is for employees reviewing their own ZIP-generated assignments.</p><Link href="/">Return to ZIP</Link></main>;
  const row = await getWorkspace(access.ownerEmail); const workspace = row ? parseWorkspace(row.data) : null;
  const jobs = (workspace?.jobs ?? []).filter((job) => !!job.zipDraftId && (job.assigneeId === access.crewId || job.helperId === access.crewId)).map((job) => ({ id: job.id, task: job.task, status: job.status }));
  return <main style={{ maxWidth: 760, margin: '0 auto', padding: '28px 18px 64px' }}><Link href="/">← Back to my jobs</Link><h1>Tell ZIP what was unclear</h1><p>Use this to flag missing detail, a wrong location, or a training concern. The owner reviews these signals before company knowledge changes.</p><FeedbackClient jobs={jobs} /></main>;
}
