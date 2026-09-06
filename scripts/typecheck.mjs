import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const hosting = JSON.parse(readFileSync(resolve(root, '.openai/hosting.json'), 'utf8'));
mkdirSync(resolve(root, '.next/zip-types'), { recursive: true });
mkdirSync(resolve(root, '.next/types'), { recursive: true });
// Type generation only. Real deployment bindings remain controlled by Sites.
const config = {
  name: 'zip-types-only',
  compatibility_date: '2026-04-01',
  compatibility_flags: ['nodejs_compat'],
  d1_databases: hosting.d1 ? [{ binding: hosting.d1, database_name: 'site-creator-d1', database_id: '00000000-0000-4000-8000-000000000000' }] : [],
  r2_buckets: hosting.r2 ? [{ binding: hosting.r2, bucket_name: 'site-creator-r2' }] : [],
};
writeFileSync(resolve(root, '.next/zip-types/wrangler.json'), JSON.stringify(config));
function run(script, args) {
  const result = spawnSync(process.execPath, [resolve(root, script), ...args], {
    cwd: root, stdio: 'inherit',
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false', WRANGLER_WRITE_LOGS: 'false' },
  });
  if (result.error || result.status !== 0) process.exit(result.status ?? 1);
}
run('node_modules/wrangler/bin/wrangler.js', ['types', '.next/types/cloudflare.d.ts', '--config', '.next/zip-types/wrangler.json']);
run('node_modules/typescript/bin/tsc', ['--noEmit', '--pretty', 'false']);
