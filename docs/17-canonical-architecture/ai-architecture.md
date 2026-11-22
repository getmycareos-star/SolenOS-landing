# AI Architecture

**Doc status:** Current caregiver inference architecture  
**Authority:** PostgreSQL-backed Living Care Record; caregiver review and reconciliation controls

## Active inference boundary

| Path | Technology | Responsibility |
|------|------------|----------------|
| Care understanding and extraction | Private Qwen through authenticated FastAPI routes | Propose structured interpretations from saved source evidence |
| Companion | Private Qwen with person-scoped LCR retrieval | Answer caregiver questions from authorized care history |
| Documents | Existing persisted document lifecycle and Qwen worker | Extract and interpret saved document text while preserving source references |
| Daily Care | Existing capture pipeline, Qwen extraction and backend reconciliation | Produce reviewable candidates; never silently accept model output |
| Change intelligence | Deterministic backend Delta and care-continuity services, with Qwen support where configured | Compare source-backed care information and preserve uncertainty |
| Appointments and handoffs | Authenticated backend workflows with scoped LCR retrieval | Prepare review-only summaries and drafts |
| Browser voice | Browser Web Speech only where supported | Transcription input; no hosted server-side STT in the MVP |

## Separation of concerns

- The frontend calls authenticated backend APIs. It never connects directly to Ollama.
- The private Qwen gateway owns model access, bounded runtime settings and inference failure handling.
- PostgreSQL remains the durable source of truth for care events, evidence, accepted assertions, reviews and corrections.
- Qwen output is a proposal or explanation, not independent verification, clinical judgment or authority to change the LCR.
- Existing caregiver approval, review and reconciliation workflows determine what becomes accepted care information.

## Evidence and safety requirements

- Preserve original source wording, attribution, event time, recorded time and source references.
- Keep reported, observed, verified, inferred, uncertain, conflicting and missing information distinct.
- Reject or clearly mark unsupported claims.
- Corrections preserve the prior record and the reason for change.
- Model failure, invalid output or unavailable Qwen must produce an explicit failure state. Never silently substitute a deterministic result and present it as model output.
- No direct browser-to-Ollama requests, no exposed model credentials, and no Gemini-hosted or OpenAI-hosted inference in active caregiver workflows.

## Retired paths

POST /api/analyze is permanently retired and returns HTTP 410. Its former Gemini pipeline and provider selection are not part of the caregiver architecture. Server-side Whisper and Gemini speech recognition are disabled; browser transcription remains separate.

See [AI Systems](../10-ai-systems/README.md) for the operational boundary and [module status](./module-status.md) for implementation status.
