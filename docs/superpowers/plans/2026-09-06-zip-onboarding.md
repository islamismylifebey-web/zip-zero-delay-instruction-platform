# ZIP Owner Onboarding Implementation Plan

> **For agentic workers:** Execute tasks in order with failing-then-passing tests; do not claim live deployment from CI results.

**Goal:** Collect approved company knowledge by voice or typing and use it to gate ZIP assignments.
**Architecture:** Pure question/validation/compiler module, versioned D1 persistence, authenticated API handlers and a small onboarding UI. Existing operations screen remains intact.
**Tech Stack:** Existing TypeScript/React/vinext/Cloudflare D1; Node tests plus real SQLite statements. No new dependencies.
**Spec:** `docs/superpowers/specs/2026-09-06-zip-onboarding.md`

## Global constraints
- Retain `gpt-5.6-luna` configuration; no live calls or secrets used by this build.
- Never let empty authorization imply approval.
- Preserve explicit assignment approval, calm personality and tenant boundaries.
- Save confirmed structured fields only, never raw audio or a conversation transcript.

## Task 1 — Confirmed knowledge engine
Create `lib/zip/onboarding.ts` and `tests/zip-onboarding.test.ts`.
Test owner-only writes, explicit confirmation, field validation, one-next-question, incomplete profiles, no default permissions, identity changes, training matching, tenant source IDs, language/detail/tone preferences and safe editing. Run `node --experimental-strip-types --test tests/zip-onboarding.test.ts` before and after implementation.

## Task 2 — Persistence and route wiring
Create `lib/zip/onboarding-store.ts`, migration, authenticated onboarding route and tests using SQLite. Update the draft/approve routes to load confirmed source and save/check the exact knowledge version. At the final write, check the current workspace snapshot atomically too. Test stale writes, tenant separation, missing context, atomic approval guards, draft grounding and cleanup on company deletion.

## Task 3 — Guided browser interview
Create owner-only page/client and reusable speech capture. Route home through setup-aware logic; provide procedure selection from owner-confirmed records, not global fixtures. Test the browser-independent interview state; compile and lint the complete application in GitHub CI. Document unperformed physical microphone/authenticated browser testing.

## Task 4 — Review and evidence
Run full CI including typecheck, build, artifact validation and tests; inspect changes and update PR #1 with exact revision and limitations. Do not merge or publish if live release gates are still outstanding.
