import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { compileKnowledge, completedProcedures, missingCompanyFields } from '@/lib/zip/onboarding.ts';
import { loadKnowledge } from '@/lib/zip/onboarding-store.ts';
import { isAllowedZipOrigin } from '@/lib/zip/cors.ts';
import { getWorkspace, parseWorkspace, resolveAccess } from '@/lib/workspace-server';

export const dynamic = 'force-dynamic';

function safeFrontendReturn(value: string | null): string | null {
  if (!value) return null;
  let url: URL;
  try { url = new URL(value); } catch { return null; }
  return isAllowedZipOrigin(url.origin) ? url.toString() : null;
}

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ authenticated: false }, { status: 401, headers: { 'cache-control': 'no-store' } });

  const returnTo = safeFrontendReturn(new URL(request.url).searchParams.get('return_to'));
  if (returnTo) return Response.redirect(returnTo, 302);

  const access = await resolveAccess(user.email, user.displayName);
  if (access.role === 'unassigned') {
    return Response.json({ authenticated: true, user, viewer: access, ready: false, presets: [] }, { headers: { 'cache-control': 'no-store' } });
  }

  const row = await getWorkspace(access.ownerEmail);
  const workspace = row ? parseWorkspace(row.data) : null;
  const snapshot = await loadKnowledge(getD1(), access.ownerEmail).catch(() => null);
  const presets = snapshot ? completedProcedures(snapshot.knowledge) : [];
  const ready = !!snapshot && !!workspace && missingCompanyFields(snapshot.knowledge).length === 0 && presets.some((preset) => workspace.crew.some((member) => compileKnowledge(snapshot.knowledge, snapshot.version, workspace.company.name, workspace.crew, member.id, preset.id).ok));
  return Response.json({ authenticated: true, user, viewer: access, ready, presets, companyName: workspace?.company.name ?? '' }, { headers: { 'cache-control': 'no-store' } });
}
