import test from 'node:test';
import assert from 'node:assert/strict';
import * as api from '../lib/zip/api-origin.ts';
import * as cors from '../lib/zip/cors.ts';
import * as access from '../lib/zip/access-auth.ts';

test('API origin uses configured HTTPS backend and keeps non-API fetches unchanged', async () => {
  assert.equal(typeof api.zipApiUrl, 'function');
  assert.equal(api.zipApiUrl('/api/workspace', 'https://zip-api.example.com/'), 'https://zip-api.example.com/api/workspace');
  assert.equal(api.zipApiUrl('/privacy', 'https://zip-api.example.com'), '/privacy');
  assert.throws(() => api.zipApiUrl('/api/workspace', 'javascript:alert(1)'));
});

test('cutover fetch sends API cookies only to the configured backend', async () => {
  assert.equal(typeof api.createZipFetch, 'function');
  const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  const fakeFetch = (async (input: RequestInfo | URL, init?: RequestInit) => { calls.push({ input, init }); return new Response('{}'); }) as typeof fetch;
  const wrapped = api.createZipFetch(fakeFetch, 'https://zip-api.example.com');
  await wrapped('/api/workspace');
  await wrapped('https://example.org/public.json');
  assert.equal(String(calls[0].input), 'https://zip-api.example.com/api/workspace');
  assert.equal(calls[0].init?.credentials, 'include');
  assert.equal(String(calls[1].input), 'https://example.org/public.json');
});

test('credentialed CORS is exact-origin only and never wildcard', () => {
  assert.equal(typeof cors.zipCorsHeaders, 'function');
  const allowed = cors.zipCorsHeaders('https://zip.vercel.app', 'https://zip.vercel.app,https://zip.example.com');
  assert.equal(allowed['Access-Control-Allow-Origin'], 'https://zip.vercel.app');
  assert.equal(allowed['Access-Control-Allow-Credentials'], 'true');
  assert.ok((allowed.Vary ?? '').includes('Origin'));
  const rejected = cors.zipCorsHeaders('https://attacker.example', 'https://zip.vercel.app');
  assert.equal('Access-Control-Allow-Origin' in rejected, false);
  assert.notEqual(allowed['Access-Control-Allow-Origin'], '*');
});

test('Access JWT parser requires RS256, issuer, audience, expiry and email', () => {
  assert.equal(typeof access.validateAccessClaims, 'function');
  const now = 2_000_000_000;
  const valid = access.validateAccessClaims({ iss: 'https://team.cloudflareaccess.com', aud: ['app-aud'], exp: now + 60, email: 'Owner@Example.com' }, { issuer: 'https://team.cloudflareaccess.com', audience: 'app-aud', now });
  assert.deepEqual(valid, { email: 'owner@example.com', displayName: 'owner@example.com' });
  assert.throws(() => access.validateAccessClaims({ iss: 'https://evil.example', aud: ['app-aud'], exp: now + 60, email: 'owner@example.com' }, { issuer: 'https://team.cloudflareaccess.com', audience: 'app-aud', now }));
  assert.throws(() => access.validateAccessClaims({ iss: 'https://team.cloudflareaccess.com', aud: ['wrong'], exp: now + 60, email: 'owner@example.com' }, { issuer: 'https://team.cloudflareaccess.com', audience: 'app-aud', now }));
  assert.throws(() => access.validateAccessClaims({ iss: 'https://team.cloudflareaccess.com', aud: ['app-aud'], exp: now - 1, email: 'owner@example.com' }, { issuer: 'https://team.cloudflareaccess.com', audience: 'app-aud', now }));
});

test('JWT verification rejects unsigned or malformed tokens before trusting email', async () => {
  assert.equal(typeof access.verifyCloudflareAccessJwt, 'function');
  await assert.rejects(access.verifyCloudflareAccessJwt('not-a-jwt', { issuer: 'https://team.cloudflareaccess.com', audience: 'app-aud', fetch }));
});

test('wrangler deploy config points from .wrangler to the built worker artifact', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../scripts/render-wrangler-deploy.mjs', import.meta.url), 'utf8');
  assert.match(source, /main:\s*'\.\.\/dist\/server\/index\.js'/);
});

test('Vercel webpack replaces the Cloudflare workers URI scheme', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../next.config.ts', import.meta.url), 'utf8');
  assert.match(source, /NormalModuleReplacementPlugin/);
  assert.match(source, /\^cloudflare:workers\$/);
});

test('Vercel typechecking recognizes the Cloudflare worker module shim', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../types/cloudflare-workers.d.ts', import.meta.url), 'utf8');
  assert.match(source, /declare module "cloudflare:workers"/);
});
