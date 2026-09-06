import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { writeWorkspaceSnapshot, type WorkspaceDatabase } from '../lib/workspace-write.ts';
import { createApprovedJob, createPendingZipDraft } from '../lib/zip/approval.ts';

function database() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('CREATE TABLE workspace_states (owner_email TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL)');
  const db: WorkspaceDatabase = { prepare(query) { return { bind(...values) { return { async run() { const result = sqlite.prepare(query).run(...values); return { meta: { changes: Number(result.changes) } }; } }; } }; } };
  const read = (owner = 'owner@example.com') => sqlite.prepare('SELECT data, updated_at FROM workspace_states WHERE owner_email = ?').get(owner) as { data: string; updated_at: string } | undefined;
  return { db, read, close: () => sqlite.close() };
}

test('company creation cannot overwrite an existing workspace', async () => {
  const store = database(); try {
    assert.equal((await writeWorkspaceSnapshot(store.db, 'owner@example.com', '{"jobs":[1]}', null, 1000)).saved, true);
    assert.equal((await writeWorkspaceSnapshot(store.db, 'owner@example.com', '{"jobs":[]}', null, 1000)).saved, false);
    assert.equal(store.read()?.data, '{"jobs":[1]}');
  } finally { store.close(); }
});
test('concurrent workspace writers cannot silently overwrite each other', async () => {
  const store = database(); try {
    const initial = await writeWorkspaceSnapshot(store.db, 'owner@example.com', '{}', null, 1000);
    const results = await Promise.all(['first', 'second'].map((value) => writeWorkspaceSnapshot(store.db, 'owner@example.com', value, initial.updatedAt, 1000)));
    assert.equal(results.filter((value) => value.saved).length, 1);
    assert.equal(store.read()?.data, 'first');
    assert.notEqual(store.read()?.updated_at, initial.updatedAt);
  } finally { store.close(); }
});
test('stale versions and other tenants cannot overwrite or create a workspace', async () => {
  const store = database(); try {
    const initial = await writeWorkspaceSnapshot(store.db, 'owner@example.com', 'original', null, 1000);
    assert.equal((await writeWorkspaceSnapshot(store.db, 'other@example.com', 'bad', initial.updatedAt, 1000)).saved, false);
    assert.equal((await writeWorkspaceSnapshot(store.db, 'owner@example.com', 'bad', '1970-01-01T00:00:00.000Z', 1000)).saved, false);
    assert.equal(store.read()?.data, 'original');
    assert.equal(store.read('other@example.com'), undefined);
  } finally { store.close(); }
});
test('failed cleanup or response loss can be retried without a second approval', async () => {
  const store = database(); try {
    await writeWorkspaceSnapshot(store.db, 'owner@example.com', '{"jobs":[]}', null, 1000);
    const pending = createPendingZipDraft({ draftId: 'draft-1', ownerEmail: 'owner@example.com', assigneeId: 'crew-1', professionalAssignment: 'Clean the floor.', checklist: [], createdBy: 'owner@example.com', createdAt: '2026-09-06T08:00:00Z', expiresAt: '2026-09-06T08:15:00Z' });
    async function approve() {
      const row = store.read()!;
      const workspace = JSON.parse(row.data) as { jobs: ReturnType<typeof createApprovedJob>[] };
      const receipt = workspace.jobs.find((job) => job.zipDraftId === pending.draftId);
      if (receipt) return receipt.id;
      const job = createApprovedJob(pending, pending.professionalAssignment, workspace.jobs.map((item) => item.id), '2026-09-06T08:03:00Z');
      workspace.jobs.push(job);
      const saved = await writeWorkspaceSnapshot(store.db, 'owner@example.com', JSON.stringify(workspace), row.updated_at, 1000);
      return saved.saved ? job.id : 'conflict';
    }
    const results = await Promise.all([approve(), approve()]);
    assert.equal(results.filter((value) => value !== 'conflict').length >= 1, true);
    assert.equal(await approve(), 'JOB-1');
    assert.equal(JSON.parse(store.read()!.data).jobs.length, 1);
  } finally { store.close(); }
});
