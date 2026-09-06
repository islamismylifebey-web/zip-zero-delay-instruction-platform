import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { getWorkspace, parseWorkspace, resolveAccess } from '@/lib/workspace-server';
import { handleOnboarding, type OnboardingDependencies } from '@/lib/zip/onboarding-handler.ts';
import { loadKnowledge, saveKnowledge } from '@/lib/zip/onboarding-store.ts';

export const dynamic = 'force-dynamic';
function dependencies(): OnboardingDependencies {
  return {
    async getSession() {
      const user = await getChatGPTUser();
      return user ? resolveAccess(user.email, user.displayName) : null;
    },
    async getWorkspace(ownerEmail) {
      const row = await getWorkspace(ownerEmail); if (!row) return null;
      const workspace = parseWorkspace(row.data);
      return { companyName: workspace.company.name, crew: workspace.crew, version: row.updatedAt };
    },
    load: (ownerEmail) => loadKnowledge(getD1(), ownerEmail),
    save: (ownerEmail, knowledge, version, workspaceVersion) => saveKnowledge(getD1(), ownerEmail, knowledge, version, workspaceVersion),
  };
}
export async function GET(request: Request) { return handleOnboarding(request, dependencies()); }
export async function POST(request: Request) { return handleOnboarding(request, dependencies()); }
