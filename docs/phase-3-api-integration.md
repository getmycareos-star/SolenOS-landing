# Phase 3 API integration matrix

Scope: compare the Vite/React frontend against the FastAPI application in this repository. Route existence means source-level presence, not proof the Railway deployment is serving this application.

## Browser client contract

- Shared client base: same-origin `/api/v1`.
- Special-case capture route: `POST /api/situation` because FastAPI mounts it outside the versioned router.
- Netlify redirects `/api/*` to the Railway domain under the same path.
- GET requests have a 15-second timeout and at most one retry for HTTP 502/503/504. Mutations are not automatically retried.
- A successful HTTP status is not treated as proof of persistence unless the caller validates the expected response contract.

## Implemented API-to-UI paths

| UI workflow | Frontend request | FastAPI route | State |
| --- | --- | --- | --- |
| Free-form care capture | `POST /api/situation` | `POST /api/situation` | Implemented; caregiver/person consistency guard and regression tests in PR #8 |
| Daily Care form | `POST /api/v1/daily-care/entries` | `POST /api/v1/daily-care/entries` | Implemented; validates success/id before clearing form |
| Structured Daily Capture | `POST /api/v1/daily/log` | `POST /api/v1/daily/log` | Route exists; persistence uses care-event record |
| Caregiver selector | `GET /api/v1/caregivers/{person_id}` | `GET /api/v1/caregivers/{person_id}` | Implemented |
| Living Care Record evidence | `GET/POST /api/v1/evidence...` | `GET/POST /api/v1/evidence...` | Route exists |
| Care event history | `GET /api/v1/events/{person_id}` | `GET /api/v1/events/{person_id}` | Implemented; read-back persistence regression test added |
| Insights | `GET /api/v1/insights/{person_id}` | `GET /api/v1/insights/{person_id}` | Implemented |
| Appointments page (`/appointments`) | `GET /api/v1/appointments/{person_id}`, `POST /api/v1/appointments`, plus linked-caregiver lookup | Existing appointment routes | Wired with save-response validation and read-back; available from Dashboard quick links |
| Professional Care Overview | Reads events, appointments, insights, and linked caregivers for selected person | Existing routes above | Replaced nonexistent multi-patient endpoint with actual selected-person data; does not claim professional-level access |
| Memory | `GET /api/v1/observations/{person_id}` | `GET /api/v1/observations/{person_id}` | Route exists |
| Caregiver coordination | `GET /caregivers/{person_id}`, `GET /caregiver-responsibilities/{person_id}`, `GET /caregiver-handoffs/{person_id}`, `POST /caregiver-handoffs`, `POST /caregiver-handoffs/{id}/accept` | Existing caregiver-intelligence endpoints | Wired in `/care-circle`; handoff creation requires two real linked caregivers and acknowledgement evidence |

## Newly implemented collaboration routes

These routes are now implemented in the backend collaboration router and wired to the corresponding UI:

- Community feed and post creation: `GET/POST /api/v1/community`.
- Community reactions: `POST/DELETE /api/v1/community/{post_id}/reactions`; each caregiver can maintain one reaction per post.
- Shared-experience matching: `POST /api/v1/community/experience`; currently literal keyword overlap against published posts, not an AI or clinical assessment.
- Companion messaging: `POST /api/v1/conversation/message`; persists user/assistant messages, retrieves existing care events/appointments/insights, and returns their record IDs. It is a deterministic record-review helper, not an LLM chat service. Emergency language triggers a conservative urgent-help message; this is not a validated clinical triage system.
- Conversation history: `GET /api/v1/conversation/{person_id}` and `GET /api/v1/conversation/{session_id}/messages`.
- Team dashboard aggregates: `GET /api/v1/team/dashboard`, `GET /api/v1/team/state-report`, `GET /api/v1/metrics`.
- Community moderation: `GET /api/v1/team/moderation`, `PATCH /api/v1/team/moderation/{post_id}`. New posts are private to the moderation queue until explicitly published.
- Professional multi-patient dashboard: `GET /api/v1/professional/dashboard?professional_caregiver_id=...`; returns only active access grants.
- Professional access grant: `POST /api/v1/professional/access-grants`; requires a linked family caregiver account to grant access and a provisioned professional account to receive it.

## Authentication and authorization

- `POST /api/v1/auth/register`: caregiver enrollment using a server-configured enrollment key; can attach to an existing caregiver record when email and caregiver ID match, or create a new person/caregiver pair.
- `POST /api/v1/auth/login`: password verification and signed, expiring bearer token issuance.
- `GET /api/v1/auth/me`: validates the token against the active account.
- `POST /api/v1/auth/provision`: administrator-key-protected provisioning for professional/team roles. A client role selector cannot grant permissions.
- All `/api/v1/*` and `/api/situation` requests require a valid bearer token except enrollment/login/provision, health/readiness, OpenAPI/docs, and CORS preflight.
- The server checks account state, token role, supplied caregiver IDs, care-recipient ownership, professional access grants, and team-only route roles.
- Team aggregates expose database counts, not identifiable care-event content. Team moderation is restricted to team accounts.
- The browser currently stores the short-lived bearer token in localStorage. This reduces casual unauthenticated access but is not equivalent to an HttpOnly secure-cookie session and remains exposed to same-origin script compromise.

## Security and deployment blockers

- Backend authentication now uses password-hashed accounts and signed expiring bearer tokens. This is an initial implementation and still requires a full authorization regression pass across every legacy route, plus secure account-enrollment operations before real private care data is enabled.
- Railway smoke tests returned HTTP 404 for `/health`, `/ready`, `/openapi.json`, and `/api/situation` CORS preflight. The configured production domain is not serving the inspected FastAPI application, so live persistence and browser integration remain unverified.
- Before production care data is enabled, finish route-by-route authorization tests, configure the required secrets, validate account recovery/rotation, and consider moving browser tokens to secure HttpOnly cookies. Never expose private records merely because a client knows a person ID.
