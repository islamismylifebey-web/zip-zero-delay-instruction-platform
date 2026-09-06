import test from 'node:test';
import assert from 'node:assert/strict';
import { buildVerifiedContext } from '../lib/zip/context.ts';
import { phase1FixtureSource } from '../lib/zip/fixtures.ts';

test('verified context excludes the raw instruction', () => { const result = buildVerifiedContext({ employeeId: 'employee-demo', presetId: 'floor-care', rawInstruction: 'Clean lobby at 2 PM' }, phase1FixtureSource); assert.equal(result.ok, true); if (!result.ok) return; assert.equal('rawInstruction' in result.context, false); assert.equal(JSON.stringify(result.context).includes('Clean lobby at 2 PM'), false); });
test('unknown employee is rejected', () => { const result = buildVerifiedContext({ employeeId: 'missing', presetId: 'floor-care', rawInstruction: 'Do it' }, phase1FixtureSource); assert.deepEqual(result, { ok: false, code: 'employee_not_found' }); });
