import test from 'node:test';
import assert from 'node:assert/strict';
import { createOpenAIProvider } from '../lib/zip/provider.ts';
import { buildVerifiedContext } from '../lib/zip/context.ts';
import { phase1FixtureSource } from '../lib/zip/fixtures.ts';

test('provider uses Responses API, Luna, low reasoning, store false, and structured output', async () => {
  let url = ''; let body: any; let auth = '';
  const fetcher = async (input: string | URL | Request, init?: RequestInit) => {
    url = String(input); body = JSON.parse(String(init?.body)); auth = String((init?.headers as Record<string,string>)?.authorization ?? '');
    return new Response(JSON.stringify({ output: [{ content: [{ type: 'output_text', text: JSON.stringify({ status: 'needs_clarification', clarifyingQuestion: 'Which entrance?', missingFields: ['location'], conflictingFields: [] }) }] }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const c = buildVerifiedContext({ employeeId: 'employee-demo', presetId: 'floor-care', rawInstruction: 'Clean it' }, phase1FixtureSource);
  assert.equal(c.ok, true); if (!c.ok) return;
  const provider = createOpenAIProvider('unit-test-value', fetcher as typeof fetch);
  await provider.generate('Clean it', c.context, new AbortController().signal);
  assert.equal(url, 'https://api.openai.com/v1/responses');
  assert.equal(body.model, 'gpt-5.6-luna'); assert.equal(body.reasoning.effort, 'low'); assert.equal(body.store, false); assert.equal(body.text.format.type, 'json_schema'); assert.equal(auth, 'Bearer unit-test-value');
});
