import type { CompanyKnowledge } from './onboarding.ts';

export type KnowledgeDatabase = {
  prepare(query: string): { bind(...values: string[]): {
    run(): Promise<{ meta?: { changes?: number } }>;
    first<T>(): Promise<T | null>;
  } };
};
export type KnowledgeSnapshot = { knowledge: CompanyKnowledge; version: string; updatedAt: string };
export const MAX_KNOWLEDGE_BYTES = 750_000;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
export async function loadKnowledge(db: KnowledgeDatabase, ownerEmail: string): Promise<KnowledgeSnapshot | null> {
  const row = await db.prepare('SELECT data, version, updated_at FROM zip_company_knowledge WHERE owner_email = ?').bind(ownerEmail).first<{ data: string; version: string; updated_at: string }>();
  if (!row) return null;
  const parsed: unknown = JSON.parse(row.data);
  if (!record(parsed) || parsed.schemaVersion !== 1 || typeof parsed.tenantId !== 'string' || !record(parsed.company) || !record(parsed.procedures) || !record(parsed.employees)) throw new Error('invalid_stored_company_knowledge');
  return { knowledge: parsed as CompanyKnowledge, version: row.version, updatedAt: row.updated_at };
}
export async function saveKnowledge(db: KnowledgeDatabase, ownerEmail: string, knowledge: CompanyKnowledge, expectedVersion: string | null, workspaceVersion: string, nextVersion: string = crypto.randomUUID(), now = new Date().toISOString()) {
  const data = JSON.stringify(knowledge);
  if (new TextEncoder().encode(data).byteLength > MAX_KNOWLEDGE_BYTES) throw new Error('company_knowledge_size_limit');
  const statement = expectedVersion === null
    ? db.prepare('INSERT INTO zip_company_knowledge (owner_email, data, version, updated_at) SELECT ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM workspace_states WHERE owner_email = ? AND updated_at = ?) ON CONFLICT(owner_email) DO NOTHING').bind(ownerEmail, data, nextVersion, now, ownerEmail, workspaceVersion)
    : db.prepare('UPDATE zip_company_knowledge SET data = ?, version = ?, updated_at = ? WHERE owner_email = ? AND version = ? AND EXISTS (SELECT 1 FROM workspace_states WHERE owner_email = ? AND updated_at = ?)').bind(data, nextVersion, now, ownerEmail, expectedVersion, ownerEmail, workspaceVersion);
  const result = await statement.run();
  return { saved: result.meta?.changes === 1, version: nextVersion, updatedAt: now };
}

/** One SQL write checks both revisions; a concurrent knowledge change cannot slip past approval. */
export async function writeGroundedWorkspace(db: KnowledgeDatabase, ownerEmail: string, data: string, workspaceVersion: string, knowledgeVersion: string, now = Date.now()) {
  const previous = Date.parse(workspaceVersion);
  if (!Number.isFinite(previous)) return { saved: false, updatedAt: workspaceVersion };
  const updatedAt = new Date(Math.max(now, previous + 1)).toISOString();
  const result = await db.prepare('UPDATE workspace_states SET data = ?, updated_at = ? WHERE owner_email = ? AND updated_at = ? AND EXISTS (SELECT 1 FROM zip_company_knowledge WHERE owner_email = ? AND version = ?)').bind(data, updatedAt, ownerEmail, workspaceVersion, ownerEmail, knowledgeVersion).run();
  return { saved: result.meta?.changes === 1, updatedAt };
}
