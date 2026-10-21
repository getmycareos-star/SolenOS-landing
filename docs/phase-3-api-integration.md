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
| Appointments | `GET /api/v1/appointments/{person_id}` | `GET /api/v1/appointments/{person_id}` | Implemented |
| Professional Care Overview | Reads events, appointments, insights, and linked caregivers for selected person | Existing routes above | Replaced nonexistent multi-patient endpoint with actual selected-person data; does not claim professional-level access |
| Memory | `GET /api/v1/observations/{person_id}` | `GET /api/v1/observations/{person_id}` | Route exists |
| Caregiver coordination | `GET /caregivers/{person_id}`, `GET /caregiver-responsibilities/{person_id}`, `GET /caregiver-handoffs/{person_id}`, `POST /caregiver-handoffs`, `POST /caregiver-handoffs/{id}/accept` | Existing caregiver-intelligence endpoints | Wired in `/care-circle`; handoff creation requires two real linked caregivers and acknowledgement evidence |

## Unsupported frontend features intentionally disabled

These features previously called URLs not present in the inspected FastAPI router. They must not fabricate records or claim writes succeeded.

- Community feed, posts, reactions, experience matching, and moderation: no community routes found.
- Companion conversation: no conversation-message or companion-query route found.
- Team dashboard/state report/metrics: no matching team routes or `/metrics` endpoint found.
- Multi-patient professional dashboard: no professional-dashboard route found. The page now shows existing records for the selected person only.

To enable these later, implement and test the backend API contracts, permissions, persistence, and response schemas before re-enabling frontend actions. Do not repurpose private caregiver observations as public Community content.

## Security and deployment blockers

- Current backend APIs accept caller-supplied person/caregiver identifiers; there is no verified login/token/session contract. Relationship checks prevent mismatched IDs in the tested capture paths but are not authentication or authorization.
- Railway smoke tests returned HTTP 404 for `/health`, `/ready`, `/openapi.json`, and `/api/situation` CORS preflight. The configured production domain is not serving the inspected FastAPI application, so live persistence and browser integration remain unverified.
- Before production care data is enabled, implement real identity/session issuance and enforce authorization on every person-scoped read and write. Do not expose private records merely because a client knows a person ID.
