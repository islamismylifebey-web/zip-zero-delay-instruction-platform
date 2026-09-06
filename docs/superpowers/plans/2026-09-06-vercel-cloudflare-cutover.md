# ZIP Vercel / Cloudflare Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy ZIP with a Vercel-hosted frontend and a Cloudflare-hosted authoritative backend while preserving production data, authentication, tenant isolation, and rollback through the existing Sites deployment.

**Architecture:** Browser code uses one configurable API-origin helper. Vercel serves frontend routes/assets only; Cloudflare owns authenticated APIs, D1/R2 bindings, OpenAI calls, and secrets. Sites remains untouched until the new production chain is proven.

**Tech Stack:** TypeScript, React/Next/vinext, Vercel, Cloudflare Workers/D1/R2, OpenAI Responses API, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-06-vercel-cloudflare-cutover-design.md`

## Global Constraints

- Do not delete or modify the existing Sites deployment until the new production chain is verified.
- Do not expose or print secrets.
- Do not create a replacement production D1 database unless the owner explicitly authorizes a data migration.
- Preserve current API contracts, authorization checks, tenant isolation, approval idempotency, onboarding knowledge versioning, and employee feedback boundaries.
- Vercel frontend receives only public backend-origin configuration unless a later requirement proves otherwise.
- Cloudflare is the only runtime allowed to hold OpenAI/D1/R2 privileged access.
- Apply production migrations through `0006_zip_employee_feedback.sql` before enabling new routes.

---

### Task 1: Introduce an explicit frontend/backend boundary

**Files:**
- Create: `lib/zip/api-origin.ts`
- Modify: browser clients that call `/api/*`, including `app/zip-chat.tsx`, `app/onboarding/zip-onboarding.tsx`, `app/feedback/feedback-client.tsx`, and any client-side workspace/logo callers that must run from Vercel.
- Test: `tests/zip-api-origin.test.ts`

**Interfaces:**
- Produces: `zipApiUrl(path: string): string` and `zipFetch(path: string, init?: RequestInit): Promise<Response>`.
- Uses: `NEXT_PUBLIC_ZIP_API_ORIGIN` in production browser builds; same-origin fallback only for local/test environments.

- [ ] **Step 1: Write the failing API-origin tests**

Assert that absolute backend origin is used when configured, paths are normalized, non-HTTP(S) values are rejected, and same-origin fallback remains available only when no public origin is configured.

- [ ] **Step 2: Run targeted test and verify RED**

Run: `node --experimental-strip-types --test tests/zip-api-origin.test.ts`
Expected: FAIL because helper does not exist.

- [ ] **Step 3: Implement minimal API-origin helper**

Create a tiny module that validates `http:`/`https:` origins, strips trailing slashes, joins only application-controlled relative paths beginning with `/`, and defaults to same-origin when unconfigured.

- [ ] **Step 4: Replace browser-side authoritative API fetches**

Use `zipFetch('/api/...')` instead of raw same-origin `fetch('/api/...')`. Preserve `credentials: 'include'` for authenticated calls and existing cache/method/headers/body behavior.

- [ ] **Step 5: Run ZIP tests and full typecheck**

Run: `npm run test:zip && node scripts/typecheck.mjs`
Expected: PASS.

- [ ] **Step 6: Commit**

Commit message: `feat: route ZIP frontend API calls through configurable backend origin`.

---

### Task 2: Make Cloudflare APIs safe for cross-origin Vercel requests

**Files:**
- Create: `lib/zip/cors.ts`
- Modify: authoritative API routes under `app/api/workspace`, `app/api/company-logo`, `app/api/zip/onboarding`, `app/api/zip/draft`, `app/api/zip/approve`, and `app/api/zip/feedback`.
- Test: `tests/zip-cors.test.ts`

**Interfaces:**
- Produces: `withZipCors(request: Request, response: Response): Response`, `handleZipOptions(request: Request): Response | null`, `isAllowedZipOrigin(origin: string): boolean`.
- Configuration: server-side `ZIP_FRONTEND_ORIGINS` as a comma-separated allowlist; never wildcard credentials.

- [ ] **Step 1: Write failing CORS tests**

Test approved Vercel origin, rejected foreign origin, credentialed response headers, `Vary: Origin`, OPTIONS handling, and no `Access-Control-Allow-Origin: *`.

- [ ] **Step 2: Verify RED**

Run: `node --experimental-strip-types --test tests/zip-cors.test.ts`
Expected: FAIL because helper does not exist.

- [ ] **Step 3: Implement strict origin allowlist**

Allow only exact configured HTTPS origins plus localhost development origins when `NODE_ENV !== 'production'`. Return credentialed CORS headers only for allowed origins.

- [ ] **Step 4: Wrap authoritative API responses and OPTIONS**

Do not weaken existing auth, CSRF, role, tenant, assignment, or version checks. CORS grants browser transport permission only; it is not authorization.

- [ ] **Step 5: Run targeted and full tests**

Run: `npm run test:zip && npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

Commit message: `feat: allow credentialed ZIP frontend requests from approved origins`.

---

### Task 3: Verify the authentication model across Vercel and Cloudflare

**Files:**
- Inspect/modify only as required: `app/chatgpt-auth.ts`, sign-in/sign-out routes/helpers, `lib/workspace-server.ts`, frontend entry routes.
- Create if needed: `app/api/session/route.ts` and `tests/zip-cross-origin-auth.test.ts`.

**Interfaces:**
- Produces: one server-authoritative session read usable by Vercel frontend.
- Requirement: cookies/session tokens must be scoped and issued so Cloudflare receives them from browser API requests without exposing raw credentials to frontend JavaScript.

- [ ] **Step 1: Inspect current authentication dependencies and identify whether Sites-only runtime assumptions exist**

If the existing auth cannot operate on the Cloudflare backend origin, stop deployment and document the exact blocker instead of replacing it with weaker auth.

- [ ] **Step 2: Write failing tests for any required auth adaptation**

Cover unauthenticated access, owner/employee resolution, credentials transport, foreign-origin rejection, and no caller-supplied tenant authority.

- [ ] **Step 3: Implement the minimum safe adaptation**

Keep authentication server-side. Do not store bearer/session secrets in localStorage or browser-readable source.

- [ ] **Step 4: Run security-sensitive tests**

Run: `npm run test:zip && npm test && node scripts/typecheck.mjs && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat: preserve ZIP authentication across split frontend and backend origins`.

---

### Task 4: Package the Cloudflare backend deployment

**Files:**
- Inspect/modify: Cloudflare/Vite/hosting config, `wrangler` configuration, build scripts, route export/runtime entrypoint.
- Create: deployment documentation or workflow only if the repository lacks a safe existing deployment path.
- Test: artifact validation plus a backend-route smoke test.

**Interfaces:**
- Cloudflare bindings: existing production `DB` D1 and `BUCKET` R2.
- Server secrets: `OPENAI_API_KEY`, allowed frontend origins, and any required auth secret/runtime configuration.

- [ ] **Step 1: Confirm the current Cloudflare runtime artifact can serve backend routes independently**

Use build output and route manifests; do not assume the Sites wrapper is equivalent to a standalone Worker deployment.

- [ ] **Step 2: Add only the minimal deployment config needed for standalone Cloudflare backend**

Preserve existing D1/R2 binding names. Do not hard-code account IDs, database IDs, or secrets in source if they are currently environment-controlled.

- [ ] **Step 3: Verify migrations are present and ordered**

Confirm `0005_zip_company_knowledge.sql` then `0006_zip_employee_feedback.sql`.

- [ ] **Step 4: Run full build/artifact verification**

Run: `npm test && node scripts/typecheck.mjs && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `build: prepare ZIP backend for standalone Cloudflare deployment`.

---

### Task 5: Package the Vercel frontend without backend secrets

**Files:**
- Add/modify Vercel project configuration only if needed.
- Add environment documentation for `NEXT_PUBLIC_ZIP_API_ORIGIN`.
- Verify browser bundle does not contain backend secrets or server API implementation assumptions.

**Interfaces:**
- Vercel environment: `NEXT_PUBLIC_ZIP_API_ORIGIN=https://<cloudflare-backend-origin>`.
- No OpenAI/D1/R2/Cloudflare deployment credentials in Vercel browser environment.

- [ ] **Step 1: Build frontend with a test backend origin**

Verify rendered client code uses the configured backend origin.

- [ ] **Step 2: Scan generated output for known secret-variable names and server-only config leakage**

Search for `OPENAI_API_KEY`, Cloudflare API-token names, D1 database identifiers if sensitive, and any copied secret literals. Expected: no secret values and no frontend access to server-only env names.

- [ ] **Step 3: Verify frontend routes build without requiring D1/R2 bindings at browser runtime**

If server-rendered Vercel routes still import Cloudflare bindings, split those imports before deployment.

- [ ] **Step 4: Run frontend production build**

Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `build: prepare ZIP frontend for Vercel deployment`.

---

### Task 6: Deploy Cloudflare backend and preserve production data

**Operational actions:**
- Use an authorized Cloudflare deployment channel.
- Apply migrations `0005` and `0006` to the intended existing production D1 database.
- Configure backend secrets and `ZIP_FRONTEND_ORIGINS` without printing values.

- [ ] **Step 1: Confirm exact target account/project/Worker and production D1/R2 bindings**

Do not deploy if target identity is ambiguous.

- [ ] **Step 2: Apply migrations in order**

Record success/failure metadata, not secret values or private row contents.

- [ ] **Step 3: Deploy backend revision from the cutover branch**

- [ ] **Step 4: Smoke-test health/auth/API behavior directly**

Test unauthenticated denial, allowed origin CORS, forbidden foreign origin, company isolation, and a read path that proves D1 connectivity without exposing data.

- [ ] **Step 5: Record backend production origin for Vercel config**

---

### Task 7: Deploy Vercel frontend

**Operational actions:**
- Create/import the ZIP Vercel project from the canonical GitHub repo if not already present.
- Configure public backend origin.
- Deploy production frontend from the verified cutover revision.

- [ ] **Step 1: Confirm/create the ZIP Vercel project linked to the canonical repo**

- [ ] **Step 2: Set only required Vercel environment values**

No backend secret duplication.

- [ ] **Step 3: Deploy production frontend**

- [ ] **Step 4: Fetch the deployed URL and verify primary pages render**

- [ ] **Step 5: Verify browser API traffic targets Cloudflare backend**

---

### Task 8: Production cutover verification

**Operational actions:**
- Run signed-in owner/employee workflow on the new Vercel + Cloudflare chain.
- Run live ZIP model evaluation gate.

- [ ] **Step 1: Owner setup flow**

Create/resume onboarding, review health, configure procedure and employee permissions.

- [ ] **Step 2: Assignment flow**

Draft, review, approve, confirm employee job receipt, send employee feedback, and confirm owner health review.

- [ ] **Step 3: Security/reliability cases**

Exercise stale draft, revoked permission, wrong tenant, foreign origin, unauthenticated access, and duplicate approval retry.

- [ ] **Step 4: Live model evals**

Run with explicit live-eval flag and securely configured OpenAI key. Angry/professional/safety/override cases must meet the existing release contract.

- [ ] **Step 5: Real microphone test**

Confirm voice fallback and browser disclosure behavior on at least one supported browser/device.

---

### Task 9: Secret cleanup and Sites retirement handoff

**Operational actions:**
- Inspect secret placement after successful cutover.
- Remove obsolete copies only after new chain is proven.
- Rotate secrets whose old placement was unnecessarily broad.

- [ ] **Step 1: Confirm new production chain remains healthy after secret cleanup**

- [ ] **Step 2: Produce a deletion-ready statement for the owner**

State the verified Vercel URL, Cloudflare backend identity, migrations, E2E result, live-eval result, and rollback status.

- [ ] **Step 3: Owner deletes Sites deployment**

Deletion remains an explicit owner action after successful verification; this implementation does not pre-emptively remove the rollback copy.
