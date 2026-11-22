# Retired legacy analysis pipeline

**Status:** Permanently retired on 2026-11-22.

The former `POST /api/analyze` endpoint returns HTTP 410 in every environment. It is not a caregiver workflow and must not be re-enabled.

The old Gemini execution pipeline, provider-key requirement, hosted model selector, and retry path are not supported. The compatibility module retained under `src/lib/solenos-langchain-adapter/gemini.ts` throws an explicit retirement error and performs no model call.

## Supported inference boundary

Caregiver-facing inference runs through authenticated FastAPI endpoints and the private Qwen runtime configured by the backend. The browser does not connect directly to Ollama and does not receive model credentials.

Qwen output is untrusted assistance. It must remain source-grounded, person-scoped, reviewable, and read-only until the caregiver explicitly approves a permitted Living Care Record change. If inference is unavailable or invalid, the workflow reports failure; it does not silently substitute another provider or fabricated output.

## Current workflow entry points

- Companion conversation: `POST /api/v1/conversation/message`
- Read-only assistance: `POST /api/v1/assistant/assist`
- Durable Qwen jobs: `POST /api/v1/assistant/jobs`
- Daily Care interpretation and review: `/api/v1/daily-care/intelligence`
- Document extraction and review: `/api/v1/documents/intelligence`
- Change detection: `/api/v1/care-delta`
- Appointment continuity: `/api/v1/appointment-workspaces`
- Handoff preparation: `/api/v1/handoff-drafts`

These routes are owned by the backend. Their availability and live model behaviour must be verified through backend integration and live-Qwen acceptance tests, not inferred from this document.
