import { applyOnboardingChange, completedProcedures, emptyKnowledge, missingCompanyFields, OnboardingError, type CompanyKnowledge, type RosterMember } from './onboarding.ts';
import { MAX_KNOWLEDGE_BYTES, type KnowledgeSnapshot } from './onboarding-store.ts';
import { readZipJson, ZipRequestError } from './http.ts';

type Session = { email: string; ownerEmail: string; role: string; displayName: string };
type Workspace = { companyName: string; crew: RosterMember[]; version: string };
export type OnboardingDependencies = {
  getSession(): Promise<Session | null>;
  getWorkspace(ownerEmail: string): Promise<Workspace | null>;
  load(ownerEmail: string): Promise<KnowledgeSnapshot | null>;
  save(ownerEmail: string, knowledge: CompanyKnowledge, version: string | null, workspaceVersion: string): Promise<{ saved: boolean; version: string; updatedAt: string }>;
};
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store', vary: 'Cookie' } });
function payload(session: Session, workspace: Workspace, knowledge: CompanyKnowledge, version: string | null) {
  return {
    viewer: { role: session.role, email: session.email, displayName: session.displayName },
    companyName: workspace.companyName,
    companyReady: missingCompanyFields(knowledge).length === 0,
    presets: completedProcedures(knowledge), version,
    ...(session.role === 'owner' ? { knowledge, crew: workspace.crew } : {}),
  };
}
export async function handleOnboarding(request: Request, deps: OnboardingDependencies): Promise<Response> {
  try {
    const session = await deps.getSession();
    if (!session) return json({ error: 'Sign in required.' }, 401);
    const readable = ['owner', 'admin', 'manager', 'editor'].includes(session.role);
    if (!readable || !session.ownerEmail) return json({ error: 'Company setup access required.' }, 403);
    if (request.method !== 'GET' && request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
    if (request.method === 'POST' && session.role !== 'owner') return json({ error: 'Only the company owner can confirm company knowledge.' }, 403);
    const input = request.method === 'POST' ? await readZipJson(request) : null;
    const workspace = await deps.getWorkspace(session.ownerEmail);
    if (!workspace) return json({ error: 'Create your company workspace first.' }, 409);
    const saved = await deps.load(session.ownerEmail);
    const knowledge = saved?.knowledge ?? emptyKnowledge(crypto.randomUUID());
    if (!input) return json(payload(session, workspace, knowledge, saved?.version ?? null));
    if (!Object.hasOwn(input, 'version') || (input.version !== null && (typeof input.version !== 'string' || input.version.length > 128))) return json({ error: 'The current company setup version is required.' }, 400);
    if (input.version !== (saved?.version ?? null)) return json({ error: 'Company setup changed on another device. Reload saved answers before confirming.' }, 409);
    const next = applyOnboardingChange(knowledge, input, session, workspace.crew, new Date().toISOString());
    if (new TextEncoder().encode(JSON.stringify(next)).byteLength > MAX_KNOWLEDGE_BYTES) return json({ error: 'Company knowledge has reached its storage limit.' }, 413);
    const result = await deps.save(session.ownerEmail, next, saved?.version ?? null, workspace.version);
    if (!result.saved) return json({ error: 'Company or team details changed. Reload saved answers and try again.' }, 409);
    return json({ ...payload(session, workspace, next, result.version), saved: true });
  } catch (error) {
    if (error instanceof OnboardingError || error instanceof ZipRequestError) return json({ error: error.message }, error.status);
    return json({ error: 'Company setup storage is unavailable. No save was confirmed. Check the onboarding migration and retry.', code: 'onboarding_storage_unavailable' }, 503);
  }
}
