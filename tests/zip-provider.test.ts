import test from 'node:test';
import assert from 'node:assert/strict';
import { createOpenAIProvider } from '../lib/zip/provider.ts';
import { buildVerifiedContext } from '../lib/zip/context.ts';
import { phase1FixtureSource } from '../lib/zip/fixtures.ts';

type ProviderRequest = {
  model: string;
  reasoning: { effort: string };
  store: boolean;
  text: { format: { type: string; schema: { type: string; properties: { result: { anyOf: Array<{ properties: { status: { enum: string[] } } }> } } } } };
};

test('provider uses Responses API, Luna, low reasoning, store false, structured output, and reports token usage', async () => {
  let url = ''; let body = {} as ProviderRequest; let auth = ''; let usage: unknown;
  const fetcher = async (input: string | URL | Request, init?: RequestInit) => {
    url = String(input); body = JSON.parse(String(init?.body)) as ProviderRequest;
    auth = String((init?.headers as Record<string, string>)?.authorization ?? '');
    return new Response(JSON.stringify({ output: [{ content: [{ type: 'output_text', text: JSON.stringify({ result: { status: 'needs_clarification', clarifyingQuestion: 'Which entrance?', missingFields: ['location'], conflictingFields: [] } }) }] }], usage: { input_tokens: 123, output_tokens: 45, total_tokens: 168 } }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const c = buildVerifiedContext({ employeeId: 'employee-demo', presetId: 'floor-care', rawInstruction: 'Clean it' }, phase1FixtureSource);
  assert.equal(c.ok, true); if (!c.ok) return;
  const provider = createOpenAIProvider('unit-test-value', fetcher as typeof fetch, (value) => { usage = value; });
  await provider.generate('Clean it', c.context, new AbortController().signal);
  assert.equal(url, 'https://api.openai.com/v1/responses'); assert.equal(body.model, 'gpt-5.6-luna');
  assert.equal(body.reasoning.effort, 'low'); assert.equal(body.store, false);
  assert.equal(body.text.format.type, 'json_schema'); assert.equal(body.text.format.schema.type, 'object');
  assert.equal(Array.isArray(body.text.format.schema.properties.result.anyOf), true);
  assert.deepEqual(body.text.format.schema.properties.result.anyOf[0].properties.status.enum, ['ready']);
  assert.equal(auth, 'Bearer unit-test-value'); assert.deepEqual(usage, { inputTokens: 123, outputTokens: 45, totalTokens: 168 });
});
