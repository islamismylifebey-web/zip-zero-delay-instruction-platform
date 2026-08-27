# ZIP — Zero Delay Instruction Platform

GALOR's chatbot-first validation MVP for AIWORK-001. Say it. ZIP it. Get it
done.

## Migration source

- Canonical repository: `islamismylifebey-web/zip-zero-delay-instruction-platform`
- Canonical branch: `main`
- Original Sites repository: `https://git.chatgpt-team.site/7feca555-f923-400a-81a7-c836243e33f9/appgprj_6a539cae098081919064b65f5417876b.git`
- Pre-migration Sites commit: `83c4eb61316983b06baef30493538e85d8cbf3b0`
- Migration worktree branch: `feature/zip-chatbot-first`
- Sites slug: `speak-assign-done`
- Published rollback URL: `https://speak-assign-done.beythetruth4ever.chatgpt.site`

The GitHub repository was seeded from the complete verified source tree through
GitHub's commit/tree API. It starts a new canonical commit history; the prior
Git object graph was not transferred. The original Sites repository and commit
above remain the rollback-history reference.

## What works

- Voice capture in supported browsers, with a complete text fallback.
- Smart conversion of spoken/text instructions into a reviewed job.
- Individual and all-crew assignments.
- Dispatcher dashboard, live status, activity, schedules, and crew views.
- Database-backed company workspace protected by ChatGPT sign-in.
- Worker companion with Start, Navigate, Need Help, Finished, Log Mileage, and Contact
  Dispatcher.
- Mileage ledger with trip, worker, job, odometer, and business-purpose records.
- Add-crew workflow, helper assignment, private job messages, voice calibration,
  responsive UI, and accessibility.
- Communication assistant that turns casual instructions into a professional,
  detailed draft for dispatcher review.

See `AUDIT.md` for the August 27, 2026 product, source-of-truth, and commercial-readiness audit.

## Run

```bash
npm run dev
```

## Validate

```bash
npm test
npm run lint
```

## Commercial boundary

This release is an operational founder workspace and product-validation MVP.
Production rollout to paying businesses still requires multi-tenant onboarding,
AI extraction, notification delivery, employee authentication, role permissions,
audit controls, account recovery, privacy policy, billing, and operating support.
