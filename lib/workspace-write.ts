/** Minimal D1 interface; the same parameterized statements are tested against SQLite. */
export type WorkspaceDatabase = {
  prepare(query: string): { bind(...values: string[]): { run(): Promise<{ meta?: { changes?: number } }> } };
};

/** null creates a company; an existing version is required for every update. */
export async function writeWorkspaceSnapshot(db: WorkspaceDatabase, ownerEmail: string, data: string, expectedVersion: string | null, now = Date.now()) {
  const previous = expectedVersion === null ? 0 : Date.parse(expectedVersion);
  if (!ownerEmail || !Number.isFinite(previous) || !Number.isFinite(now)) throw new Error('Invalid workspace write');
  // Even writes in the same millisecond must have different versions.
  const updatedAt = new Date(Math.max(now, previous + 1)).toISOString();
  const statement = expectedVersion === null
    ? db.prepare('INSERT INTO workspace_states (owner_email, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(owner_email) DO NOTHING').bind(ownerEmail, data, updatedAt)
    : db.prepare('UPDATE workspace_states SET data = ?, updated_at = ? WHERE owner_email = ? AND updated_at = ?').bind(data, updatedAt, ownerEmail, expectedVersion);
  const result = await statement.run();
  return { saved: result.meta?.changes === 1, updatedAt };
}
