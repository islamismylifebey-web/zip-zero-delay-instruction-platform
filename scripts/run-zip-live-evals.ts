import { createZipDraftService } from '../lib/zip/draft-service.ts';
import { createOpenAIProvider, type ZipTokenUsage } from '../lib/zip/provider.ts';
import { phase1FixtureSource } from '../lib/zip/fixtures.ts';

if (process.env.ZIP_LIVE_EVALS !== '1') { console.log('ZIP live evals: SKIPPED. Set ZIP_LIVE_EVALS=1 to run; this is not a PASS.'); process.exit(0); }
const apiKey = process.env.OPENAI_API_KEY?.trim(); if (!apiKey) { console.error('ZIP live evals: BLOCKED. OPENAI_API_KEY is required.'); process.exit(2); }
type LiveCase = { name: string; presetId: string; instruction: string; acceptable: Array<'ready' | 'needs_clarification'>; requiredChecklist?: string };
const cases: LiveCase[] = [
  { name: 'complete floor job', presetId: 'floor-care', instruction: 'Clean the assigned lobby floor and report completion.', acceptable: ['ready'] },
  { name: 'missing location', presetId: 'floor-care', instruction: 'Clean the floor.', acceptable: ['needs_clarification'] },
  { name: 'conflicting time', presetId: 'floor-care', instruction: 'Complete the assigned floor at 2 PM and 4 PM.', acceptable: ['needs_clarification'] },
  { name: 'safety signs', presetId: 'floor-care', instruction: 'Clean the assigned floor safely.', acceptable: ['ready'], requiredChecklist: 'Place wet-floor signs before cleaning.' },
  { name: 'scope control', presetId: 'general-field-service', instruction: 'Complete the assigned field task only.', acceptable: ['ready'] },
  { name: 'missing procedure', presetId: 'general-field-service', instruction: 'Use the special unlisted procedure.', acceptable: ['needs_clarification'] },
  { name: 'missing tool', presetId: 'floor-care', instruction: 'Use the special machine to clean the assigned floor.', acceptable: ['needs_clarification'] },
  { name: 'unsupported address trap', presetId: 'general-field-service', instruction: 'Complete the work at the assigned location.', acceptable: ['ready', 'needs_clarification'] },
  { name: 'completion evidence', presetId: 'general-field-service', instruction: 'Complete the assigned task and report it.', acceptable: ['ready'] }
];
let passed = 0; let totalUsage: ZipTokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
for (const item of cases) {
  let usage: ZipTokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  const provider = createOpenAIProvider(apiKey, fetch, (value) => { usage = value; }); const service = createZipDraftService({ source: phase1FixtureSource, provider, logger: () => undefined }); const started = Date.now();
  const result = await service.draft({ employeeId: 'employee-demo', presetId: item.presetId, rawInstruction: item.instruction });
  const checklistOk = !item.requiredChecklist || (result.status === 'ready' && result.checklist.includes(item.requiredChecklist)); const ok = item.acceptable.includes(result.status as 'ready' | 'needs_clarification') && checklistOk; if (ok) passed += 1;
  totalUsage = { inputTokens: totalUsage.inputTokens + usage.inputTokens, outputTokens: totalUsage.outputTokens + usage.outputTokens, totalTokens: totalUsage.totalTokens + usage.totalTokens };
  console.log(JSON.stringify({ case: item.name, status: result.status, latencyMs: Date.now() - started, usage, pass: ok }));
}
const timeoutService = createZipDraftService({ source: phase1FixtureSource, provider: { generate: async (_raw, _context, signal) => await new Promise((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true })) }, logger: () => undefined, timeoutMs: 5 });
const timeoutResult = await timeoutService.draft({ employeeId: 'employee-demo', presetId: 'floor-care', rawInstruction: 'Clean the assigned floor.' }); const timeoutPass = timeoutResult.status === 'temporarily_unavailable' && timeoutResult.code === 'timeout'; if (timeoutPass) passed += 1;
console.log(JSON.stringify({ case: 'provider timeout', status: timeoutResult.status, pass: timeoutPass })); console.log(JSON.stringify({ summary: `${passed}/10`, totalUsage, pass: passed === 10 })); process.exit(passed === 10 ? 0 : 1);
