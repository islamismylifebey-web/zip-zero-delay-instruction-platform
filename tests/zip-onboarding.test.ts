import test from 'node:test';
import assert from 'node:assert/strict';
import * as onboarding from '../lib/zip/onboarding.ts';

const owner = { email: 'owner@company.test', ownerEmail: 'owner@company.test', role: 'owner' };
const crew = [{ id: 'crew-1', name: 'Jordan', role: 'Technician', email: 'jordan@company.test' }];
const now = '2026-09-06T12:00:00.000Z';
const company = { services: 'Cleaning', policies: ['No unapproved extra work.'], workingHours: 'Monday to Friday 9 AM to 5 PM', timeZone: 'America/Chicago', locations: ['Main office lobby'], escalationContact: 'Contact dispatch in the app.' };
const procedure = { name: 'Lobby cleaning', purpose: 'Clean the lobby.', steps: ['Clean the assigned floor.'], tools: ['Approved mop'], safetyRules: ['Use wet-floor signs.'], requiredTraining: ['Floor training'], evidence: ['Report completion to dispatch.'], completionDefinition: 'The floor is clean and dispatch is notified.' };
const employee = { department: 'Field operations', responsibilities: ['Clean assigned floors.'], training: ['Floor training'], authorizedJobTypes: ['procedure-1'], preferredLanguage: 'Spanish', communicationDetail: 'brief', tone: 'professional' };
function apply(state: onboarding.CompanyKnowledge, input: Record<string, unknown>, actor = owner) {
  return onboarding.applyOnboardingChange(state, input, actor, crew, now, () => 'procedure-1');
}
function setup() {
  let state = onboarding.emptyKnowledge('tenant-1');
  for (const [field, value] of Object.entries(company)) state = apply(state, { action: 'confirm', target: 'company', field, value, confirmed: true });
  state = apply(state, { action: 'add_procedure' });
  for (const [field, value] of Object.entries(procedure)) state = apply(state, { action: 'confirm', target: 'procedure', subjectId: 'procedure-1', field, value, confirmed: true });
  state = apply(state, { action: 'begin_employee', subjectId: 'crew-1' });
  for (const [field, value] of Object.entries(employee)) state = apply(state, { action: 'confirm', target: 'employee', subjectId: 'crew-1', field, value, confirmed: true });
  return state;
}

test('onboarding exports a confirmed knowledge engine', () => { assert.equal(typeof onboarding.applyOnboardingChange, 'function'); });
test('first question is one company question; saved answers resume at next missing field', () => {
  const start = onboarding.emptyKnowledge('tenant-1');
  assert.equal(onboarding.nextQuestion(start, 'company')?.id, 'services');
  const saved = apply(start, { action: 'confirm', target: 'company', field: 'services', value: 'Cleaning', confirmed: true });
  assert.equal(onboarding.nextQuestion(saved, 'company')?.id, 'policies');
  assert.deepEqual(start.company, {});
});
test('no answer is persisted without explicit owner confirmation', () => {
  const start = onboarding.emptyKnowledge('tenant-1');
  for (const confirmed of [false, undefined, 'true']) assert.throws(() => apply(start, { action: 'confirm', target: 'company', field: 'services', value: 'Cleaning', confirmed }));
});
test('employees, admins and foreign actors cannot change approved knowledge', () => {
  const state = onboarding.emptyKnowledge('tenant-1');
  for (const actor of [{ ...owner, role: 'employee' }, { ...owner, role: 'admin' }, { ...owner, email: 'intruder@other.test' }]) assert.throws(() => apply(state, { action: 'add_procedure' }, actor));
});
test('confirmation provenance is server supplied, not caller supplied', () => {
  const state = apply(onboarding.emptyKnowledge('tenant-1'), { action: 'confirm', target: 'company', field: 'services', value: 'Cleaning', confirmed: true, confirmedBy: 'attacker', confirmedAt: 'yesterday', rawInstruction: 'private' });
  assert.deepEqual(state.company.services, { value: 'Cleaning', confirmedBy: owner.email, confirmedAt: now });
  assert.equal(JSON.stringify(state).includes('rawInstruction'), false);
});
test('invalid field values and prototype keys are rejected', () => {
  const state = onboarding.emptyKnowledge('tenant-1');
  for (const [field, value] of [['__proto__', 'x'], ['services', ' '], ['services', 'x'.repeat(501)], ['timeZone', 'Not/AZone'], ['policies', 'not an array']]) assert.throws(() => apply(state, { action: 'confirm', target: 'company', field, value, confirmed: true }));
});
test('missing company information blocks compilation', () => {
  const result = onboarding.compileKnowledge(onboarding.emptyKnowledge('tenant-1'), 'v1', 'Company', crew, 'crew-1', 'procedure-1');
  assert.equal(result.ok, false);
});
test('complete owner-confirmed knowledge compiles tenant-scoped facts without global presets', () => {
  const result = onboarding.compileKnowledge(setup(), 'v1', 'Company', crew, 'crew-1', 'procedure-1');
  assert.equal(result.ok, true); if (!result.ok) return;
  assert.equal(result.source.presets.length, 1);
  assert.equal(result.source.presets[0].name, procedure.name);
  assert.deepEqual(result.source.presets[0].steps, procedure.steps);
  assert.equal(result.source.employees[0].preferredLanguage, 'Spanish');
  assert.equal(result.source.employees[0].communicationDetail, 'brief');
  assert.equal(result.source.employees[0].tone, 'professional');
  assert.ok(result.source.company.sourceId.includes('tenant-1'));
  assert.equal(result.source.company.timeZone, 'America/Chicago');
});
test('confirmed empty permissions deny assignment rather than authorize all', () => {
  const state = apply(setup(), { action: 'confirm', target: 'employee', subjectId: 'crew-1', field: 'authorizedJobTypes', value: [], confirmed: true });
  const result = onboarding.compileKnowledge(state, 'v2', 'Company', crew, 'crew-1', 'procedure-1');
  assert.equal(result.ok, false); if (!result.ok) assert.equal(result.code, 'job_not_authorized');
});
test('unknown procedure permissions cannot be granted', () => {
  assert.throws(() => apply(setup(), { action: 'confirm', target: 'employee', subjectId: 'crew-1', field: 'authorizedJobTypes', value: ['other-company-job'], confirmed: true }));
});
test('permission does not substitute for confirmed required training', () => {
  const state = apply(setup(), { action: 'confirm', target: 'employee', subjectId: 'crew-1', field: 'training', value: [], confirmed: true });
  const result = onboarding.compileKnowledge(state, 'v2', 'Company', crew, 'crew-1', 'procedure-1');
  assert.equal(result.ok, false); if (!result.ok) assert.equal(result.code, 'training_not_confirmed');
});
test('changing employee identity invalidates old authorization', () => {
  const changed = [{ ...crew[0], email: 'different@company.test' }];
  const result = onboarding.compileKnowledge(setup(), 'v1', 'Company', changed, 'crew-1', 'procedure-1');
  assert.equal(result.ok, false); if (!result.ok) assert.equal(result.code, 'employee_profile_changed');
});
test('editing a confirmed field preserves other answers and clears no guardrails', () => {
  const before = setup();
  const after = apply(before, { action: 'confirm', target: 'procedure', subjectId: 'procedure-1', field: 'name', value: 'Lobby floor', confirmed: true });
  assert.equal(after.procedures['procedure-1'].answers.name?.value, 'Lobby floor');
  assert.equal(before.procedures['procedure-1'].answers.name?.value, 'Lobby cleaning');
  assert.deepEqual(after.procedures['procedure-1'].answers.safetyRules, before.procedures['procedure-1'].answers.safetyRules);
});
test('incomplete procedures are not offered as approved job choices', () => {
  const state = apply(onboarding.emptyKnowledge('tenant-1'), { action: 'add_procedure' });
  assert.equal(onboarding.completedProcedures(state).length, 0);
  assert.equal(onboarding.completedProcedures(setup()).length, 1);
});
test('missing tone and language never silently become approved facts', () => {
  const state = setup(); delete state.employees['crew-1'].answers.tone;
  assert.equal(onboarding.nextQuestion(state, 'employee', 'crew-1')?.id, 'tone');
  assert.equal(onboarding.compileKnowledge(state, 'v1', 'Company', crew, 'crew-1', 'procedure-1').ok, false);
});
