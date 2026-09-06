import test from 'node:test'; import assert from 'node:assert/strict';
import * as handler from '../lib/zip/onboarding-handler.ts';
import { emptyKnowledge } from '../lib/zip/onboarding.ts';
const owner = { email: 'owner@company.test', ownerEmail: 'owner@company.test', role: 'owner', displayName: 'Owner' };
function deps(session: typeof owner | null = owner) {
  const reads: string[] = [];
  const writes: string[] = [];
  return { reads, writes, getSession: async () => session,
    getWorkspace: async (email: string) => { reads.push(email); return { companyName: 'Company', crew: [{ id: 'crew-1', name: 'Jordan', email: 'jordan@company.test', role: 'Technician' }], version: 'w1' }; },
    load: async () => ({ knowledge: emptyKnowledge('tenant-1'), version: 'k1', updatedAt: '2026-09-06T12:00:00Z' }),
    save: async (email: string) => { writes.push(email); return { saved: true, version: 'k2', updatedAt: '2026-09-06T12:01:00Z' }; },
  };
}
const req = (body: unknown, headers: Record<string, string> = {}) => new Request('https://zip.example/api/zip/onboarding', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
const answer = { action: 'confirm', target: 'company', field: 'services', value: 'Cleaning', confirmed: true, version: 'k1' };
test('handler exposes the authenticated onboarding flow', () => { assert.equal(typeof handler.handleOnboarding, 'function'); });
test('unauthenticated request returns 401 without reading company data', async () => {
 const d = deps(null); assert.equal((await handler.handleOnboarding(req(answer), d)).status, 401); assert.equal(d.reads.length, 0);
});
test('employee cannot read or modify owner onboarding', async () => {
 const d = deps({ ...owner, role: 'employee', email: 'jordan@company.test' });
 for (const request of [req(answer), new Request('https://zip.example/api/zip/onboarding')]) assert.equal((await handler.handleOnboarding(request, d)).status, 403);
 assert.equal(d.reads.length, 0);
});
test('administrators cannot change company knowledge and GET excludes private answers', async () => {
 const d = deps({ ...owner, role: 'admin', email: 'admin@company.test' });
 assert.equal((await handler.handleOnboarding(req(answer), d)).status, 403);
 const response = await handler.handleOnboarding(new Request('https://zip.example/api/zip/onboarding'), d);
 const payload = await response.json() as Record<string, unknown>; assert.equal('knowledge' in payload, false); assert.equal('crew' in payload, false);
});
test('posted tenant identity never overrides the signed-in company', async () => {
 const d = deps(); const response = await handler.handleOnboarding(req({ ...answer, ownerEmail: 'victim@other.test' }), d);
 assert.equal(response.status, 200); assert.deepEqual(d.writes, [owner.ownerEmail]);
 assert.equal(response.headers.get('cache-control'), 'no-store');
});
test('stale version, absent version and unconfirmed answers cannot be saved', async () => {
 for (const patch of [{ version: 'stale' }, { version: undefined }, { confirmed: false }]) { const d = deps(); const response = await handler.handleOnboarding(req({ ...answer, ...patch }), d); assert.ok(response.status >= 400); assert.equal(d.writes.length, 0); }
});
test('null, oversized and cross-origin requests are rejected without writes', async () => {
 for (const request of [req(null), req({ ...answer, value: 'x'.repeat(17000) }), req(answer, { origin: 'https://other.example' })]) { const d = deps(); assert.ok((await handler.handleOnboarding(request, d)).status >= 400); assert.equal(d.writes.length, 0); }
});
test('concurrent storage failure never produces a saved response', async () => {
 const d = { ...deps(), save: async () => ({ saved: false, version: 'k2', updatedAt: 'now' }) };
 assert.equal((await handler.handleOnboarding(req(answer), d)).status, 409);
});
test('database errors return a recoverable response without leaking details', async () => {
 const d = { ...deps(), load: async () => { throw new Error('private_database_detail'); } };
 const response = await handler.handleOnboarding(req(answer), d); assert.equal(response.status, 503); assert.equal((await response.text()).includes('private_database_detail'), false);
});
