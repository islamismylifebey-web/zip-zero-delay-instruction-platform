import test from 'node:test';
import assert from 'node:assert/strict';
import { ZIP_SYSTEM_PROMPT } from '../lib/zip/prompt.ts';
// Static policy regression checks, not proof of live model compliance.
test('onboarding professional tone is explicitly mapped to the drafting policy', () => {
  assert.ok(ZIP_SYSTEM_PROMPT.includes('When employee.tone is professional, omit playful remarks'));
});
test('job-specific instructions do not replace confirmed company policy or credentials', () => {
  assert.ok(ZIP_SYSTEM_PROMPT.includes('The authenticated instruction may supply this job’s location and deadline'));
  assert.ok(ZIP_SYSTEM_PROMPT.includes('Owner-confirmed training is not independent certification'));
});
