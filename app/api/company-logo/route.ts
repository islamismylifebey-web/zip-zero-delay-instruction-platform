import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { companyLogoKey, getWorkspace, parseWorkspace, resolveAccess, saveWorkspace } from "@/lib/workspace-server";
const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
export async function GET() {
  const user = await getChatGPTUser(); if (!user) return new Response("Sign in required", { status: 401 });
  const access = await resolveAccess(user.email, user.displayName); if (access.role === "unassigned") return new Response("Company access required", { status: 403 });
  const object = await env.BUCKET.get(await companyLogoKey(access.ownerEmail)); if (!object) return new Response("Logo not found", { status: 404 });
  return new Response(object.body, { headers: { "content-type": object.httpMetadata?.contentType ?? "image/png", "cache-control": "private, max-age=300", etag: object.httpEtag } });
}
export async function POST(request: Request) {
  const user = await getChatGPTUser(); if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const access = await resolveAccess(user.email, user.displayName); if (access.role !== "owner") return Response.json({ error: "Owner access required" }, { status: 403 });
  const file = (await request.formData()).get("logo");
  if (!(file instanceof File) || !allowedTypes.has(file.type) || file.size > 2_000_000) return Response.json({ error: "Choose a PNG, JPG, or WebP image under 2 MB" }, { status: 400 });
  await env.BUCKET.put(await companyLogoKey(access.ownerEmail), await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
  const row = await getWorkspace(access.ownerEmail); if (!row) return Response.json({ error: "Workspace not found" }, { status: 404 });
  const workspace = parseWorkspace(row.data); workspace.company.logoUpdatedAt = new Date().toISOString();
  const saved = await saveWorkspace(access.ownerEmail, workspace); if (!saved.ok) return saved.response;
  return Response.json({ logoUpdatedAt: workspace.company.logoUpdatedAt, updatedAt: saved.updatedAt });
}
export async function DELETE() {
  const user = await getChatGPTUser(); if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const access = await resolveAccess(user.email, user.displayName); if (access.role !== "owner") return Response.json({ error: "Owner access required" }, { status: 403 });
  await env.BUCKET.delete(await companyLogoKey(access.ownerEmail)); const row = await getWorkspace(access.ownerEmail);
  if (row) { const workspace = parseWorkspace(row.data); delete workspace.company.logoUpdatedAt; const saved = await saveWorkspace(access.ownerEmail, workspace); if (!saved.ok) return saved.response; }
  return Response.json({ deleted: true });
}
