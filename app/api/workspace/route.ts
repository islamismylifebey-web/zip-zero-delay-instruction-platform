import { eq } from "drizzle-orm";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import type { CompanyProfile, CrewMember, JobMessage, JobStatus, MileageEntry, WorkspaceViewer } from "@/app/models";
import { getDb } from "@/db";
import { workspaceMembers, workspaceStates } from "@/db/schema";
import { hasCompanyPermission } from "@/lib/company-access";
import { getWorkspace, normalizeEmail, normalizeMemberRole, parseWorkspace, resolveAccess, saveWorkspace, type WorkspaceData } from "@/lib/workspace-server";

function workerWorkspace(workspace: WorkspaceData, crewId: string): WorkspaceData { return { company: workspace.company, jobs: workspace.jobs.filter((job) => job.assigneeId === crewId || job.helperId === crewId), crew: workspace.crew.map((member) => ({ ...member, email: member.id === crewId ? member.email : "", phone: member.id === crewId ? member.phone : "" })), mileage: workspace.mileage.filter((entry) => entry.crewId === crewId) }; }
function normalizeCompany(input: Partial<CompanyProfile> | undefined, fallback: CompanyProfile): CompanyProfile {
  return {
    name: input?.name?.trim().slice(0, 120) || fallback.name,
    departments: Array.isArray(input?.departments) ? input.departments.map(String).map((item) => item.trim()).filter(Boolean).slice(0, 100) : fallback.departments,
    defaultRole: normalizeMemberRole(input?.defaultRole ?? fallback.defaultRole),
    contactName: String(input?.contactName ?? fallback.contactName).trim().slice(0, 120),
    contactEmail: normalizeEmail(String(input?.contactEmail ?? fallback.contactEmail)).slice(0, 254),
    contactPhone: String(input?.contactPhone ?? fallback.contactPhone).trim().slice(0, 80),
    ...(input?.logoUpdatedAt ?? fallback.logoUpdatedAt ? { logoUpdatedAt: String(input?.logoUpdatedAt ?? fallback.logoUpdatedAt) } : {}),
  };
}
function normalizeCrew(input: CrewMember[]) {
  const seen = new Set<string>();
  return input.map((member) => ({ ...member, name: String(member.name ?? "").trim().slice(0, 120), role: String(member.role ?? "Employee").trim().slice(0, 120), email: normalizeEmail(member.email ?? ""), phone: String(member.phone ?? "").trim().slice(0, 80), accessLevel: normalizeMemberRole(member.accessLevel) })).filter((member) => { if (!member.id || !member.name || !member.email || seen.has(member.email)) return false; seen.add(member.email); return true; });
}
async function syncMemberships(ownerEmail: string, crew: CrewMember[]) {
  const db = getDb(); await db.delete(workspaceMembers).where(eq(workspaceMembers.ownerEmail, ownerEmail)); const conflicts: string[] = [];
  for (const member of crew) {
    if (!member.email || member.email === ownerEmail) continue;
    const [existing] = await db.select().from(workspaceMembers).where(eq(workspaceMembers.memberEmail, member.email)).limit(1);
    if (existing && existing.ownerEmail !== ownerEmail) { conflicts.push(member.email); continue; }
    await db.insert(workspaceMembers).values({ memberEmail: member.email, ownerEmail, crewId: member.id, displayName: member.name, platformRole: member.accessLevel }).onConflictDoUpdate({ target: workspaceMembers.memberEmail, set: { ownerEmail, crewId: member.id, displayName: member.name, platformRole: member.accessLevel } });
  }
  return conflicts;
}
export async function GET() {
  const user = await getChatGPTUser(); if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const access = await resolveAccess(user.email, user.displayName); const viewer: WorkspaceViewer = { role: access.role, email: access.email, displayName: access.displayName, ...(access.crewId ? { crewId: access.crewId } : {}) };
  if (access.role === "unassigned") return Response.json({ workspace: null, viewer }); const row = await getWorkspace(access.ownerEmail); if (!row) return Response.json({ workspace: null, viewer }); const workspace = parseWorkspace(row.data);
  return Response.json({ workspace: access.role === "employee" && access.crewId ? workerWorkspace(workspace, access.crewId) : workspace, viewer, updatedAt: row.updatedAt });
}
export async function POST(request: Request) {
  const user = await getChatGPTUser(); if (!user) return Response.json({ error: "Sign in required" }, { status: 401 }); const access = await resolveAccess(user.email, user.displayName);
  if (access.role !== "unassigned") return Response.json({ error: "This account is already connected to a company" }, { status: 409 });
  const input = await request.json() as { action?: string; companyName?: string }; const companyName = input.companyName?.trim().slice(0, 120) ?? "";
  if (input.action !== "create_company" || companyName.length < 2) return Response.json({ error: "Enter a company name" }, { status: 400 });
  const workspace: WorkspaceData = { company: { name: companyName, departments: [], defaultRole: "employee", contactName: user.displayName, contactEmail: normalizeEmail(user.email), contactPhone: "" }, jobs: [], crew: [], mileage: [] }; const saved = await saveWorkspace(normalizeEmail(user.email), workspace, null); if (!saved.ok) return saved.response;
  return Response.json({ workspace, viewer: { role: "owner", email: normalizeEmail(user.email), displayName: user.displayName }, updatedAt: saved.updatedAt });
}
export async function PUT(request: Request) {
  const user = await getChatGPTUser(); if (!user) return Response.json({ error: "Sign in required" }, { status: 401 }); const access = await resolveAccess(user.email, user.displayName);
  if (!hasCompanyPermission(access.role, "edit_tasks")) return Response.json({ error: "Task editing access required" }, { status: 403 });
  const input = await request.json() as Partial<WorkspaceData> & { version?: string | null }; const current = await getWorkspace(access.ownerEmail); if (!current) return Response.json({ error: "Workspace not found" }, { status: 404 });
  if (typeof input.version !== "string" || current.updatedAt !== input.version) return Response.json({ error: "Workspace changed on another device", updatedAt: current.updatedAt }, { status: 409 });
  const existing = parseWorkspace(current.data); const canManageTeam = hasCompanyPermission(access.role, "manage_team"); const incomingCrew = canManageTeam && Array.isArray(input.crew) ? normalizeCrew(input.crew).filter((member) => member.email !== access.ownerEmail) : existing.crew; const prior = new Map(existing.crew.map((m) => [m.id, m.accessLevel]));
  const crew = access.role === "admin" ? incomingCrew.map((m) => ({ ...m, accessLevel: prior.get(m.id) ?? "employee" })) : incomingCrew;
  const workspace: WorkspaceData = { company: access.role === "owner" ? normalizeCompany(input.company, existing.company) : existing.company, jobs: Array.isArray(input.jobs) ? input.jobs : existing.jobs, crew, mileage: access.role === "editor" ? existing.mileage : Array.isArray(input.mileage) ? input.mileage : existing.mileage };
  const saved = await saveWorkspace(access.ownerEmail, workspace, current.updatedAt); if (!saved.ok) return saved.response; const memberConflicts = canManageTeam ? await syncMemberships(access.ownerEmail, workspace.crew) : [];
  return Response.json({ saved: true, updatedAt: saved.updatedAt, memberConflicts });
}
export async function PATCH(request: Request) {
  const user = await getChatGPTUser(); if (!user) return Response.json({ error: "Sign in required" }, { status: 401 }); const access = await resolveAccess(user.email, user.displayName); if (access.role === "unassigned") return Response.json({ error: "Company access required" }, { status: 403 });
  const row = await getWorkspace(access.ownerEmail); if (!row) return Response.json({ error: "Workspace not found" }, { status: 404 }); const workspace = parseWorkspace(row.data);
  const input = await request.json() as { action?: "job_status" | "message" | "mileage"; jobId?: string; status?: JobStatus; text?: string; entry?: Partial<MileageEntry> }; const job = workspace.jobs.find((item) => item.id === input.jobId); if (!job) return Response.json({ error: "Job not found" }, { status: 404 });
  if (access.role === "employee" && job.assigneeId !== access.crewId && job.helperId !== access.crewId) return Response.json({ error: "This job is not assigned to you" }, { status: 403 });
  if (input.action === "job_status") { const status = input.status; const labels: Record<JobStatus, string> = { assigned: "Assignment reopened", "in-progress": job.status === "help-needed" ? "Help request resolved" : "Job started", "help-needed": "Help requested", complete: "Job finished" }; if (!status || !(status in labels)) return Response.json({ error: "Invalid job status" }, { status: 400 }); job.status = status; job.events.push({ id: `${job.id}-${Date.now()}`, label: labels[status], time: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) }); }
  else if (input.action === "message") { const text = input.text?.trim().slice(0, 2000); if (!text) return Response.json({ error: "Message is empty" }, { status: 400 }); const message: JobMessage = { id: `${job.id}-message-${Date.now()}`, sender: access.role === "employee" ? "worker" : "dispatcher", text, time: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) }; job.messages.push(message); }
  else if (input.action === "mileage") { const miles = Number(input.entry?.miles); if (!Number.isFinite(miles) || miles <= 0 || miles > 10_000) return Response.json({ error: "Invalid mileage" }, { status: 400 }); workspace.mileage.unshift({ id: `MILE-${Date.now()}`, crewId: access.role === "employee" && access.crewId ? access.crewId : job.assigneeId, jobId: job.id, date: String(input.entry?.date ?? new Date().toLocaleDateString("en-US")), miles, startOdometer: input.entry?.startOdometer, endOdometer: input.entry?.endOdometer, purpose: String(input.entry?.purpose ?? `Travel to ${job.location}`).slice(0, 500), createdAt: new Date().toISOString() }); }
  else return Response.json({ error: "Invalid action" }, { status: 400 }); const saved = await saveWorkspace(access.ownerEmail, workspace, row.updatedAt); if (!saved.ok) return saved.response; return Response.json({ saved: true, updatedAt: saved.updatedAt });
}
export async function DELETE() {
  const user = await getChatGPTUser(); if (!user) return Response.json({ error: "Sign in required" }, { status: 401 }); const access = await resolveAccess(user.email, user.displayName); const db = getDb();
  if (access.role === "owner") { await db.delete(workspaceMembers).where(eq(workspaceMembers.ownerEmail, access.ownerEmail)); await db.delete(workspaceStates).where(eq(workspaceStates.ownerEmail, access.ownerEmail)); return Response.json({ deleted: true }); }
  if (access.role === "unassigned") return Response.json({ deleted: true }); const row = await getWorkspace(access.ownerEmail);
  if (row && access.crewId) { const workspace = parseWorkspace(row.data); workspace.crew = workspace.crew.filter((m) => m.id !== access.crewId); workspace.jobs = workspace.jobs.filter((j) => j.assigneeId !== access.crewId); workspace.mileage = workspace.mileage.filter((e) => e.crewId !== access.crewId); const saved = await saveWorkspace(access.ownerEmail, workspace, row.updatedAt); if (!saved.ok) return saved.response; }
  await db.delete(workspaceMembers).where(eq(workspaceMembers.memberEmail, normalizeEmail(user.email))); return Response.json({ deleted: true });
}
