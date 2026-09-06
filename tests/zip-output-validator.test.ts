import test from 'node:test';
import assert from 'node:assert/strict';
import { validateZipModelResult } from '../lib/zip/output-validator.ts';
import { buildVerifiedContext } from '../lib/zip/context.ts';
import { phase1FixtureSource } from '../lib/zip/fixtures.ts';
function context() { const result = buildVerifiedContext({ employeeId: 'employee-demo', presetId: 'floor-care', rawInstruction: 'Clean the lobby' }, phase1FixtureSource); assert.equal(result.ok, true); if (!result.ok) throw new Error('fixture'); return result.context; }
test('ready output rejects invented source IDs', () => { const result = validateZipModelResult({ status: 'ready', professionalAssignment: 'Clean the lobby floor using the approved floor-care steps.', sourceIds: ['invented:1'], checklist: ['Place wet-floor signs before cleaning.'], unsupportedClaims: [] }, context()); assert.equal(result.status, 'invalid'); });
test('ready output rejects unsupported claims reported by the model', () => { const result = validateZipModelResult({ status: 'ready', professionalAssignment: 'Clean the lobby.', sourceIds: [context().preset.sourceId], checklist: ['Place wet-floor signs before cleaning.'], unsupportedClaims: ['Use bleach'] }, context()); assert.equal(result.status, 'invalid'); });
test('one concise clarification is accepted', () => { const result = validateZipModelResult({ status: 'needs_clarification', clarifyingQuestion: 'What location should the employee service?', missingFields: ['location'], conflictingFields: [] }, context()); assert.equal(result.status, 'needs_clarification'); });
