import Link from 'next/link';
import { requireChatGPTUser } from '../chatgpt-auth';
import { resolveAccess } from '@/lib/workspace-server';
import ZipOnboarding from './zip-onboarding';
export const dynamic = 'force-dynamic';
export default async function OnboardingPage() {
  if (process.env.VERCEL === '1' || process.env.ZIP_FRONTEND_ONLY === '1') return <ZipOnboarding />;
  const user = await requireChatGPTUser('/onboarding');
  const access = await resolveAccess(user.email, user.displayName);
  if (access.role !== 'owner') return <main style={{ maxWidth: 800, padding: 24, margin: '0 auto' }}><h1>Owner confirmation required</h1><p>The full company interview belongs to the company owner. Employees cannot grant themselves job permissions or change company rules.</p><Link href="/">Return to your workspace</Link></main>;
  return <ZipOnboarding />;
}
