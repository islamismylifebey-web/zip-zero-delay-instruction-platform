import type { ZipContextSource } from './contracts.ts';

export type OnboardingTarget = 'company' | 'procedure' | 'employee';
export type AnswerValue = string | string[];
export type ConfirmedAnswer = { value: AnswerValue; confirmedBy: string; confirmedAt: string };
export type Answers = Record<string, ConfirmedAnswer>;
export type RosterMember = { id: string; name: string; role: string; email: string };
export type CompanyKnowledge = {
  schemaVersion: 1;
  tenantId: string;
  company: Answers;
  procedures: Record<string, { answers: Answers }>;
  employees: Record<string, { identity: string; answers: Answers }>;
};
export type Question = {
  id: string; prompt: string; kind: 'text' | 'list' | 'select' | 'permissions';
  help?: string; options?: string[]; allowEmpty?: boolean;
};
export const ONBOARDING_QUESTIONS: Record<OnboardingTarget, Question[]> = {
  company: [
    { id: 'services', prompt: 'What does your company do, and what work do you assign?', kind: 'text' },
    { id: 'policies', prompt: 'What rules must ZIP follow for every assignment?', kind: 'list', help: 'One rule per line. These are your company rules, not permission to override ZIP’s safety or approval limits.' },
    { id: 'workingHours', prompt: 'What are your normal working hours and after-hours limits?', kind: 'text' },
    { id: 'timeZone', prompt: 'Which time zone should ZIP use for your company?', kind: 'text', help: 'Use a time zone such as America/Chicago, America/New_York, or Europe/London.' },
    { id: 'locations', prompt: 'Which locations do you work at, or how should ZIP confirm a new location?', kind: 'list', help: 'One location or location-confirmation rule per line. Do not include passwords or access codes.' },
    { id: 'escalationContact', prompt: 'Who should employees contact when something is unclear, unsafe, or blocked?', kind: 'text' },
  ],
  procedure: [
    { id: 'name', prompt: 'What do you call this type of job?', kind: 'text' },
    { id: 'purpose', prompt: 'What is the purpose of this job?', kind: 'text' },
    { id: 'steps', prompt: 'Walk me through the approved steps in order.', kind: 'list', help: 'One step per line. Review spoken text and separate the steps before confirming.' },
    { id: 'tools', prompt: 'Which approved tools or materials does this job require?', kind: 'list', allowEmpty: true },
    { id: 'safetyRules', prompt: 'What must employees never do, and when must they stop and ask for help?', kind: 'list' },
    { id: 'requiredTraining', prompt: 'What training must be confirmed before an employee may do this job?', kind: 'list', allowEmpty: true, help: 'Use short training names. An owner confirmation is not independent certification.' },
    { id: 'evidence', prompt: 'How must an employee report or show that the job is finished?', kind: 'list', help: 'Describe your process. This does not enable photo upload, notifications, or other tools that ZIP does not yet have.' },
    { id: 'completionDefinition', prompt: 'What exactly must be true before this job counts as complete?', kind: 'text' },
  ],
  employee: [
    { id: 'department', prompt: 'Which team or department does this employee belong to?', kind: 'text' },
    { id: 'responsibilities', prompt: 'What work is this employee responsible for?', kind: 'list' },
    { id: 'training', prompt: 'Which required training have you confirmed for this employee?', kind: 'list', allowEmpty: true, help: 'Use the exact training names recorded in your job procedures. Do not infer training from a job title.' },
    { id: 'authorizedJobTypes', prompt: 'Which completed job procedures is this employee permitted to perform?', kind: 'permissions', allowEmpty: true, help: 'Select explicitly. No selections means no job authorization, not access to every job.' },
    { id: 'preferredLanguage', prompt: 'Which language should ZIP use for this employee?', kind: 'text' },
    { id: 'communicationDetail', prompt: 'How much instruction detail does this employee need?', kind: 'select', options: ['brief', 'standard', 'detailed'] },
    { id: 'tone', prompt: 'Should routine messages be lightly friendly or fully professional?', kind: 'select', options: ['friendly', 'professional'], help: 'ZIP always stays professional during anger, corrections, conflict, or safety-sensitive work.' },
  ],
};

export class OnboardingError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.name = 'OnboardingError'; this.status = status; }
}
export function emptyKnowledge(tenantId: string): CompanyKnowledge {
  return { schemaVersion: 1, tenantId, company: {}, procedures: {}, employees: {} };
}
export function employeeIdentity(member: RosterMember): string {
  return JSON.stringify([member.id, member.name, member.role, member.email.trim().toLowerCase()]);
}
function own<T>(record: Record<string, T>, key: string): T | undefined {
  return Object.hasOwn(record, key) ? record[key] : undefined;
}
export function targetAnswers(state: CompanyKnowledge, target: OnboardingTarget, subjectId = ''): Answers | undefined {
  if (target === 'company') return state.company;
  if (target === 'procedure') return own(state.procedures, subjectId)?.answers;
  if (target === 'employee') return own(state.employees, subjectId)?.answers;
}
export function nextQuestion(state: CompanyKnowledge, target: OnboardingTarget, subjectId = ''): Question | undefined {
  const answers = targetAnswers(state, target, subjectId) ?? {};
  return ONBOARDING_QUESTIONS[target].find((question) => !own(answers, question.id));
}
export function completedProcedures(state: CompanyKnowledge): Array<{ id: string; name: string }> {
  return Object.keys(state.procedures).filter((id) => !nextQuestion(state, 'procedure', id))
    .map((id) => ({ id, name: String(state.procedures[id].answers.name.value) }));
}
export function missingCompanyFields(state: CompanyKnowledge): string[] {
  return ONBOARDING_QUESTIONS.company.filter((question) => !own(state.company, question.id)).map((question) => question.id);
}
function cleanString(value: unknown): string {
  if (typeof value !== 'string') throw new OnboardingError('Provide text for this answer.');
  const text = value.trim();
  if (!text || text.length > 500 || /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/u.test(text)) throw new OnboardingError('Use 1–500 characters per answer or list item.');
  return text;
}
function validateAnswer(question: Question, value: unknown, state: CompanyKnowledge): AnswerValue {
  if (question.kind === 'list' || question.kind === 'permissions') {
    if (!Array.isArray(value) || value.length > 20 || (!question.allowEmpty && value.length === 0)) throw new OnboardingError('Use up to 20 items; this question requires a confirmed list.');
    const values = [...new Set(value.map(cleanString))];
    if (question.kind === 'permissions') {
      const allowed = new Set(completedProcedures(state).map((entry) => entry.id));
      if (values.some((id) => !allowed.has(id))) throw new OnboardingError('Choose only completed procedures from this company.');
    }
    return values;
  }
  const text = cleanString(value);
  if (question.options && !question.options.includes(text)) throw new OnboardingError('Choose one of the listed options.');
  if (question.id === 'timeZone') {
    try { new Intl.DateTimeFormat('en', { timeZone: text }).format(); }
    catch { throw new OnboardingError('Enter a valid time zone, such as America/Chicago.'); }
  }
  return text;
}

/** Only confirmed fields are copied into storage. Client identity/provenance fields are ignored. */
export function applyOnboardingChange(
  state: CompanyKnowledge, input: Record<string, unknown>,
  actor: { email: string; ownerEmail: string; role: string }, roster: RosterMember[],
  confirmedAt: string, newId: () => string = () => crypto.randomUUID(),
): CompanyKnowledge {
  if (actor.role !== 'owner' || actor.email !== actor.ownerEmail || !actor.ownerEmail) throw new OnboardingError('Only the company owner may confirm company knowledge.', 403);
  const next = structuredClone(state);
  if (input.action === 'add_procedure') {
    const id = newId();
    if (['__proto__', 'prototype', 'constructor'].includes(id) || !/^[a-zA-Z0-9_-]{1,128}$/.test(id) || Object.hasOwn(next.procedures, id)) throw new OnboardingError('Could not create a distinct procedure.', 409);
    next.procedures[id] = { answers: {} };
    return next;
  }
  const subjectId = typeof input.subjectId === 'string' ? input.subjectId : '';
  if (['__proto__', 'prototype', 'constructor'].includes(subjectId)) throw new OnboardingError('Invalid subject identifier.');
  if (input.action === 'begin_employee') {
    const member = roster.find((entry) => entry.id === subjectId);
    if (!member) throw new OnboardingError('Employee not found in this company.', 404);
    const existing = own(next.employees, subjectId);
    if (!existing || existing.identity !== employeeIdentity(member)) next.employees[subjectId] = { identity: employeeIdentity(member), answers: {} };
    return next;
  }
  if (input.action !== 'confirm' || input.confirmed !== true) throw new OnboardingError('Review the answer, then explicitly confirm it.');
  const target = input.target;
  if (target !== 'company' && target !== 'procedure' && target !== 'employee') throw new OnboardingError('Choose a valid interview section.');
  const question = ONBOARDING_QUESTIONS[target].find((entry) => entry.id === input.field);
  if (!question) throw new OnboardingError('Unknown interview question.');
  const answers = targetAnswers(next, target, subjectId);
  if (!answers) throw new OnboardingError('Start this procedure or employee interview first.', 409);
  if (target === 'employee') {
    const member = roster.find((entry) => entry.id === subjectId);
    if (!member || own(next.employees, subjectId)?.identity !== employeeIdentity(member)) throw new OnboardingError('Employee details changed. Reconfirm this employee’s profile.', 409);
  }
  answers[question.id] = { value: validateAnswer(question, input.value, next), confirmedBy: actor.email, confirmedAt };
  return next;
}
function text(answers: Answers, field: string): string { return answers[field].value as string; }
function list(answers: Answers, field: string): string[] { return [...answers[field].value as string[]]; }
export type KnowledgeResult = { ok: true; source: ZipContextSource } | { ok: false; code: string; message: string };
export function compileKnowledge(
  state: CompanyKnowledge, version: string, companyName: string, roster: RosterMember[], employeeId: string, presetId: string,
): KnowledgeResult {
  if (missingCompanyFields(state).length) return { ok: false, code: 'company_setup_required', message: 'The owner must finish confirming company information.' };
  const procedure = own(state.procedures, presetId);
  if (!procedure || nextQuestion(state, 'procedure', presetId)) return { ok: false, code: 'procedure_setup_required', message: 'Choose a complete, owner-confirmed job procedure.' };
  const member = roster.find((entry) => entry.id === employeeId);
  if (!member) return { ok: false, code: 'employee_not_found', message: 'Employee not found in this company.' };
  const profile = own(state.employees, employeeId);
  if (!profile || profile.identity !== employeeIdentity(member)) return { ok: false, code: 'employee_profile_changed', message: 'The owner must confirm this employee’s current identity and permissions.' };
  if (nextQuestion(state, 'employee', employeeId)) return { ok: false, code: 'employee_setup_required', message: 'The owner must finish this employee’s profile.' };
  const employee = profile.answers; const job = procedure.answers; const company = state.company;
  if (!list(employee, 'authorizedJobTypes').includes(presetId)) return { ok: false, code: 'job_not_authorized', message: 'This employee is not explicitly authorized for the selected procedure.' };
  const training = new Set(list(employee, 'training').map((value) => value.toLowerCase()));
  if (list(job, 'requiredTraining').some((value) => !training.has(value.toLowerCase()))) return { ok: false, code: 'training_not_confirmed', message: 'The owner must confirm the training required for this procedure.' };
  const scope = `${state.tenantId}:${version}`;
  const source: ZipContextSource = {
    company: { sourceId: `company:${scope}`, name: companyName, policies: list(company, 'policies'), services: text(company, 'services'), workingHours: text(company, 'workingHours'), timeZone: text(company, 'timeZone'), locations: list(company, 'locations'), escalationContact: text(company, 'escalationContact'), provenance: 'Owner-confirmed; not independently verified.' },
    presets: [{ id: presetId, sourceId: `procedure:${scope}:${presetId}`, name: text(job, 'name'), purpose: text(job, 'purpose'), steps: list(job, 'steps'), tools: list(job, 'tools'), safetyRules: list(job, 'safetyRules'), requiredTraining: list(job, 'requiredTraining'), evidence: list(job, 'evidence'), completionDefinition: text(job, 'completionDefinition') }],
    employees: [{ id: employeeId, sourceId: `employee:${scope}:${employeeId}`, displayName: member.name, role: member.role, department: text(employee, 'department'), authorizedJobTypes: list(employee, 'authorizedJobTypes'), training: list(employee, 'training'), preferredLanguage: text(employee, 'preferredLanguage'), communicationDetail: text(employee, 'communicationDetail') as 'brief' | 'standard' | 'detailed', tone: text(employee, 'tone') as 'friendly' | 'professional', responsibilities: list(employee, 'responsibilities') }],
  };
  if (JSON.stringify(source).length > 24_000) return { ok: false, code: 'company_context_too_large', message: 'Shorten this company profile or procedure before drafting. Important facts will not be silently removed.' };
  return { ok: true, source };
}
