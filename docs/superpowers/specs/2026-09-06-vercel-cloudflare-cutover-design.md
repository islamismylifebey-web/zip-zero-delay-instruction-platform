# ZIP Vercel Frontend / Cloudflare Backend Cutover Design

## Goal

Move ZIP off its temporary ChatGPT Sites production path into a split production architecture where Vercel serves only the public-facing frontend and Cloudflare is the single authoritative backend for authentication-sensitive APIs, D1, R2, OpenAI calls, company knowledge, employee feedback, and assignment approval.

## Production topology

`Browser -> Vercel frontend -> Cloudflare backend -> D1 / R2 / OpenAI`

The existing Sites deployment remains intact as rollback until the new path is verified. It is deleted only after successful cutover validation.

## Frontend boundary

Vercel must not host ZIP's authoritative API implementation or possess backend-only secrets. Browser code calls one configured backend origin. Frontend behavior includes routing, rendering, browser speech capture/read-aloud, onboarding UI, health UI, feedback UI, and assignment review UI.

The frontend may receive only public configuration needed to locate the backend, such as `NEXT_PUBLIC_ZIP_API_ORIGIN`. No OpenAI key, Cloudflare API token, D1 credential, R2 secret, session signing secret, or other privileged value may enter browser bundles, GitHub source, build logs, or client-visible environment variables.

## Backend boundary

Cloudflare owns all server-authoritative routes currently under `/api/*`, including workspace, company logo, ZIP onboarding, draft, approval, feedback, and authenticated data reads/writes. D1 and R2 remain bound only to Cloudflare runtime code. OpenAI calls execute only from Cloudflare using server-side secrets.

Cloudflare backend responses use explicit CORS allowlisting for the approved Vercel production origin and any explicitly approved preview origin policy. Requests requiring authentication retain the existing server-side role/tenant/assignment checks and must not trust caller-supplied owner identity.

## Authentication

The current ChatGPT/Sites authentication helpers cannot be assumed to work unchanged when frontend and backend live on different origins. The cutover must preserve signed-in identity and company membership without weakening tenant isolation.

Preferred implementation: Cloudflare remains the authentication authority and exposes a session endpoint; Vercel frontend forwards users into the existing sign-in flow and sends authenticated API requests with credentials. Cookies must use production-safe attributes and the backend must verify origin/CSRF expectations. If the current Sites-specific authentication runtime cannot issue a reusable cross-origin session, the cutover must stop rather than silently replacing authentication with a weaker mechanism.

## Data and migrations

Existing production data must remain authoritative. Do not create a second D1 database just to make deployment easier. Apply migrations in order through:

- `0005_zip_company_knowledge.sql`
- `0006_zip_employee_feedback.sql`

The backend must use the same intended production D1/R2 resources after cutover. No destructive reset, test fixture import, or data copy is authorized by this design.

## Secrets

Secrets are moved to the systems that actually need them:

- OpenAI key: Cloudflare backend only.
- Cloudflare deployment/API credential: deployment control plane only, never application runtime/browser source.
- Vercel: public backend-origin configuration only unless a future frontend-only secret is genuinely required.

After the new path is proven, obsolete secret copies from Sites or other superseded locations are removed. Any secret that was previously exposed to a place that did not need it should be rotated rather than merely copied.

## Routing and compatibility

Frontend fetches must use a small shared API-origin helper rather than hard-coded `/api/...` assumptions. During local development the helper may default to same-origin; production Vercel requires the Cloudflare backend origin.

Cloudflare backend must retain the current API contracts so frontend behavior does not fork. Existing ZIP approval idempotency, knowledge-version checks, employee feedback boundaries, and company separation remain unchanged.

## Deployment sequence

1. Prepare split-compatible code on an isolated branch.
2. Verify tests/build/typecheck/lint with no secrets.
3. Deploy Cloudflare backend and apply production migrations.
4. Smoke-test backend health/auth/data paths directly without exposing secrets.
5. Deploy Vercel frontend configured to call that backend.
6. Run signed-in end-to-end owner onboarding -> health -> procedure/employee setup -> draft/review/approval -> employee job -> employee feedback -> owner review.
7. Run live ZIP model behavior evals.
8. Verify stale draft, permission revocation, cross-company denial, angry/professional/safety tone, and real microphone behavior.
9. Remove obsolete secrets from the old Sites deployment/source locations and rotate any secret whose prior placement was unnecessarily broad.
10. Only after all above gates pass, delete the Sites deployment.

## Rollback

Until Step 10, Sites is the rollback copy. If Cloudflare auth, data access, Vercel routing, or model behavior fails, the new cutover is not considered complete and Sites remains untouched.

## Success criteria

- Vercel serves the user-facing application.
- Browser network calls target Cloudflare for authoritative API operations.
- Cloudflare alone accesses D1, R2, OpenAI, and privileged runtime secrets.
- Existing production data is preserved.
- Cross-company and permission tests continue to fail closed.
- No backend secret appears in frontend source, browser bundles, GitHub history added by this cutover, or user-visible logs.
- Production migrations 0005 and 0006 are confirmed applied.
- Live model evals and authenticated E2E pass.
- Sites remains available until all verification evidence exists.
