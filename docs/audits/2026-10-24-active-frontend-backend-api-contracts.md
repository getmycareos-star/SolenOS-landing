# SolenOS active frontend/backend API contract audit — 2026-10-24

## Scope

This audit covers the active Next.js caregiver surface and the FastAPI application on the Railway-target branch `feat/care-continuity-integrity-engine-2026-10-22`. Archived Vite pages and the `/ops/devtools` quarantine are not part of the caregiver workflow.

## Active workflow mapping

| Frontend workflow | Request path | Owner / backend route | Session and persistence contract |
|---|---|---|---|
| Anonymous session bootstrap | `POST /api/v1/sessions/anonymous` | FastAPI anonymous-session router | Server issues bearer token, person ID, caregiver ID and expiry. |
| Session renewal | `POST /api/v1/sessions/refresh` | FastAPI anonymous-session router | Refresh uses the existing bearer session and retains its person/caregiver scope. |
| Session revocation | `POST /api/v1/sessions/revoke` | FastAPI collaboration router | Current bearer token is revoked server-side; subsequent protected requests must fail. |
| Care Reality capture | `POST/GET /api/situation` | FastAPI situation routes | Bearer-scoped to the session's person/caregiver; caller IDs are not authority. |
| Daily Care capture | `POST /api/v1/daily/log` | FastAPI v1 router | Persisted structured capture; integration tests read saved events back. |
| Care timeline/event read-back | `GET /api/v1/events/{person_id}` | FastAPI v1 router | Person ID must match bearer scope. |
| Original document upload/download | `POST /api/v1/upload`, `GET /api/v1/upload/{evidence_id}` | FastAPI collaboration router | Upload stores original bytes and evidence metadata; download checks owning care-record scope. Situation capture reuses the upload's evidence ID. |
| Share Target intake | Next.js `POST /api/share-target`; claim via `GET /api/share-intake?id=...` | Next.js route handlers call `/api/v1/share-intake` on FastAPI | Backend stores a high-entropy, 15-minute, one-time capability; replay is rejected. |
| Document extraction | `POST /api/extract` | Same-origin Next.js route forwards the session bearer to Railway `POST /api/extract`; existing Tika/Tesseract fallback remains for backend-unsupported image/office formats | Backend extraction is primary for UTF-8 text and text-based PDFs. Authentication failures never fall back. Scanned-image OCR still depends on actual Tesseract runtime support and is not claimed verified. Original bytes are separately persisted through `/api/v1/upload`. |
| Community feed/posts/reactions | `GET/POST /api/v1/community`, `POST/DELETE /api/v1/community/{post_id}/reactions` | FastAPI collaboration router | Persisted posts/reactions; author identity comes from the bearer session. No fabricated sample posts. |
| Community experience search | `POST /api/v1/community/experience` and `/summary` | FastAPI collaboration router | Literal peer matches are labelled as such. No Qwen-generated summary is claimed when the model provider is unavailable. |
| AI Companion | `POST /api/v1/conversation/message`, `GET /api/v1/conversation/{session_id}` | FastAPI collaboration router | Conversation history is persisted separately from the Living Care Record. Emergency-like messages bypass model inference. |
| Care Delta | `POST /api/v1/care-delta/reconcile`, `GET /api/v1/care-delta/runs/{person_id}` | FastAPI Delta router | Person scope is checked against the server-issued bearer capability. |
| Consent and privacy | `GET/POST /api/v1/consent` | FastAPI collaboration router | Required acknowledgements are persisted. Optional system-improvement consent is explicit; revocation is enforced server-side. |
| Notifications | `GET /api/v1/notifications`, `GET /api/v1/notifications/unread-count`, `PATCH /api/v1/notifications/{id}/read`, `GET/PUT /api/v1/notifications/preferences` | FastAPI collaboration router | Notifications and preferences are scoped to the current person/caregiver session. |
| Global and post-response feedback | `POST /api/v1/feedback` | FastAPI v1 router | Feedback writes require the current bearer identity and explicit system-improvement consent. |

## Prevented or quarantined calls

- `/api/track` is disabled in the active frontend until a scoped, persisted ingestion endpoint exists.
- Activation telemetry/session calls are local-only/no-op; they do not issue unsupported network requests.
- The legacy `/settings` page redirects to `/workspace/settings`; the unused legacy `SettingsManager` is not part of the active settings route.
- Secondary engine panels live under the ops/devtools quarantine and are excluded from the caregiver workspace. Their older endpoint strings must not be treated as working production APIs.
- Voice/TTS is not enabled in the caregiver workflow.

## Model availability

The Companion endpoint is present, but live Qwen inference is **not confirmed**. The current Railway project contains only the SolenOS backend service and no Ollama/model service. Companion must return its explicit unavailable state rather than invent a model response. This audit does not create a paid service or substitute desktop-local inference.

## Verification evidence and limits

- Backend PR #55 integration tests cover Community, Companion, upload/download isolation, Delta scope, and Daily Care save/read-back.
- Backend PR #56 added original-document persistence and one-time Share Target intake; its CI passed before merge.
- Backend PR #59 adds consent, notification preferences/inbox and session revocation. Backend tests and PostgreSQL migration validation passed before merge.
- Railway deployment after PR #59 reported a successful deployment, applied migration `20261024_10 -> 20261024_11`, and returned `GET /ready` with `200 OK`.
- Image OCR uses Tesseract.js in the Next.js route. PDF/Office extraction requires a configured `TIKA_SERVER_URL` or `TIKA_JAR_PATH`; production no longer falls back to a fictitious localhost Tika daemon. Netlify's Tika configuration has not been verified, so PDF/Office extraction is not claimed as production-verified.
- Frontend extraction proxy integration is merged in commit `1bf23864f8b2a8590b514b2703ae496d76abc8cc`. At the last production check, Netlify still published commit `7b816e2939f7d7ca39cb737ee6e3e2c84b3c8437`; the merged route is not considered live until a newer production deploy is observed.
- The source-level and CI evidence above is not a substitute for authenticated live production round trips. Live save/read-back, cross-record denial, Community posting/reactions, and Companion model inference remain separately to be verified against the public deployment.
