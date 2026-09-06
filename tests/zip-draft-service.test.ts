import test from 'node:test';
import assert from 'node:assert/strict';
import { createZipDraftService } from '../lib/zip/draft-service.ts';
import { phase1FixtureSource } from '../lib/zip/fixtures.ts';

test('draft service returns only safe ready fields and never logs the raw instruction', async () => {
  const logs: unknown[] = [];
  const service = createZipDraftService({ source: phase1FixtureSource, provider: { generate: async () => ({ status: 'ready', professionalAssignment: 'Clean the lobby floor using the approved floor-care steps.', sourceIds: ['preset:floor-care'], checklist: ['Place wet-floor signs before cleaning.'], unsupportedClaims: [] }) }, logger: (event) => logs.push(event), timeoutMs: 100 });
  const raw = 'yo tell Mike mop that lobby right now'; const result = await service.draft({ employeeId: 'employee-demo', presetId: 'floor-care', rawInstruction: raw });
  assert.equal(result.status, 'ready'); assert.equal(JSON.stringify(result).includes(raw), false); assert.equal(JSON.stringify(logs).includes(raw), false);
});

test('provider failure becomes a truthful retryable state', async () => {
  const service = createZipDraftService({ source: phase1FixtureSource, provider: { generate: async () => { throw new Error('boom'); } }, logger: () => undefined, timeoutMs: 100 });
  const result = await service.draft({ employeeId: 'employee-demo', presetId: 'floor-care', rawInstruction: 'Clean lobby' });
  assert.deepEqual(result, { status: 'temporarily_unavailable', retryable: true, code: 'provider_error' });
});
