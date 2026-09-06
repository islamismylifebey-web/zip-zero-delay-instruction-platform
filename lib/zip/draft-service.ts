import { buildVerifiedContext } from './context.ts';
import type { ZipContextSource, ZipDraftRequest, ZipDraftResult } from './contracts.ts';
import { validateZipModelResult } from './output-validator.ts';
import type { ZipProvider } from './provider.ts';

type ZipLogEvent = { requestId: string; outcome: string; durationMs: number; errorCode?: string };
type DraftDeps = { source: ZipContextSource; provider: ZipProvider; logger?: (event: ZipLogEvent) => void; timeoutMs?: number; now?: () => number; randomId?: () => string };
export function createZipDraftService(deps: DraftDeps) {
  const logger = deps.logger ?? (() => undefined); const timeoutMs = deps.timeoutMs ?? 8000; const now = deps.now ?? Date.now; const randomId = deps.randomId ?? (() => crypto.randomUUID());
  return { async draft(request: ZipDraftRequest): Promise<ZipDraftResult> {
    const requestId = randomId(); const started = now(); const context = buildVerifiedContext(request, deps.source);
    if (!context.ok) { logger({ requestId, outcome: 'invalid_context', durationMs: now() - started, errorCode: context.code }); return { status: 'needs_clarification', clarifyingQuestion: 'The selected employee or job preset is not available for this assignment. Which approved employee and preset should I use?', fields: [context.code] }; }
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const providerValue = await deps.provider.generate(request.rawInstruction, context.context, controller.signal); const validated = validateZipModelResult(providerValue, context.context, request.rawInstruction);
      if (validated.status === 'invalid') { logger({ requestId, outcome: 'invalid_output', durationMs: now() - started, errorCode: validated.reasons.join(',') }); return { status: 'temporarily_unavailable', retryable: true, code: 'invalid_output' }; }
      if (validated.status === 'needs_clarification') { logger({ requestId, outcome: 'needs_clarification', durationMs: now() - started }); return { status: 'needs_clarification', clarifyingQuestion: validated.clarifyingQuestion, fields: [...validated.missingFields, ...validated.conflictingFields] }; }
      logger({ requestId, outcome: 'ready', durationMs: now() - started }); return { status: 'ready', draftId: randomId(), professionalAssignment: validated.professionalAssignment, checklist: validated.checklist };
    } catch (error) {
      const isTimeout = controller.signal.aborted || (error instanceof DOMException && error.name === 'AbortError'); const code = isTimeout ? 'timeout' : 'provider_error'; logger({ requestId, outcome: 'temporarily_unavailable', durationMs: now() - started, errorCode: code }); return { status: 'temporarily_unavailable', retryable: true, code };
    } finally { clearTimeout(timer); }
  } };
}
