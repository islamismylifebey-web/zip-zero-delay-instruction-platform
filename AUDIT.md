# Speak. Assign. Done. — Full Product Audit

Audit date: August 27, 2026

## Exact location and source of truth

- Live application: `https://speak-assign-done.beythetruth4ever.chatgpt.site`
- Sites slug: `speak-assign-done`
- Sites project record: `.openai/hosting.json`
- Canonical source repository: `https://git.chatgpt-team.site/7feca555-f923-400a-81a7-c836243e33f9/appgprj_6a539cae098081919064b65f5417876b.git`
- Canonical branch: `main`
- Local lifecycle checkout: `/workspace/sites/speak-assign-done`
- Product record: `AIWORK-001` in `AGENTS.md`

The canonical `main` branch is the source of truth for application code. The Sites project record is the source of truth for the hosted application identity and deployment.

## Executive conclusion

The app is a strong working validation MVP, not yet a fully commercial workforce platform. Its core promise is real: a dispatcher can speak or type an instruction, review structured work, assign it, monitor status, respond to help requests, message workers, and record mileage. Signed-in company and employee access is enforced on the server and data is stored in a database.

The largest customer-readiness gaps are reliable outbound notifications, true AI language understanding, hardened team onboarding, billing and plan controls, audit exports, account recovery, file/photo evidence, and broader automated and end-to-end testing.

## What works now

- Browser voice capture with a text fallback.
- Structured assignment review before sending.
- Individual or all-team assignments.
- Dispatcher views for command, schedule, team status, activity, and mileage.
- Worker actions: Start, Navigate, Need Help, Finished, job messaging, and mileage.
- Database-backed workspaces with signed-in identity.
- Server-side company roles and assignment ownership checks.
- Company separation, team membership, role management, and conflict handling.
- Cross-device refresh and optimistic version-conflict protection.
- Installable web app behavior, responsive layouts, keyboard focus, and reduced-motion support.
- Company logo, contact details, privacy, terms, and account/data controls.
- New communication assistant that converts casual instructions into a professional, detailed draft and requires review before assignment.

## Important limitations

- The communication assistant is deterministic writing assistance, not a connected production AI model. It improves clarity but does not deeply reason about context or conduct a real multi-turn conversation.
- Assignments update inside the app; there is no verified SMS, email, mobile push, or escalation delivery service.
- Worker onboarding depends on exact signed-in email membership and does not yet provide a mature invitation/acceptance flow.
- No attachment or photo-proof workflow exists for before/after evidence.
- No customer billing, subscriptions, seat enforcement, trials, or usage metering exist.
- Workspace operational data is stored as one bounded JSON document. This is adequate for validation, but high-volume customers need normalized records, indexes, pagination, retention, and archiving.
- Reporting is operational, not a full exportable audit/compliance system.
- Automated coverage currently focuses on parsing, scheduling, permissions, and professional-message generation. Route authorization, concurrency, database migrations, recovery, and complete dispatcher-to-worker journeys need broader integration coverage.
- Browser speech recognition support varies by device and browser.

## Compared with what can be built today

| Area | Current app | Modern customer-ready target |
| --- | --- | --- |
| Instruction capture | Browser speech or text | Streaming transcription, noise handling, multilingual input, and confidence review |
| Message intelligence | Rule-based parsing and professional rewrite | Context-aware AI conversation that asks follow-up questions and never invents missing facts |
| Delivery | In-app synced assignment | In-app, push, SMS, and email delivery with receipts, retries, and escalation |
| Team onboarding | Exact-email membership | Invitations, acceptance, resend, role templates, and domain/company controls |
| Evidence | Status and text messages | Photos, files, checklists, signatures, timestamps, and location policy controls |
| Operations | Live dashboard and mileage | Search, filters, recurring work, templates, dispatch maps, exports, analytics, and integrations |
| Data architecture | Bounded workspace document | Normalized tenant records, indexed queries, event history, retention, backup, and recovery |
| Commercial controls | None | Trials, plans, seats, billing, entitlements, support, and customer administration |
| Quality proof | Build, artifact validation, and focused unit tests | Integration, authorization, migration, notification, accessibility, load, and end-to-end tests |

## Best customer value

The clearest initial market is small field-service teams that currently manage work through calls and text messages: cleaning, pressure washing, landscaping, maintenance, mobile detailing, property services, and small contractors. The product should sell one outcome: fewer misunderstood assignments and faster proof that work was completed.

## Recommended completion order

1. Prove the complete dispatcher-to-worker journey with integration and end-to-end tests.
2. Add a real AI conversation service that asks only necessary questions, preserves the original instruction, shows what changed, and requires approval before sending.
3. Add reliable employee notifications with delivery receipts, bounded retries, and escalation rules.
4. Add invitations, account recovery, audit events, attachments/photo proof, exports, and data retention.
5. Normalize high-volume data and add search, filters, templates, recurring work, and reporting.
6. Add billing, plans, seat limits, onboarding, support tools, observability, backups, and commercial policies.

## Verification completed for this audit

- Production build passed.
- Sites artifact validation passed.
- All 7 automated tests passed.
- Lint passed.

No browser-based visual or end-to-end test was performed in this audit.
