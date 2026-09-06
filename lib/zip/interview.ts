import { employeeIdentity, missingCompanyFields, nextQuestion, OnboardingError, type AnswerValue, type CompanyKnowledge, type OnboardingTarget, type Question, type RosterMember } from './onboarding.ts';
export function reviewAnswer(question: Question, raw: string, selected: string[], none: boolean): AnswerValue {
  if (none) {
    if (!question.allowEmpty || raw.trim() || selected.length) throw new OnboardingError('Clear the answer before explicitly choosing none.');
    return [];
  }
  if (question.kind === 'permissions') {
    if (!selected.length) throw new OnboardingError('Choose approved procedures, or explicitly select no authorization.');
    return [...selected];
  }
  if (!raw.trim()) throw new OnboardingError('Answer the question before reviewing it.');
  return question.kind === 'list' ? raw.split(/\r?\n/).map((item) => item.trim()).filter(Boolean) : raw.trim();
}
export function resumeTarget(state: CompanyKnowledge, crew: RosterMember[]): { target: OnboardingTarget; subjectId: string } {
  if (missingCompanyFields(state).length) return { target: 'company', subjectId: '' };
  const procedureId = Object.keys(state.procedures).find((id) => nextQuestion(state, 'procedure', id));
  if (procedureId) return { target: 'procedure', subjectId: procedureId };
  if (!Object.keys(state.procedures).length) return { target: 'company', subjectId: '' };
  const member = crew.find((entry) => !Object.hasOwn(state.employees, entry.id) || state.employees[entry.id].identity !== employeeIdentity(entry) || nextQuestion(state, 'employee', entry.id));
  return member ? { target: 'employee', subjectId: member.id } : { target: 'company', subjectId: '' };
}
