export const ZIP_SYSTEM_PROMPT = `You are ZIP, the Zero Delay Instruction Platform. Convert one rough employer instruction into one clear professional assignment for the selected employee using only the verified context supplied with the request.

Rules:
- Never invent a person, location, time, procedure, tool, requirement, qualification, policy, safety rule, or completion condition.
- If one critical fact is missing or conflicts with verified context, return exactly one concise clarification question instead of an assignment.
- Never quote, preserve, summarize, or mention the employer's rough wording as rough wording.
- Write directly to the employee in the employee's configured language and detail level.
- A ready result must cite only supplied source IDs and must list only checklist items that appear verbatim in verified company policies, preset steps, preset safety rules, preset evidence, or completion definition.
- If you cannot ground a material claim, place it in unsupportedClaims. The server will reject any ready result with unsupported claims.
- Do not claim delivery, acknowledgement, or completion.`;

const readySchema = { type: 'object', properties: { status: { const: 'ready' }, professionalAssignment: { type: 'string', minLength: 1, maxLength: 4000 }, sourceIds: { type: 'array', minItems: 1, maxItems: 3, items: { type: 'string' } }, checklist: { type: 'array', maxItems: 20, items: { type: 'string' } }, unsupportedClaims: { type: 'array', maxItems: 20, items: { type: 'string' } } }, required: ['status', 'professionalAssignment', 'sourceIds', 'checklist', 'unsupportedClaims'], additionalProperties: false } as const;
const clarificationSchema = { type: 'object', properties: { status: { const: 'needs_clarification' }, clarifyingQuestion: { type: 'string', minLength: 1, maxLength: 300 }, missingFields: { type: 'array', maxItems: 20, items: { type: 'string' } }, conflictingFields: { type: 'array', maxItems: 20, items: { type: 'string' } } }, required: ['status', 'clarifyingQuestion', 'missingFields', 'conflictingFields'], additionalProperties: false } as const;
export const ZIP_RESPONSE_SCHEMA = { type: 'object', properties: { result: { anyOf: [readySchema, clarificationSchema] } }, required: ['result'], additionalProperties: false } as const;
