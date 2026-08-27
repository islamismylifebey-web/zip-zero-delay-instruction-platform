# ZIP Chatbot-First Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish ZIP's permanent project home, then build and prove the complete GPT-5.6 Luna chatbot workflow before expanding the workforce platform.

**Architecture:** A server-owned drafting pipeline loads verified company, preset, and employee context, calls GPT-5.6 Luna through a narrow provider interface, validates structured output, and returns either a professional assignment or one clarification. The raw employer message remains request-scoped and is never persisted; only an employer-approved professional assignment crosses into the existing employee workflow.

**Tech Stack:** TypeScript, React 19, Next.js/Vinext, Cloudflare Workers/Sites, D1/Drizzle, OpenAI Responses API, Node test runner, GitHub, GALOR Hub.

**Spec:** `docs/superpowers/specs/2026-08-27-zip-zero-delay-instruction-platform-design.md`

## Global Constraints

- Product name: `ZIP — Zero Delay Instruction Platform`.
- Tagline: `Say it. ZIP it. Get it done.`
- Model: `gpt-5.6-luna` through the Responses API.
- Fast Mode reasoning: `low`.
- Never escalate models automatically.
- Never persist, log, display, export, analyze, or send the raw employer instruction.
- Never invent unsupported people, times, locations, procedures, requirements, or safety rules.
- Employer approval is mandatory before employee handoff.
- Phase 2 work is blocked until the chatbot-first release gate passes.

---

## File structure

- `lib/zip/contracts.ts`: stable ZIP input, context, result, and approval types.
- `lib/zip/context.ts`: builds minimal verified model context from presets and employee profiles.
- `lib/zip/output-validator.ts`: parses and grounds model output against verified source IDs.
- `lib/zip/prompt.ts`: one lean system prompt and structured output schema.
- `lib/zip/provider.ts`: provider interface and OpenAI Responses API adapter.
- `lib/zip/draft-service.ts`: timeout, provider call, validation, clarification, and safe result orchestration.
- `lib/zip/approval.ts`: converts a reviewed draft into the only persistable assignment shape.
- `lib/zip/fixtures.ts`: Phase 1 representative company, preset, and employee fixtures.
- `app/api/zip/draft/route.ts`: authenticated employer-only draft endpoint.
- `app/api/zip/approve/route.ts`: authenticated approval and employee handoff endpoint.
- `app/zip-chat.tsx`: chatbot-first employer interface.
- `tests/zip-*.test.ts`: unit, API, privacy, failure, and evaluation gates.
- `.env.example`: server-side OpenAI variable names without values.

### Task 1: Establish ZIP as the permanent project

**Files:**
- Modify: `package.json`
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `app/layout.tsx`
- Modify in GALOR Hub: `PROJECT-INDEX.md`
- Modify in GALOR Hub: `registry/projects.yaml`

**Interfaces:**
- Consumes: existing Sites repository and published rollback point.
- Produces: canonical ZIP GitHub repository on `main`, GALOR registry entry, and documented Sites rollback reference.

- [ ] **Step 1: Record the verified migration source**

Run `git remote -v`, `git branch --show-current`, `git rev-parse HEAD`, and read `.openai/hosting.json`. Save the nonsecret source URL, `main` branch, commit SHA, Sites slug, and live URL under a `Migration source` heading in `README.md`.

- [ ] **Step 2: Create the dedicated GitHub repository**

Create private repository `islamismylifebey-web/zip-zero-delay-instruction-platform`, push the complete existing history to `main`, and confirm:

```bash
git ls-remote --heads origin main
git rev-parse HEAD
```

Expected: both commands report the same commit SHA.

- [ ] **Step 3: Register ZIP in GALOR Hub**

Add one canonical registry record with these exact values:

```yaml
- id: zip
  name: ZIP — Zero Delay Instruction Platform
  repository: islamismylifebey-web/zip-zero-delay-instruction-platform
  branch: main
  product_record: AIWORK-001
  phase: chatbot-first-validation
  source_of_truth: github
```

Add ZIP to `PROJECT-INDEX.md` with the same repository and phase. Run the Hub's existing registry validation command and require PASS.

- [ ] **Step 4: Rename product metadata without changing behavior**

Set `package.json.name` to `zip-zero-delay-instruction-platform`, `displayName` to `ZIP — Zero Delay Instruction Platform`, update layout title/description, and replace README/AGENTS product headings. Preserve `.openai/hosting.json`, D1/R2 binding names, database migrations, and current functionality.

- [ ] **Step 5: Run baseline gates and commit**

Run:

```bash
npm test
npm run lint
```

Expected: production build, artifact validation, all current tests, and lint pass. Commit with `chore: establish ZIP project identity`.

### Task 2: Define the ZIP contracts and Phase 1 fixtures

**Files:**
- Create: `lib/zip/contracts.ts`
- Create: `lib/zip/fixtures.ts`
- Create: `tests/zip-contracts.test.ts`

**Interfaces:**
- Consumes: existing `CrewMember` identifiers and company-scoped authorization.
- Produces: `ZipDraftRequest`, `VerifiedZipContext`, `ZipModelResult`, `ZipDraftResult`, and `ApprovedZipAssignment`.

- [ ] **Step 1: Write failing contract tests**

Test that every fixture source has a stable ID, contains no raw-message field, and employee fixtures contain only approved work context:

```ts
assert.ok(zipFixtures.preset.sourceId);
assert.ok(zipFixtures.employee.sourceId);
assert.equal("rawInstruction" in zipFixtures, false);
assert.deepEqual(Object.keys(zipFixtures.employee).sort(), [
  "authorizedJobTypes", "communicationDetail", "department", "displayName",
  "preferredLanguage", "responsibilities", "role", "sourceId", "training"
].sort());
```

- [ ] **Step 2: Run the focused test and verify failure**

Run `node --test tests/zip-contracts.test.ts`. Expected: FAIL because `lib/zip/contracts.ts` and fixtures do not exist.

- [ ] **Step 3: Define exact contracts**

Implement discriminated unions:

```ts
export type ZipDraftRequest = {
  employeeId: string;
  presetId: string;
  rawInstruction: string;
};

export type VerifiedZipContext = {
  company: { sourceId: string; name: string; policies: string[] };
  preset: { sourceId: string; name: string; purpose: string; steps: string[]; safetyRules: string[]; evidence: string[]; completionDefinition: string };
  employee: { sourceId: string; displayName: string; role: string; department: string; authorizedJobTypes: string[]; training: string[]; preferredLanguage: string; communicationDetail: "brief" | "standard" | "detailed"; responsibilities: string[] };
};

export type ZipModelResult =
  | { status: "ready"; professionalAssignment: string; sourceIds: string[]; checklist: string[]; unsupportedClaims: string[] }
  | { status: "needs_clarification"; clarifyingQuestion: string; missingFields: string[]; conflictingFields: string[] };

export type ZipDraftResult =
  | { status: "ready"; draftId: string; professionalAssignment: string; checklist: string[] }
  | { status: "needs_clarification"; clarifyingQuestion: string; fields: string[] }
  | { status: "temporarily_unavailable"; retryable: true; code: "timeout" | "provider_error" | "invalid_output" };

export type ApprovedZipAssignment = {
  draftId: string;
  assigneeId: string;
  professionalAssignment: string;
  checklist: string[];
  approvedAt: string;
  approvedBy: string;
};
```

- [ ] **Step 4: Add representative fixtures and pass tests**

Create one cleaning-company policy, floor-care preset, and trained employee fixture using fictional names and locations. Run `node --test tests/zip-contracts.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit**

Commit with `test: define ZIP drafting contracts and fixtures`.

### Task 3: Build minimal verified context

**Files:**
- Create: `lib/zip/context.ts`
- Create: `tests/zip-context.test.ts`

**Interfaces:**
- Consumes: `ZipDraftRequest` and fixture/company data lookup.
- Produces: `buildVerifiedContext(request, source): VerifiedZipContext | ZipContextError`.

- [ ] **Step 1: Write failing tests**

Cover valid context, unknown employee, unauthorized job type, unknown preset, and cross-company mismatch. Assert the returned context contains no `rawInstruction` key and `JSON.stringify(context)` excludes the rough instruction text.

- [ ] **Step 2: Run the tests and verify failure**

Run `node --test tests/zip-context.test.ts`. Expected: FAIL because `buildVerifiedContext` is missing.

- [ ] **Step 3: Implement the context builder**

Return errors with exact codes `employee_not_found`, `preset_not_found`, `company_mismatch`, or `job_not_authorized`. Copy only allowlisted fields into `VerifiedZipContext`; never spread database objects.

- [ ] **Step 4: Run tests and commit**

Run `node --test tests/zip-context.test.ts`. Expected: PASS. Commit with `feat: build minimal verified ZIP context`.

### Task 4: Validate and ground model output

**Files:**
- Create: `lib/zip/output-validator.ts`
- Create: `tests/zip-output-validator.test.ts`

**Interfaces:**
- Consumes: unknown provider JSON and `VerifiedZipContext`.
- Produces: `validateZipModelResult(value, context): ZipModelResult | { status: "invalid"; reasons: string[] }`.

- [ ] **Step 1: Write failing validator tests**

Use table tests for valid ready output, valid clarification, invented source ID, empty assignment, unsupported claims, multiple questions, missing checklist, and extra unknown properties.

- [ ] **Step 2: Verify failure**

Run `node --test tests/zip-output-validator.test.ts`. Expected: FAIL because the validator is missing.

- [ ] **Step 3: Implement strict validation**

Require exactly one union shape, nonempty strings, maximum assignment length 4,000 characters, maximum clarification length 300 characters, one question mark for clarification, and source IDs limited to the three IDs in `VerifiedZipContext`. A ready result with any `unsupportedClaims` is invalid.

- [ ] **Step 4: Pass tests and commit**

Run `node --test tests/zip-output-validator.test.ts`. Expected: PASS. Commit with `feat: validate grounded ZIP model output`.

### Task 5: Add the Luna Fast Mode provider

**Files:**
- Create: `lib/zip/prompt.ts`
- Create: `lib/zip/provider.ts`
- Create: `tests/zip-provider.test.ts`
- Modify: `.env.example`

**Interfaces:**
- Consumes: `rawInstruction` in request memory and `VerifiedZipContext`.
- Produces: `ZipProvider.generate(input, signal): Promise<unknown>`.

- [ ] **Step 1: Write a failing provider contract test**

Inject a fake fetch and assert the request uses `/v1/responses`, model `gpt-5.6-luna`, `reasoning.effort` equal to `low`, structured JSON output, and no automatic fallback model. Assert authorization is read from a server argument, not returned to callers.

- [ ] **Step 2: Verify failure**

Run `node --test tests/zip-provider.test.ts`. Expected: FAIL because `createOpenAIProvider` is missing.

- [ ] **Step 3: Implement the lean prompt**

The system prompt must state the ZIP contract once: use only supplied verified context, return ready or one clarification, never invent facts, never preserve or mention the rough wording, and write directly to the employee. Define the strict response schema matching `ZipModelResult`.

- [ ] **Step 4: Implement the provider adapter**

Export:

```ts
export type ZipProvider = { generate(rawInstruction: string, context: VerifiedZipContext, signal: AbortSignal): Promise<unknown> };
export function createOpenAIProvider(apiKey: string, fetcher = fetch): ZipProvider;
```

Send the raw instruction only in the in-memory request body. Do not log request bodies or provider responses. Add `OPENAI_API_KEY=` to `.env.example` without a value.

- [ ] **Step 5: Pass tests and commit**

Run `node --test tests/zip-provider.test.ts`. Expected: PASS. Commit with `feat: connect ZIP to GPT-5.6 Luna Fast Mode`.

### Task 6: Orchestrate drafting, clarification, and safe failure

**Files:**
- Create: `lib/zip/draft-service.ts`
- Create: `tests/zip-draft-service.test.ts`

**Interfaces:**
- Consumes: `ZipProvider`, context source, `ZipDraftRequest`.
- Produces: `createZipDraftService(deps).draft(request): Promise<ZipDraftResult>`.

- [ ] **Step 1: Write failing service tests**

Cover ready output, clarification, invalid output, timeout at 8 seconds, provider error, unauthorized context, and disposal. Capture logger calls and assert neither raw instruction nor provider content appears in them.

- [ ] **Step 2: Verify failure**

Run `node --test tests/zip-draft-service.test.ts`. Expected: FAIL because the service is missing.

- [ ] **Step 3: Implement the service**

Build context, call the provider once with `AbortSignal.timeout(8000)`, validate output, create a random draft ID, and return the safe public result. Log only `{ requestId, outcome, durationMs, errorCode }`. Do not retry automatically because retrying would retain or resend the raw instruction without a new employer action.

- [ ] **Step 4: Pass tests and commit**

Run `node --test tests/zip-draft-service.test.ts`. Expected: PASS. Commit with `feat: orchestrate safe ZIP drafting`.

### Task 7: Add authenticated draft and approval endpoints

**Files:**
- Create: `app/api/zip/draft/route.ts`
- Create: `app/api/zip/approve/route.ts`
- Create: `lib/zip/approval.ts`
- Modify: `app/models.ts`
- Modify: `lib/workspace-server.ts`
- Modify: `app/api/workspace/route.ts`
- Test: `tests/zip-api.test.ts`
- Test: `tests/zip-privacy.test.ts`

**Interfaces:**
- Consumes: authenticated user, `edit_tasks` permission, draft service, reviewed professional assignment.
- Produces: POST `/api/zip/draft` and POST `/api/zip/approve`; persistable `ApprovedZipAssignment` without `sourceText`.

- [ ] **Step 1: Write failing authorization and privacy tests**

Assert unauthenticated requests return 401, employees return 403, malformed input returns 400, ready drafts return only safe fields, and approval rejects unknown/expired draft IDs. Serialize saved workspace and assert it excludes the original phrase and the `sourceText` property.

- [ ] **Step 2: Verify failure**

Run `node --test tests/zip-api.test.ts tests/zip-privacy.test.ts`. Expected: FAIL because endpoints and approval store are missing.

- [ ] **Step 3: Remove raw-source persistence**

Remove `sourceText` from `Job`, `JobDraft`, parsing output, review UI, and workspace serialization. Parse legacy records by dropping `sourceText`. Never migrate old raw text into a replacement field.

- [ ] **Step 4: Implement bounded approval storage**

Store pending safe drafts by random draft ID, company ID, assignee ID, professional assignment, checklist, creator ID, and 15-minute expiry. The pending record must not contain the raw instruction. Approval consumes the draft once and creates the existing job/assignment record.

- [ ] **Step 5: Implement endpoints and pass tests**

Draft endpoint validates 1–2,000 character input and uses server-side `OPENAI_API_KEY`. Approval accepts only editable professional text, draft ID, and assignee. Run the two focused test files. Expected: PASS.

- [ ] **Step 6: Commit**

Commit with `feat: secure ZIP drafting and approval workflow`.

### Task 8: Build the chatbot-first employer interface

**Files:**
- Create: `app/zip-chat.tsx`
- Modify: `app/workforce-app.tsx`
- Modify: `app/globals.css`
- Test: `tests/zip-ui-state.test.ts`

**Interfaces:**
- Consumes: `/api/zip/draft`, `/api/zip/approve`, crew and preset choices.
- Produces: accessible states `idle`, `listening`, `drafting`, `clarifying`, `review`, `approving`, `approved`, and `error`.

- [ ] **Step 1: Write failing state-machine tests**

Test valid transitions and reject `drafting -> approved`, `error -> approved`, and `review -> employee_visible` without approval.

- [ ] **Step 2: Verify failure**

Run `node --test tests/zip-ui-state.test.ts`. Expected: FAIL because the state reducer is missing.

- [ ] **Step 3: Implement the reducer and UI**

Replace the deterministic communication assistant with ZIP chat. The screen starts with employee and preset selection, then voice/text input. After submission, clear the text input immediately. Clarification shows one question and a new response field. Review shows only the professional assignment and checklist, allows edits, and provides `Approve and assign`. Never render the raw instruction after submission.

- [ ] **Step 4: Add accessible failure and loading states**

Use `aria-live` for status, preserve keyboard focus when states change, disable duplicate submissions, display truthful retry language, and retain only safe draft text after provider failure.

- [ ] **Step 5: Pass tests and commit**

Run `node --test tests/zip-ui-state.test.ts`. Expected: PASS. Commit with `feat: build ZIP chatbot-first workflow`.

### Task 9: Build the chatbot evaluation gate

**Files:**
- Create: `tests/fixtures/zip-evals.json`
- Create: `tests/zip-evals.test.ts`
- Create: `scripts/run-zip-live-evals.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: draft service and real provider only when `ZIP_LIVE_EVALS=1`.
- Produces: `npm run test:zip` and `npm run eval:zip:live` gates.

- [ ] **Step 1: Create ten explicit evaluation cases**

Include complete floor job, missing location, conflicting time, unauthorized job type, required safety signs, employee detail preference, missing tools, unsupported invented address trap, multilingual preference, and provider timeout. Each case defines expected status, required phrases, forbidden phrases, and required source IDs.

- [ ] **Step 2: Write deterministic evaluation tests**

Run all cases through fake provider outputs to prove validation and orchestration. Assert the forbidden original wording never appears in results or captured logs.

- [ ] **Step 3: Add the live evaluation runner**

Require `ZIP_LIVE_EVALS=1` and `OPENAI_API_KEY`; otherwise exit without pretending live evaluation passed. Report case name, status, latency, input/output token usage, and pass/fail without printing raw instructions or model responses.

- [ ] **Step 4: Add scripts and run gates**

Add:

```json
"test:zip": "node --test tests/zip-*.test.ts",
"eval:zip:live": "node --experimental-strip-types scripts/run-zip-live-evals.ts"
```

Run `npm run test:zip`. Expected: all deterministic ZIP tests pass. Run live evaluations only with the configured server-side key; require all ten cases to pass before release.

- [ ] **Step 5: Commit**

Commit with `test: enforce ZIP chatbot release gate`.

### Task 10: Prove the complete chatbot workflow

**Files:**
- Modify only source defects found by the required preview.
- Create: `docs/verification/zip-chatbot-gate-2026-08-27.md`

**Interfaces:**
- Consumes: complete Phase 1 implementation and configured test environment.
- Produces: evidence-backed PASS or BLOCKED decision for Phase 2.

- [ ] **Step 1: Run all non-browser gates**

Run:

```bash
npm run test:zip
npm test
npm run lint
npm run eval:zip:live
```

Expected: every applicable check passes; live evals explicitly report ten of ten.

- [ ] **Step 2: Run the required end-to-end functionality preview**

Using the Sites agent preview, sign in as an authorized employer, select the floor preset and employee, enter a rough instruction, resolve one clarification case, review/edit, approve, switch to employee view, and confirm only the approved professional assignment is visible. Repeat one provider-failure case and confirm truthful retry behavior.

- [ ] **Step 3: Verify non-persistence**

Search the test database, assignment JSON, audit events, captured application logs, and rendered employee output for the unique original-message canary. Expected: zero matches. Confirm the approved professional assignment is present.

- [ ] **Step 4: Write the gate report**

Record exact commands, test counts, live-evaluation count, preview scenarios, canary-search result, failures found, repairs made, and final `PASS` or `BLOCKED`. Do not mark PASS if browser preview or live Luna evaluation did not run successfully.

- [ ] **Step 5: Commit and checkpoint**

Commit with `test: prove ZIP chatbot end-to-end`. Prepare the Sites checkpoint only after the report says PASS. Phase 2 remains blocked on any other result.
