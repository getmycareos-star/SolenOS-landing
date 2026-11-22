# 11 — API Reference

**Caregiver API:** FastAPI routes under `/api/v1`, reached through the shared frontend API client.  
**Authentication:** server-issued anonymous bearer session, scoped to one care recipient and caregiver. Protected endpoints re-check current access grants.

## Relevant routes

### `POST /api/analyze` — retired

- **Status:** permanently retired; returns **410 Gone** in every environment.
- The former Gemini-backed prototype is not a caregiver workflow.
- Use authenticated Living Care Record APIs instead.

### Caregiver record and AI workflows

- `POST /api/v1/situation` — caregiver capture and care-record workflow.
- `POST /api/v1/assistant/assist` — read-only Qwen assistance with scoped record retrieval.
- Document extraction, review, appointments, handoffs and change intelligence use their existing authenticated backend routes.
- Qwen output does not write care facts directly. Existing review and caregiver-approval controls remain authoritative.

### Voice — future capability

The caregiver MVP uses browser speech recognition where available. Server-side Whisper and Gemini transcription are not part of the active MVP path. Do not configure `OPENAI_API_KEY` or `GEMINI_API_KEY` for caregiver voice.

Other legacy observation, identity and TTS routes in this repository may not be deployed or part of the caregiver MVP. Confirm the current backend route registration before relying on them.
