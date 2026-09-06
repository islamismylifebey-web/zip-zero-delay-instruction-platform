import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { validateEmployeeFeedback } from '@/lib/zip/durability.ts';
import { readZipJson, zipRequestError } from '@/lib/zip/http.ts';
import { getWorkspace, parseWorkspace, resolveAccess } from '@/lib/workspace-server';

export const dynamic = 'force-dynamic';
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return json({ error: 'Sign in required.' }, 401);
  const access = await resolveAccess(user.email, user.displayName);
  let input: Record<string, unknown>;
  try { input = await readZipJson(request); } catch (error) { return zipRequestError(error); }
  const db = getD1();

  if (input.action === 'review') {
    if (access.role !== 'owner') return json({ error: 'Only the company owner can close ZIP feedback.' }, 403);
    const id = typeof input.feedbackId === 'string' ? input.feedbackId.trim() : '';
    if (!id || id.length > 128) return json({ error: 'Valid feedback ID required.' }, 400);
    const result = await db.prepare('UPDATE zip_employee_feedback SET reviewed_at = ? WHERE id = ? AND owner_email = ? AND reviewed_at IS NULL').bind(new Date().toISOString(), id, access.ownerEmail).run();
    return result.meta?.changes === 1 ? json({ reviewed: true }) : json({ error: 'Feedback was already reviewed or not found.' }, 409);
  }

  if (access.role !== 'employee' || !access.crewId) return json({ error: 'Employee assignment access required.' }, 403);
  const jobId = typeof input.jobId === 'string' ? input.jobId.trim() : '';
  if (!jobId || jobId.length > 128) return json({ error: 'Valid job ID required.' }, 400);
  const row = await getWorkspace(access.ownerEmail); if (!row) return json({ error: 'Workspace not found.' }, 404);
  const workspace = parseWorkspace(row.data);
  const job = workspace.jobs.find((item) => item.id === jobId);
  if (!job || (job.assigneeId !== access.crewId && job.helperId !== access.crewId)) return json({ error: 'This job is not assigned to you.' }, 403);
  if (!job.zipDraftId) return json({ error: 'Feedback is available for ZIP-generated assignments.' }, 409);
  let feedback: ReturnType<typeof validateEmployeeFeedback>;
  try { feedback = validateEmployeeFeedback(input); } catch { return json({ error: 'Choose Clear, Need more detail, Wrong location, or I am not trained for this.' }, 400); }
  const id = `feedback-${crypto.randomUUID()}`; const createdAt = new Date().toISOString();
  await db.prepare(`INSERT INTO zip_employee_feedback (id, owner_email, job_id, employee_id, signal, detail, created_at, reviewed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
    ON CONFLICT(owner_email, job_id, employee_id) DO UPDATE SET signal = excluded.signal, detail = excluded.detail, created_at = excluded.created_at, reviewed_at = NULL`).bind(id, access.ownerEmail, jobId, access.crewId, feedback.signal, feedback.detail, createdAt).run();
  return json({ saved: true, signal: feedback.signal });
}
