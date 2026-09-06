import type { VerifiedZipContext, ZipModelClarification, ZipModelReady, ZipModelResult } from './contracts.ts';
type InvalidResult = { status: 'invalid'; reasons: string[] };
function isRecord(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
function exactKeys(value: Record<string, unknown>, keys: string[]) { return Object.keys(value).sort().join('|') === [...keys].sort().join('|'); }
function stringArray(value: unknown, max = 20): value is string[] { return Array.isArray(value) && value.length <= max && value.every((item) => typeof item === 'string' && item.trim().length > 0 && item.length <= 500); }
function normalized(value: string) { return value.trim().toLowerCase().replace(/\s+/g, ' '); }
function validateChecklist(items: string[], context: VerifiedZipContext) { const allowed = [...context.company.policies, ...context.preset.steps, ...context.preset.safetyRules, ...context.preset.evidence, context.preset.completionDefinition].map(normalized); return items.every((item) => allowed.includes(normalized(item))); }
function containsUnsupportedConcreteDetail(text: string, context: VerifiedZipContext, instruction: string) {
  // The authenticated request may supply job-specific facts, but never new policies or checklist rules.
  // This string is used only during validation; it is not added to persisted company knowledge.
  const corpus = normalized(`${JSON.stringify(context)} ${instruction}`);
  const patterns = [/\b\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)\b/gi, /\b\d{1,6}\s+[A-Za-z0-9.' -]+(?:street|st\.?|road|rd\.?|avenue|ave\.?|drive|dr\.?|lane|ln\.?|boulevard|blvd\.?|court|ct\.?|parkway|pkwy\.?)\b/gi, /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/g];
  return patterns.some((pattern) => (text.match(pattern) ?? []).some((match) => !corpus.includes(normalized(match))));
}
export function validateZipModelResult(value: unknown, context: VerifiedZipContext, instruction = ''): ZipModelResult | InvalidResult {
  if (!isRecord(value) || typeof value.status !== 'string') return { status: 'invalid', reasons: ['not_an_object'] };
  if (value.status === 'needs_clarification') {
    if (!exactKeys(value, ['status', 'clarifyingQuestion', 'missingFields', 'conflictingFields'])) return { status: 'invalid', reasons: ['unexpected_fields'] };
    const question = value.clarifyingQuestion;
    if (typeof question !== 'string' || !question.trim() || question.length > 300 || (question.match(/\?/g) ?? []).length !== 1) return { status: 'invalid', reasons: ['invalid_question'] };
    if (!stringArray(value.missingFields, 20) || !stringArray(value.conflictingFields, 20)) return { status: 'invalid', reasons: ['invalid_fields'] };
    const result: ZipModelClarification = { status: 'needs_clarification', clarifyingQuestion: question.trim(), missingFields: value.missingFields, conflictingFields: value.conflictingFields };
    return result;
  }
  if (value.status === 'ready') {
    if (!exactKeys(value, ['status', 'professionalAssignment', 'sourceIds', 'checklist', 'unsupportedClaims'])) return { status: 'invalid', reasons: ['unexpected_fields'] };
    if (typeof value.professionalAssignment !== 'string' || !value.professionalAssignment.trim() || value.professionalAssignment.length > 4000) return { status: 'invalid', reasons: ['invalid_assignment'] };
    if (!stringArray(value.sourceIds, 10) || !stringArray(value.checklist, 20) || !Array.isArray(value.unsupportedClaims) || !value.unsupportedClaims.every((item) => typeof item === 'string')) return { status: 'invalid', reasons: ['invalid_shape'] };
    if (value.unsupportedClaims.length > 0) return { status: 'invalid', reasons: ['unsupported_claims'] };
    const allowedIds = new Set([context.company.sourceId, context.preset.sourceId, context.employee.sourceId]);
    if (!value.sourceIds.length || value.sourceIds.some((id) => !allowedIds.has(id))) return { status: 'invalid', reasons: ['invalid_source_id'] };
    if (!validateChecklist(value.checklist, context)) return { status: 'invalid', reasons: ['ungrounded_checklist'] };
    if (containsUnsupportedConcreteDetail(value.professionalAssignment, context, instruction)) return { status: 'invalid', reasons: ['unsupported_concrete_detail'] };
    const result: ZipModelReady = { status: 'ready', professionalAssignment: value.professionalAssignment.trim(), sourceIds: value.sourceIds, checklist: value.checklist, unsupportedClaims: [] };
    return result;
  }
  return { status: 'invalid', reasons: ['unknown_status'] };
}
