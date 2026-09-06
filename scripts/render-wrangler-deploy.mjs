import { mkdir, writeFile } from 'node:fs/promises';

const required = ['CLOUDFLARE_D1_DATABASE_ID', 'CLOUDFLARE_D1_DATABASE_NAME', 'CLOUDFLARE_R2_BUCKET_NAME', 'ZIP_FRONTEND_ORIGINS', 'CLOUDFLARE_ACCESS_TEAM_DOMAIN', 'CLOUDFLARE_ACCESS_AUD'];
for (const name of required) {
  if (!process.env[name]?.trim()) {
    console.error(`Missing required deployment variable: ${name}`);
    process.exit(2);
  }
}
const d1Id = process.env.CLOUDFLARE_D1_DATABASE_ID.trim();
if (d1Id === '00000000-0000-4000-8000-000000000000') {
  console.error('Refusing placeholder D1 database ID.');
  process.exit(2);
}
const teamDomain = new URL(process.env.CLOUDFLARE_ACCESS_TEAM_DOMAIN.trim());
if (teamDomain.protocol !== 'https:') throw new Error('CLOUDFLARE_ACCESS_TEAM_DOMAIN must be HTTPS.');
const config = {
  $schema: 'node_modules/wrangler/config-schema.json',
  name: process.env.CLOUDFLARE_WORKER_NAME?.trim() || 'zip-zero-delay-backend',
  main: 'dist/server/index.js',
  compatibility_date: '2026-09-06',
  compatibility_flags: ['nodejs_compat'],
  d1_databases: [{ binding: 'DB', database_name: process.env.CLOUDFLARE_D1_DATABASE_NAME.trim(), database_id: d1Id }],
  r2_buckets: [{ binding: 'BUCKET', bucket_name: process.env.CLOUDFLARE_R2_BUCKET_NAME.trim() }],
  vars: {
    ZIP_FRONTEND_ORIGINS: process.env.ZIP_FRONTEND_ORIGINS.trim(),
    CLOUDFLARE_ACCESS_TEAM_DOMAIN: teamDomain.origin,
    CLOUDFLARE_ACCESS_AUD: process.env.CLOUDFLARE_ACCESS_AUD.trim(),
  },
};
await mkdir('.wrangler', { recursive: true });
await writeFile('.wrangler/deploy.json', `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
console.log('Generated .wrangler/deploy.json without application secrets.');
