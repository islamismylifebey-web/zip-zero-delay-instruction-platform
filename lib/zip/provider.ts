import type { VerifiedZipContext } from './contracts.ts';
import { ZIP_RESPONSE_SCHEMA, ZIP_SYSTEM_PROMPT } from './prompt.ts';
export type ZipProvider = { generate(rawInstruction: string, context: VerifiedZipContext, signal: AbortSignal): Promise<unknown> };
type ResponsePayload = { output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
function extractOutputText(payload: ResponsePayload) { for (const item of payload.output ?? []) for (const content of item.content ?? []) if (content.type === 'output_text' && typeof content.text === 'string') return content.text; throw new Error('missing_output_text'); }
export function createOpenAIProvider(apiKey: string, fetcher: typeof fetch = fetch): ZipProvider {
  if (!apiKey.trim()) throw new Error('OPENAI_API_KEY is not configured');
  return { async generate(rawInstruction, context, signal) {
    const response = await fetcher('https://api.openai.com/v1/responses', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` }, signal, body: JSON.stringify({ model: 'gpt-5.6-luna', reasoning: { effort: 'low' }, store: false, input: [{ role: 'system', content: ZIP_SYSTEM_PROMPT }, { role: 'user', content: JSON.stringify({ verifiedContext: context, instruction: rawInstruction }) }], text: { format: { type: 'json_schema', name: 'zip_assignment', strict: true, schema: ZIP_RESPONSE_SCHEMA } } }) });
    if (!response.ok) throw new Error(`openai_${response.status}`);
    const payload = await response.json() as ResponsePayload;
    const parsed = JSON.parse(extractOutputText(payload)) as { result?: unknown };
    if (!parsed || typeof parsed !== 'object' || !('result' in parsed)) throw new Error('missing_result');
    return parsed.result;
  } };
}
