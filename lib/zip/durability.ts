import { completedProcedures, missingCompanyFields, nextQuestion, type CompanyKnowledge, type OnboardingTarget, type RosterMember } from './onboarding.ts';

export type FeedbackSignal = 'clear' | 'need_more_detail' | 'wrong_location' | 'not_trained';
export type EmployeeFeedback = { signal: FeedbackSignal; jobId?: string; employeeId?: string; detail?: string; createdAt?: string };
export type HealthIssue = { code: string; severity: 'blocker' | 'review'; message: string; subjectId?: string };
export type KnowledgeHealth = { ready: boolean; issues: HealthIssue[]; completedProcedures: number; confirmedEmployees: number; feedbackNeedingReview: number };

const getList = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
const cleanRule = (value: string) => value.toLowerCase().replace(/[.!?]+$/g, '').replace(/\s+/g, ' ').trim();
function polarity(rule: string): { negative: boolean; body: string } {
  let value = cleanRule(rule).replace(/^employees?\s+/, '');
  const negative = /^(?:must\s+never|never|do\s+not|must\s+not)\s+/.test(value);
  value = value.replace(/^(?:must\s+never|never|do\s+not|must\s+not|must|always|should)\s+/, '').trim();
  return { negative, body: value };
}
function directConflicts(rules: string[]) {
  const seen = new Map<string, Set<boolean>>();
  for (const rule of rules) {
    const parsed = polarity(rule); if (!parsed.body) continue;
    const set = seen.get(parsed.body) ?? new Set<boolean>(); set.add(parsed.negative); seen.set(parsed.body, set);
  }
  return [...seen.entries()].filter(([, values]) => values.size > 1).map(([body]) => body);
}

export function buildKnowledgeHealth(state: CompanyKnowledge, roster: RosterMember[], feedback: EmployeeFeedback[]): KnowledgeHealth {
  const issues: HealthIssue[] = [];
  const missing = missingCompanyFields(state);
  if (missing.length) issues.push({ code: 'company_setup_incomplete', severity: 'blocker', message: `Company setup is missing ${missing.length} confirmed field${missing.length === 1 ? '' : 's'}.` });
  for (const body of directConflicts(getList(state.company.policies?.value))) issues.push({ code: 'direct_rule_conflict', severity: 'blocker', message: `Confirmed company rules directly conflict about: ${body}.` });
  for (const [id, procedure] of Object.entries(state.procedures)) {
    if (nextQuestion(state, 'procedure', id)) { issues.push({ code: 'procedure_incomplete', severity: 'review', message: 'A job procedure is incomplete.', subjectId: id }); continue; }
    const rules = [...getList(procedure.answers.steps?.value), ...getList(procedure.answers.safetyRules?.value)];
    for (const body of directConflicts(rules)) issues.push({ code: 'direct_rule_conflict', severity: 'blocker', message: `Procedure rules directly conflict about: ${body}.`, subjectId: id });
  }
  let confirmedEmployees = 0;
  for (const member of roster) {
    const profile = state.employees[member.id];
    if (!profile || nextQuestion(state, 'employee', member.id)) { issues.push({ code: 'employee_profile_incomplete', severity: 'review', message: `${member.name} needs an owner-confirmed ZIP profile.`, subjectId: member.id }); continue; }
    confirmedEmployees += 1;
    const permissions = getList(profile.answers.authorizedJobTypes?.value);
    if (!permissions.length) issues.push({ code: 'employee_no_authorization', severity: 'review', message: `${member.name} has no confirmed job authorization.`, subjectId: member.id });
    const training = new Set(getList(profile.answers.training?.value).map(cleanRule));
    for (const procedureId of permissions) {
      const procedure = state.procedures[procedureId]; if (!procedure || nextQuestion(state, 'procedure', procedureId)) continue;
      const missingTraining = getList(procedure.answers.requiredTraining?.value).filter((item) => !training.has(cleanRule(item)));
      if (missingTraining.length) issues.push({ code: 'employee_training_gap', severity: 'blocker', message: `${member.name} is authorized for a procedure but lacks confirmed required training: ${missingTraining.join(', ')}.`, subjectId: member.id });
    }
  }
  for (const item of feedback) {
    if (item.signal === 'clear') continue;
    const code = item.signal === 'not_trained' ? 'employee_feedback_not_trained' : `employee_feedback_${item.signal}`;
    issues.push({ code, severity: item.signal === 'not_trained' ? 'blocker' : 'review', message: `Employee feedback on ${item.jobId ?? 'an assignment'} needs owner review${item.detail ? `: ${item.detail}` : '.'}`, subjectId: item.employeeId });
  }
  return { ready: !issues.some((issue) => issue.severity === 'blocker'), issues, completedProcedures: completedProcedures(state).length, confirmedEmployees, feedbackNeedingReview: feedback.filter((item) => item.signal !== 'clear').length };
}

export function describeKnowledgeChangeImpact(state: CompanyKnowledge, target: OnboardingTarget, subjectId: string, field: string, roster: RosterMember[], pendingDrafts: number) {
  const complete = completedProcedures(state);
  let affectedProcedures = 0; let affectedEmployees = 0;
  if (target === 'company') { affectedProcedures = complete.length; affectedEmployees = roster.filter((member) => !!state.employees[member.id] && !nextQuestion(state, 'employee', member.id)).length; }
  if (target === 'procedure') { affectedProcedures = complete.some((item) => item.id === subjectId) ? 1 : 0; affectedEmployees = roster.filter((member) => getList(state.employees[member.id]?.answers.authorizedJobTypes?.value).includes(subjectId)).length; }
  if (target === 'employee') affectedEmployees = state.employees[subjectId] ? 1 : 0;
  const parts = [`Changing ${field} may affect ${affectedProcedures} procedure${affectedProcedures === 1 ? '' : 's'} and ${affectedEmployees} employee${affectedEmployees === 1 ? '' : 's'}.`];
  if (pendingDrafts) parts.push(`${pendingDrafts} pending ZIP draft${pendingDrafts === 1 ? '' : 's'} will require a fresh draft after the change.`);
  return { affectedProcedures, affectedEmployees, pendingDraftsInvalidated: pendingDrafts, message: parts.join(' ') };
}

export function validateEmployeeFeedback(input: { signal?: unknown; detail?: unknown }): { signal: FeedbackSignal; detail: string } {
  const allowed: FeedbackSignal[] = ['clear', 'need_more_detail', 'wrong_location', 'not_trained'];
  if (typeof input.signal !== 'string' || !allowed.includes(input.signal as FeedbackSignal)) throw new Error('invalid_feedback_signal');
  const detail = input.detail === undefined ? '' : typeof input.detail === 'string' ? input.detail.trim() : '';
  if (detail.length > 500 || (input.detail !== undefined && typeof input.detail !== 'string')) throw new Error('invalid_feedback_detail');
  return { signal: input.signal as FeedbackSignal, detail };
}
