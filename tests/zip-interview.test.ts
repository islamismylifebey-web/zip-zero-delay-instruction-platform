import test from 'node:test'; import assert from 'node:assert/strict';
import * as interview from '../lib/zip/interview.ts';
import { emptyKnowledge, ONBOARDING_QUESTIONS } from '../lib/zip/onboarding.ts';

test('empty optional answers require an explicit none selection', () => { const q = ONBOARDING_QUESTIONS.employee.find((q) => q.id === 'training')!; assert.throws(() => interview.reviewAnswer(q, '', [], false)); assert.deepEqual(interview.reviewAnswer(q, '', [], true), []); });
test('spoken procedure steps stay editable and are split only at owner-provided line breaks', () => { const q = ONBOARDING_QUESTIONS.procedure.find((q) => q.id === 'steps')!; assert.deepEqual(interview.reviewAnswer(q, 'First inspect. Then clean.', [], false), ['First inspect. Then clean.']); assert.deepEqual(interview.reviewAnswer(q, 'Inspect.\nClean.\n', [], false), ['Inspect.', 'Clean.']); });
test('permission review never selects all procedures by default', () => { const q = ONBOARDING_QUESTIONS.employee.find((q) => q.id === 'authorizedJobTypes')!; assert.throws(() => interview.reviewAnswer(q, '', [], false)); assert.deepEqual(interview.reviewAnswer(q, '', ['procedure-1'], false), ['procedure-1']); });
test('none cannot silently erase typed or selected information', () => { const q = ONBOARDING_QUESTIONS.procedure.find((q) => q.id === 'tools')!; assert.throws(() => interview.reviewAnswer(q, 'Mop', [], true)); });
test('required answers cannot be skipped by selecting none', () => { assert.throws(() => interview.reviewAnswer(ONBOARDING_QUESTIONS.company[0], '', [], true)); });
test('new interviews resume at the company section', () => { assert.deepEqual(interview.resumeTarget(emptyKnowledge('tenant-1'), []), { target: 'company', subjectId: '' }); });
