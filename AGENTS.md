# ZIP — Zero Delay Instruction Platform — Project Constitution

Owner: Sheik Maurice Pennington Bey  
Parent ecosystem: GALOR — Revealers of the Light  
Product record: AIWORK-001

## Mission

Create the simplest workforce communication platform ever built. A dispatcher
speaks or types one instruction; the product converts it into clear work that a
field employee can start, navigate to, get help with, and finish without
training.

## Version 1 promise

Speak. Assign. Done.

## Required paths

- Dispatcher: choose a worker or everyone, speak/type, review structured work,
  send, monitor status, respond to help requests.
- Worker: see Today's Jobs, Start, Navigate, Need Help, Finished, and Contact
  Dispatcher.
- Operations: view today's schedule, the current week, crew status, completed
  work, mileage, and activity history.
- Mileage: workers record odometer readings or direct trip miles against a job;
  dispatch sees totals and business-purpose history by worker and job.
- Voice: use browser speech recognition when available and always provide a
  text fallback.

## Product boundaries

- This first release is a working validation MVP, not a general chat app or
  conventional project-management suite.
- Keep the interface extremely simple and usable on phones and job sites.
- Do not imply that starter data, local smart parsing, or preview
  security is production AI, enterprise persistence, or audited authentication.
- Dispatcher and worker permissions are enforced server-side by signed-in email,
  workspace ownership, and assignment ownership.
- Full administrative audit exports, recovery, passkeys, push-notification
  delivery, file uploads, and production AI remain future commercial features.
- Never expose secrets or place real private workforce data in demo fixtures.

## Acceptance

- Production build and artifact validation pass.
- Dispatcher can create and broadcast work.
- Worker actions update status immediately.
- Help requests appear to dispatch and can be assigned a helper.
- Navigation and dispatcher contact controls work.
- Schedules, crew, voice calibration, keyboard focus, reduced motion, and
  responsive mobile layouts are present.
