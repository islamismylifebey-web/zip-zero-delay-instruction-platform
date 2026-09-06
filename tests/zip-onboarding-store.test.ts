import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import * as store from '../lib/zip/onboarding-store.ts';
import { emptyKnowledge } from '../lib/zip/onboarding.ts';

function database() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`PRAGMA foreign_keys = ON; CREATE TABLE workspace_states (owner_email TEXT PRIMARY KEY NOT NULL, data TEXT NOT NULL, updated_at TEXT NOT NULL); CREATE TABLE zip_pending_drafts (draft_id TEXT PRIMARY KEY NOT NULL);`);
  sqlite.exec(readFileSync(new URL('../drizzle/0005_zip_company_knowledge.sql', import.meta.url), 'utf8'));
  sqlite.prepare('INSERT INTO workspace_states VALUES (?, ?, ?)').run('owner@company.test', '{"jobs":[]}', '2026-09-06T12:00:00.000Z');
  const db: store.KnowledgeDatabase = { prepare(query) { return { bind(...values) { return { async run() { const result = sqlite.prepare(query).run(...values); return { meta: { changes: Number(result.changes) } }; }, async first<T>() { return (sqlite.prepare(query).get(...values) ?? null) as T | null; } }; } }; } };
  return { sqlite, db };
}
const owner = 'owner@company.test'; const version = '2026-09-06T12:00:00.000Z';
test('store exposes versioned writes', () => { assert.equal(typeof store.saveKnowledge, 'function'); });
test('migration upgrades existing pending drafts without authorizing them', () => {
  const { sqlite } = database(); try {
    sqlite.prepare('INSERT INTO zip_pending_drafts (draft_id) VALUES (?)').run('legacy');
    const row = sqlite.prepare('SELECT knowledge_version, preset_id FROM zip_pending_drafts').get();
    assert.equal(row?.knowledge_version, ''); assert.equal(row?.preset_id, '');
  } finally { sqlite.close(); }
});
test('knowledge creation is tenant scoped and cannot overwrite another saved version', async () => {
  const { sqlite, db } = database(); try {
    assert.equal((await store.saveKnowledge(db, owner, emptyKnowledge('tenant-1'), null, version, 'k1')).saved, true);
    assert.equal((await store.saveKnowledge(db, owner, emptyKnowledge('changed'), null, version, 'k2')).saved, false);
    assert.equal((await store.loadKnowledge(db, owner))?.knowledge.tenantId, 'tenant-1');
    assert.equal(await store.loadKnowledge(db, 'other@company.test'), null);
  } finally { sqlite.close(); }
});
test('missing company and stale workspace cannot acquire knowledge', async () => {
  const { sqlite, db } = database(); try {
    assert.equal((await store.saveKnowledge(db, 'other@company.test', emptyKnowledge('t2'), null, version, 'k1')).saved, false);
    assert.equal((await store.saveKnowledge(db, owner, emptyKnowledge('t1'), null, 'stale', 'k1')).saved, false);
  } finally { sqlite.close(); }
});
test('simultaneous knowledge edits permit only one winner', async () => {
  const { sqlite, db } = database(); try {
    await store.saveKnowledge(db, owner, emptyKnowledge('tenant-1'), null, version, 'k1');
    const results = await Promise.all(['k2', 'k3'].map((next) => store.saveKnowledge(db, owner, emptyKnowledge('tenant-1'), 'k1', version, next)));
    assert.equal(results.filter((entry) => entry.saved).length, 1);
    assert.equal((await store.loadKnowledge(db, owner))?.version, 'k2');
  } finally { sqlite.close(); }
});
test('approval atomically checks current knowledge and workspace versions', async () => {
  const { sqlite, db } = database(); try {
    await store.saveKnowledge(db, owner, emptyKnowledge('tenant-1'), null, version, 'k1');
    assert.equal((await store.writeGroundedWorkspace(db, owner, '{"jobs":[1]}', version, 'wrong')).saved, false);
    assert.equal((await store.writeGroundedWorkspace(db, owner, '{"jobs":[1]}', 'wrong', 'k1')).saved, false);
    assert.equal((await store.writeGroundedWorkspace(db, 'other@company.test', '{"jobs":[1]}', version, 'k1')).saved, false);
    const saved = await store.writeGroundedWorkspace(db, owner, '{"jobs":[1]}', version, 'k1', Date.parse(version));
    assert.equal(saved.saved, true); assert.notEqual(saved.updatedAt, version);
    assert.equal((await store.writeGroundedWorkspace(db, owner, '{"jobs":[2]}', version, 'k1')).saved, false);
    assert.equal(sqlite.prepare('SELECT data FROM workspace_states').get()?.data, '{"jobs":[1]}');
  } finally { sqlite.close(); }
});
test('owner deletion removes knowledge rather than restoring it on account recreation', async () => {
  const { sqlite, db } = database(); try {
    await store.saveKnowledge(db, owner, emptyKnowledge('tenant-1'), null, version, 'k1');
    sqlite.prepare('DELETE FROM workspace_states WHERE owner_email = ?').run(owner);
    assert.equal(await store.loadKnowledge(db, owner), null);
  } finally { sqlite.close(); }
});
test('malformed stored knowledge fails closed', async () => {
  const { sqlite, db } = database(); try {
    await store.saveKnowledge(db, owner, emptyKnowledge('tenant-1'), null, version, 'k1');
    sqlite.exec(`UPDATE zip_company_knowledge SET data = 'null'`);
    await assert.rejects(store.loadKnowledge(db, owner));
  } finally { sqlite.close(); }
});
