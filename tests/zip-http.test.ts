import test from 'node:test';
import assert from 'node:assert/strict';
import { readZipJson, ZipRequestError } from '../lib/zip/http.ts';
const request = (body: string, headers: Record<string, string> = {}) => new Request('https://zip.example.com/api/zip/draft', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body });
const status = (expected: number) => (error: unknown) => error instanceof ZipRequestError && error.status === expected;

test('accepts a same-origin JSON object', async () => { assert.deepEqual(await readZipJson(request('{"employeeId":"crew-1"}', { origin: 'https://zip.example.com' })), { employeeId: 'crew-1' }); });
test('rejects cross-origin and cross-site browser writes', async () => {
  await assert.rejects(readZipJson(request('{}', { origin: 'https://attacker.example' })), status(403));
  await assert.rejects(readZipJson(request('{}', { 'sec-fetch-site': 'cross-site' })), status(403));
});
test('rejects malformed, null, array and primitive JSON bodies', async () => { for (const body of ['{', 'null', '[]', '"text"', '7']) await assert.rejects(readZipJson(request(body)), status(400)); });
test('rejects non-JSON requests', async () => { await assert.rejects(readZipJson(request('{}', { 'content-type': 'text/plain' })), status(415)); });
test('enforces actual UTF-8 bytes, not a caller supplied content length', async () => { await assert.rejects(readZipJson(request(JSON.stringify({ text: '界'.repeat(6000) }), { 'content-length': '2' })), status(413)); });
test('does not echo malformed body text in errors', async () => {
  try { await readZipJson(request('PRIVATE_INSTRUCTION')); assert.fail('must reject'); }
  catch (error) { assert.equal(String(error).includes('PRIVATE_INSTRUCTION'), false); }
});
