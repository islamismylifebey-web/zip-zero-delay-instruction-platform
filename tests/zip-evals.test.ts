import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createZipDraftService } from '../lib/zip/draft-service.ts';
import { phase1FixtureSource } from '../lib/zip/fixtures.ts';
type EvalCase = { name: string; employeeId: string; presetId: string; raw: string; expected: string };
const cases = JSON.parse(readFileSync(new URL('./fixtures/zip-evals.json', import.meta.url), 'utf8')) as EvalCase[];
for (const item of cases) {
  test(`ZIP eval: ${item.name}`, async () => {
    const provider = { generate: async (_raw: string, _context: unknown, signal: AbortSignal) => {
      if (item.name === 'provider timeout') return await new Promise((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true }));
      if (item.name === 'invented address trap') return { status: 'ready', professionalAssignment: 'Clean 123 Invented Street at 4 PM.', sourceIds: ['preset:floor-care'], checklist: ['Place wet-floor signs before cleaning.'], unsupportedClaims: [] };
      if (item.expected === 'needs_clarification') return { status: 'needs_clarification', clarifyingQuestion: 'What verified detail should ZIP use?', missingFields: ['location'], conflictingFields: [] };
      const presetSource = item.presetId === 'general-field-service' ? 'preset:general-field-service' : 'preset:floor-care';
      const checklist = item.presetId === 'general-field-service' ? ['Do not perform work outside the approved assignment.'] : ['Place wet-floor signs before cleaning.'];
      return { status: 'ready', professionalAssignment: 'Complete the selected assignment using the verified preset and report completion to dispatch.', sourceIds: [presetSource], checklist, unsupportedClaims: [] };
    } };
    const service = createZipDraftService({ source: phase1FixtureSource, provider, logger: () => undefined, timeoutMs: 10 });
    const result = await service.draft({ employeeId: item.employeeId, presetId: item.presetId, rawInstruction: item.raw });
    assert.equal(result.status, item.expected); assert.equal(JSON.stringify(result).includes(item.raw), false);
  });
}
