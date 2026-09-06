# ZIP owner-confirmed onboarding

Approved by the owner in the current conversation: build company-specific voice/text onboarding, one question at a time, read back and explicitly confirm answers, pause/resume, add/edit procedures and employee profiles, preserve bounded autonomy and calm personality. No autonomous sending or new live-model spending.

Use a deterministic question engine to avoid paying an AI provider for setup. This is guided verbal knowledge capture, not open-ended AI interpretation. Each question stores one structured, owner-confirmed field with server-supplied provenance. Unconfirmed microphone text stays only in browser memory. Browser speech service processing is disclosed; typing always works.

Owner-only full interview. Existing roster remains the source of employee identity. Company knowledge has a tenant-specific opaque ID, a version, confirmed fields and procedure/employee records. Each confirmed edit uses optimistic concurrency and is scoped to the signed-in owner's workspace. Blank permissions deny assignment; required training must match explicitly confirmed training. Owner-confirmed qualifications are not independently verified credentials.

Runtime drafting consumes only complete approved company, procedure and employee records. Generated drafts bind to the knowledge revision. Approval checks employee identity/permissions and the knowledge revision again; the final SQL write atomically checks both the knowledge revision and the latest workspace snapshot. Unrelated worker updates need not invalidate a draft, but can trigger a safe retry. Old pending drafts without grounding cannot be newly approved. Existing successful approvals remain safely retryable.

Separate owner setup page and home routing. Browser microphone and read-aloud run only after explicit user action. No background AI calls, auto-send, or cross-company context. The original operations component remains untouched. No deployment claim without actual Sites access, migration and authenticated end-to-end evidence.
