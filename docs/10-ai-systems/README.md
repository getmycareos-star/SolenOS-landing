# 10 — AI Systems

**Caregiver inference authority:** backend Qwen gateway at `backend/app/services/qwen_gateway.py`, using the existing private Railway Ollama service.  
**Care record authority:** PostgreSQL-backed Living Care Record and its existing review/reconciliation workflows.  
**Frontend role:** authenticated API calls and presentation; never connects directly to Ollama.

## Separation of concerns

| Concern | Mechanism |
|---|---|
| Care understanding and extraction support | Qwen through authenticated backend workflows, with source and schema validation |
| Companion answers | Backend Qwen with scoped LCR retrieval and grounding controls |
| Change detection and record reconciliation | Existing backend care-continuity and Delta services |
| Document intelligence | Existing persisted document workflow and Qwen gateway |
| Caregiver approval | Explicit review routes; model output alone never writes an accepted care fact |
| Browser voice input | Browser speech recognition where supported; no server Whisper/Gemini dependency in the active MVP |

## Active caregiver path

`POST /api/situation` and the related authenticated backend routes are the caregiver entry points. Companion, documents, appointments, handoffs and change summaries must continue to retrieve from the same Living Care Record.

The legacy `POST /api/analyze` endpoint is retired (HTTP 410). Its former Gemini pipeline is not an active product path and must not be re-enabled as a parallel reasoning system.

## Model boundary

- Qwen may extract, organize, compare and summarize source information.
- Qwen output is not independent verification, clinical judgment or authority to change the LCR.
- Preserve source wording, attribution, timing, uncertainty and conflicts.
- When Qwen is unavailable or returns invalid output, surface the failure. Do not silently substitute a deterministic result and present it as model output.
- Never send browser requests directly to Ollama or expose model-service credentials to the browser.
- No Gemini-hosted or OpenAI-hosted inference is required by the active caregiver workflows.

## Voice

Voice remains outside the MVP server inference path. Keep browser transcription separate from any future server-side speech provider decision. Do not reintroduce Whisper or Gemini as hidden fallbacks.


## Companion identity and behavioral authority

The canonical, model-independent Companion identity is versioned in the backend
specification:
`SolenOS_backend/backend/docs/solenos-companion-identity-constitution.md`.
Its runtime identity and Thoughtful Care Partner kernels are maintained in
`backend/app/services/solenos_identity.py` and
`backend/app/services/solenos_personality.py`, then injected by the backend
Qwen system-contract adapter. Frontend screens must not define a competing
Companion identity, founder story, safety boundary, or model-specific personality.

The legacy LangChain adapter under `src/lib/solenos-langchain-adapter` is
fail-closed: its inference entry points throw, its provider resolver returns no
provider, and application-source checks reject new call sites. Its old prompt
template remains only for compatibility tests; it is not a caregiver inference
path. Any future approved model adapter must consume the same model-independent
identity and personality kernels and pass the same identity, evidence, safety,
privacy, and context-budget acceptance tests.
