import { eq } from "drizzle-orm";
import type { CompanyProfile, CompanyRole, CrewMember, Job, MileageEntry, WorkspaceViewer } from "@/app/models";
import { getDb } from "@/db";
import { workspaceMembers, workspaceStates } from "@/db/schema";

export const MAX_WORKSPACE_BYTES = 5_000_000;
export type WorkspaceData = { company: CompanyProfile; jobs: Job[]; crew: CrewMember[]; mileage: MileageEntry[] };
export type WorkspaceAccess = WorkspaceViewer & { ownerEmail: string };
const memberRoles = new Set<CompanyRole>(["admin", "manager", "editor", "employee"]);

export function normalizeEmail(value: string) { return value.trim().toLowerCase(); }
export function normalizeMemberRole(value: unknown): CrewMember["accessLevel"] {
  return typeof value === "string" && memberRoles.has(value as CompanyRole) ? value as CrewMember["accessLevel"] : "employee";
}
export function parseWorkspace(data: string): WorkspaceData {
  const parsed = JSON.parse(data) as Partial<WorkspaceData>;
  const rawCrew = Array.isArray(parsed.crew) ? parsed.crew : [];
  const legacyDemoIds = new Set(rawCrew.filter((member) => /@example\.com$/i.test(member.email ?? "")).map((member) => member.id));
  const crew = rawCrew.filter((member) => !legacyDemoIds.has(member.id)).map((member) => ({ ...member, accessLevel: normalizeMemberRole(member.accessLevel) }));
  return {
    company: {
      name: typeof parsed.company?.name === "string" ? parsed.company.name : "",
      departments: Array.isArray(parsed.company?.departments) ? parsed.company.departments.filter((item): item is string => typeof item === "string") : [],
      defaultRole: normalizeMemberRole(parsed.company?.defaultRole),
      contactName: typeof parsed.company?.contactName === "string" ? parsed.company.contactName : "",
      contactEmail: typeof parsed.company?.contactEmail === "string" ? normalizeEmail(parsed.company.contactEmail) : "",
      contactPhone: typeof parsed.company?.contactPhone === "string" ? parsed.company.contactPhone : "",
      ...(parsed.company?.logoUpdatedAt ? { logoUpdatedAt: parsed.company.logoUpdatedAt } : {}),
    },
    jobs: (Array.isArray(parsed.jobs) ? parsed.jobs : []).filter((job) => !legacyDemoIds.has(job.assigneeId)),
    crew,
    mileage: (Array.isArray(parsed.mileage) ? parsed.mileage : []).filter((entry) => !legacyDemoIds.has(entry.crewId)),
  };
}
export async function resolveAccess(email: string, displayName: string): Promise<WorkspaceAccess> {
  const db = getDb(); const normalized = normalizeEmail(email);
  const [owned] = await db.select({ ownerEmail: workspaceStates.ownerEmail }).from(workspaceStates).where(eq(workspaceStates.ownerEmail, normalized)).limit(1);
  if (owned) return { role: "owner", email: normalized, displayName, ownerEmail: normalized };
  const [membership] = await db.select().from(workspaceMembers).where(eq(workspaceMembers.memberEmail, normalized)).limit(1);
  if (membership) return { role: normalizeMemberRole(membership.platformRole), email: normalized, displayName: membership.displayName || displayName, crewId: membership.crewId, ownerEmail: membership.ownerEmail };
  return { role: "unassigned", email: normalized, displayName, ownerEmail: "" };
}
export async function getWorkspace(ownerEmail: string) {
  const [row] = await getDb().select().from(workspaceStates).where(eq(workspaceStates.ownerEmail, ownerEmail)).limit(1); return row;
}
export async function saveWorkspace(ownerEmail: string, workspace: WorkspaceData) {
  const data = JSON.stringify(workspace);
  if (new TextEncoder().encode(data).byteLength > MAX_WORKSPACE_BYTES) return { ok: false as const, response: Response.json({ error: "Workspace is too large. Archive older completed work and try again." }, { status: 413 }) };
  const updatedAt = new Date().toISOString();
  await getDb().insert(workspaceStates).values({ ownerEmail, data, updatedAt }).onConflictDoUpdate({ target: workspaceStates.ownerEmail, set: { data, updatedAt } });
  return { ok: true as const, updatedAt };
}
export async function companyLogoKey(ownerEmail: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ownerEmail));
  return `company-logos/${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}
