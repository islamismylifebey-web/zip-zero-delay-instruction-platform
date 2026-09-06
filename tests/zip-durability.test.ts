import test from 'node:test';
import assert from 'node:assert/strict';
import * as onboarding from '../lib/zip/onboarding.ts';
import { buildKnowledgeHealth, describeKnowledgeChangeImpact, validateEmployeeFeedback } from '../lib/zip/durability.ts';

const owner = { email: 'owner@company.test', ownerEmail: 'owner@company.test', role: 'owner' };
const crew = [
  { id: 'crew-1', name: 'Jordan', role: 'Technician', email: 'jordan@company.test' },
  { id: 'crew-2', name: 'Alex', role: 'Technician', email: 'alex@company.test' },
];
const now = '2026-09-06T13:00:00.000Z';
function apply(state: onboarding.CompanyKnowledge, input: Record<string, unknown>) {
  return onboarding.applyOnboardingChange(state, input, owner, crew, now, () => 'procedure-1');
}
function completeState() {
  let state = onboarding.emptyKnowledge('tenant-1');
  for (const [field, value] of Object.entries({
    services: 'Commercial cleaning',
    policies: ['Employees must never work alone after hours.'],
    workingHours: 'Monday to Friday 8 AM to 5 PM',
    timeZone: 'America/Chicago',
    locations: ['Main office'],
    escalationContact: 'Contact dispatch.',
  })) state = apply(state, { action: 'confirm', target: 'company', field, value, confirmed: true });
  state = apply(state, { action: 'add_procedure' });
  for (const [field, value] of Object.entries({
    name: 'Lobby cleaning', purpose: 'Clean the lobby', steps: ['Use wet-floor signs.'], tools: ['Mop'],
    safetyRules: ['Do not remove wet-floor signs while the floor is wet.'], requiredTraining: ['Floor training'],
    evidence: ['Report completion to dispatch.'], completionDefinition: 'Lobby is clean and reported complete.',
  })) state = apply(state, { action: 'confirm', target: 'procedure', subjectId: 'procedure-1', field, value, confirmed: true });
  state = apply(state, { action: 'begin_employee', subjectId: 'crew-1' });
  for (const [field, value] of Object.entries({
    department: 'Operations', responsibilities: ['Clean assigned areas'], training: ['Floor training'],
    authorizedJobTypes: ['procedure-1'], preferredLanguage: 'English', communicationDetail: 'standard', tone: 'friendly',
  })) state = apply(state, { action: 'confirm', target: 'employee', subjectId: 'crew-1', field, value, confirmed: true });
  return state;
}

test('knowledge health reports missing setup without inventing problems', () => {
  const health = buildKnowledgeHealth(onboarding.emptyKnowledge('tenant-1'), crew, []);
  assert.equal(health.ready, false);
  assert.ok(health.issues.some((issue) => issue.code === 'company_setup_incomplete'));
});

test('knowledge health detects direct confirmed rule contradictions conservatively', () => {
  let state = completeState();
  state = apply(state, { action: 'confirm', target: 'company', field: 'policies', value: ['Employees must work alone after hours.', 'Employees must never work alone after hours.'], confirmed: true });
  const health = buildKnowledgeHealth(state, crew, []);
  assert.ok(health.issues.some((issue) => issue.code === 'direct_rule_conflict'));
});

test('knowledge health surfaces employee feedback as owner review work without changing knowledge', () => {
  const state = completeState(); const before = JSON.stringify(state);
  const health = buildKnowledgeHealth(state, crew, [{ signal: 'not_trained', jobId: 'JOB-1', employeeId: 'crew-1', createdAt: now }]);
  assert.ok(health.issues.some((issue) => issue.code === 'employee_feedback_not_trained'));
  assert.equal(JSON.stringify(state), before);
});

test('change impact identifies affected employees and invalidated pending drafts before owner reconfirms', () => {
  const impact = describeKnowledgeChangeImpact(completeState(), 'procedure', 'procedure-1', 'steps', crew, 3);
  assert.equal(impact.affectedEmployees, 1);
  assert.equal(impact.pendingDraftsInvalidated, 3);
  assert.ok(impact.message.includes('1 employee'));
});

test('company-wide changes report all completed procedures and profiles as potentially affected', () => {
  const impact = describeKnowledgeChangeImpact(completeState(), 'company', '', 'policies', crew, 2);
  assert.equal(impact.affectedProcedures, 1);
  assert.equal(impact.affectedEmployees, 1);
  assert.equal(impact.pendingDraftsInvalidated, 2);
});

test('employee feedback accepts only fixed signals and bounded optional detail', () => {
  assert.deepEqual(validateEmployeeFeedback({ signal: 'need_more_detail', detail: 'Which entrance?' }), { signal: 'need_more_detail', detail: 'Which entrance?' });
  assert.deepEqual(validateEmployeeFeedback({ signal: 'clear' }), { signal: 'clear', detail: '' });
  assert.throws(() => validateEmployeeFeedback({ signal: 'rewrite_company_policy' }));
  assert.throws(() => validateEmployeeFeedback({ signal: 'wrong_location', detail: 'x'.repeat(501) }));
});

test('employee feedback signals never contain an instruction to mutate company knowledge', () => {
  for (const signal of ['clear', 'need_more_detail', 'wrong_location', 'not_trained']) {
    const result = validateEmployeeFeedback({ signal });
    assert.equal('knowledgePatch' in result, false);
  }
});
