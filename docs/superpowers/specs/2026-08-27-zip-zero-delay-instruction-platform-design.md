# ZIP — Zero Delay Instruction Platform

Date: August 27, 2026  
Status: Approved  
Product record: AIWORK-001

## Product identity and contract

ZIP means **Zero Delay Instruction Platform**. Its tagline is **Say it. ZIP it. Get it done.**

ZIP receives an employer's rough spoken or typed instruction and combines it with verified company policies, the selected job preset, the selected employee's work profile, safety requirements, location, schedule, and current assignment context. ZIP creates one improved professional assignment that the employee can understand, begin, perform safely, and complete without the employer repeating the original instruction.

ZIP must:

1. Apply only verified presets and employee context.
2. Ask one short employer question when a critical fact is missing or conflicting.
3. Never invent a person, time, location, procedure, requirement, or safety rule.
4. Require employer approval before delivery.
5. Send only the approved professional assignment to the employee.
6. Discard the employer's original message after processing; never store or display it.
7. Preserve the approved assignment, delivery evidence, employee responses, changes, and completion evidence.
8. Never claim delivery or completion without evidence.

## Users and permissions

Owner, Administrator, Manager, and Editor roles can draft assignments according to existing server-side permissions. Employees see only work assigned to them or work for which they are an approved helper. Server-side company scope and authorization apply to every read and write.

## Employer workflow

1. Select an employee or team.
2. Select a job preset or let ZIP match one from verified company presets.
3. Speak or type a rough instruction.
4. ZIP temporarily combines the instruction with verified context.
5. ZIP returns a professional assignment or one necessary clarification question.
6. The employer reviews and may edit the improved assignment.
7. The employer approves delivery.
8. ZIP records the approved version and truthful handoff result.

The raw employer instruction must not appear in review, employee views, history, exports, analytics, audit events, logs, or stored records.

## AI design

- API: OpenAI Responses API.
- Model: `gpt-5.6-luna`.
- ZIP Fast Mode: `reasoning.effort: "low"`.
- Simple formatting may use `none` only when no contextual judgment is required.
- ZIP never automatically escalates to a more expensive model.

The model returns a structured result with `status`, `professional_assignment` or `clarifying_question`, verified source identifiers, missing/conflicting fields, and a safety/requirements checklist. The server validates all material details against company, employee, preset, and assignment context. Unsupported facts are rejected or clarified.

The raw employer instruction exists only in request memory. Operational logs may contain request identifiers, timing, outcome, and error codes, but never message content.

## Presets and employee context

Job presets contain job purpose, location requirements, steps, tools, materials, access instructions, safety rules, evidence requirements, expected duration, completion definition, and escalation instructions.

Employee profiles contain only work-relevant role, department, authorized job types, training/certifications, preferred work language, communication detail level, approved accommodations, schedule, service area, and dispatcher-approved responsibilities. ZIP never infers sensitive traits or creates hidden performance judgments.

## Error behavior

- Missing critical context produces one concise clarification question.
- Conflicting context stops drafting until resolved.
- Timeout, provider failure, or malformed output produces a truthful retry state.
- The raw instruction is not retained after any success or failure.
- Delivery failure never becomes `delivered`.
- Concurrent edits use version checks.

## Project ownership

1. Create a dedicated canonical GitHub repository for ZIP.
2. Make GitHub `main` the source of truth.
3. Register ZIP in `islamismylifebey-web/galor-hub` through `PROJECT-INDEX.md` and `registry/projects.yaml`.
4. Preserve the existing Sites history as migration source and rollback reference.
5. Use one canonical codebase for Sites, Vercel, and Cloudflare.
6. Keep secrets server-side in approved deployment environments.

## Chatbot-first release gate

The ZIP chatbot is the first functional product slice. Before broader team operations, notifications, reporting, billing, or commercial expansion proceeds, it must:

1. Load real company policy, job preset, and employee profile fixtures.
2. Accept a rough spoken or typed instruction.
3. Call GPT-5.6 Luna Fast Mode with minimum verified context.
4. Produce a validated professional assignment or one necessary clarification.
5. Reject invented, unsupported, conflicting, or invalid details.
6. Support employer revision and approval.
7. Expose only the approved assignment to the employee workflow.
8. Prove the raw instruction was not persisted anywhere.
9. Record truthful processing, approval, and handoff states.
10. Handle timeout, provider failure, malformed output, missing context, and conflicts safely.

The gate requires unit tests, API integration tests, AI evaluations, and an end-to-end functionality preview. A rendered interface, mock response, deterministic placeholder, successful API connection, or passing build is insufficient.

## Delivery phases

### Phase 0 — Permanent project boundary

Rename the product, establish GitHub and GALOR Hub as the permanent home, preserve rollback, and configure only the secure development/test environment needed for the chatbot.

### Phase 1 — Build and prove the ZIP chatbot

Build the smallest complete chatbot vertical slice: fixtures, Luna service, structured validation, clarification, review/approval, employee-facing handoff, raw-message disposal, truthful states, failure handling, evaluations, integration tests, and end-to-end preview. Broader construction remains blocked until this gate passes.

### Phase 2 — Build around the proven chatbot

Replace fixtures with normalized company presets and employee management. Add dependable delivery, acknowledgement, help, messaging, evidence, retries, scheduling, mileage, and reporting.

### Phase 3 — Commercial hardening

Complete Vercel/Cloudflare production responsibilities, onboarding, recovery, retention, exports, billing, observability, backup, support tooling, security review, performance testing, and complete end-to-end proof.

## Out of scope for Phase 1

- Autonomous employee discipline or performance scoring.
- Automatic model escalation.
- Sending without employer approval.
- Inferring sensitive employee traits.
- Preserving raw employer instructions.
- Claiming delivery or completion without evidence.
