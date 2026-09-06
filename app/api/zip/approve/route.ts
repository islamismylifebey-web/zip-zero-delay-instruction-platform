import { and, eq } from 'drizzle-orm';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import type { Job } from '@/app/models';
import { getDb } from '@/db';
import { zipPendingDrafts } from '@/db/schema';
import { hasCompanyPermission } from '@/lib/company-access';
import { createApprovedJob, createPendingZipDraft } from '@/lib/zip/approval.ts';
import { getWorkspace, parseWorkspace, resolveAccess, saveWorkspace } from '@/lib/workspace-server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const user = await getChatGPTUser(); if (!user) return Response.json({ error: 'Sign in required' }, { status: 401 });
  const access = await resolveAccess(user.email, user.displayName); if (!hasCompanyPermission(access.role, 'edit_tasks')) return Response.json({ error: 'Task editing access required' }, { status: 403 });
  let input: { draftId?: string; professionalAssignment?: string }; try { input = await request.json() as typeof input; } catch { return Response.json({ error: 'Invalid request body' }, { status: 400 }); }
  const draftId = String(input.draftId ?? '').trim(); if (!draftId) return Response.json({ error: 'Draft ID required' }, { status: 400 });

  const db = getDb(); const [stored] = await db.select().from(zipPendingDrafts).where(and(eq(zipPendingDrafts.draftId, draftId), eq(zipPendingDrafts.ownerEmail, access.ownerEmail))).limit(1);
  if (!stored) return Response.json({ error: 'Draft not found or already consumed' }, { status: 404 });
  if (stored.expiresAt <= new Date().toISOString()) { await db.delete(zipPendingDrafts).where(eq(zipPendingDrafts.draftId, draftId)); return Response.json({ error: 'Draft expired. Create a new ZIP draft.' }, { status: 410 }); }

  const row = await getWorkspace(access.ownerEmail); if (!row) return Response.json({ error: 'Workspace not found' }, { status: 404 });
  const workspace = parseWorkspace(row.data); if (!workspace.crew.some((member) => member.id === stored.assigneeId)) return Response.json({ error: 'Assigned employee is no longer available' }, { status: 409 });
  let checklist: string[]; try { const parsed = JSON.parse(stored.checklistJson) as unknown; checklist = Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []; } catch { checklist = []; }
  const pending = createPendingZipDraft({ draftId: stored.draftId, ownerEmail: stored.ownerEmail, assigneeId: stored.assigneeId, professionalAssignment: stored.professionalAssignment, checklist, createdBy: stored.createdBy, createdAt: stored.createdAt, expiresAt: stored.expiresAt });
  const reviewed = String(input.professionalAssignment ?? stored.professionalAssignment).trim(); if (!reviewed || reviewed.length > 4000) return Response.json({ error: 'Reviewed assignment must be 1–4,000 characters.' }, { status: 400 });
  let approved: Job; try { approved = createApprovedJob(pending, reviewed, workspace.jobs.map((job) => job.id), new Date().toISOString()) as Job; } catch { return Response.json({ error: 'Reviewed assignment is invalid' }, { status: 400 }); }
  workspace.jobs.unshift(approved); const saved = await saveWorkspace(access.ownerEmail, workspace); if (!saved.ok) return saved.response;
  await db.delete(zipPendingDrafts).where(eq(zipPendingDrafts.draftId, draftId));
  return Response.json({ status: 'approved', jobId: approved.id, assigneeId: approved.assigneeId, updatedAt: saved.updatedAt });
}
