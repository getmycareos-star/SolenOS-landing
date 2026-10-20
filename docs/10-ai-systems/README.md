# 10 — AI Systems

**Orchestrator:** `src/lib/analyze-pipeline` + `src/lib/situation-entry`  
**LLM:** Gemini 1.5 Pro via LangChain (`solenos-langchain-adapter`), temperature **0**  
**MVP inputs (ADR-018):** text + documents only → understanding → Care Record / timeline / actions  
**Parallel:** `observation-intelligence` (heuristic, not LLM) — text capture MVP-compatible  
**Voice / TTS:** FUTURE libraries (`src/lib/voice`, ADR-017 superseded for MVP by ADR-018) — not mounted  
**Explanations:** `human-trust-layer` (deterministic templates)

## Separation of concerns

| Concern | Mechanism |
|---------|-----------|
| Load / crisis / confidence / delegation / priority | **Deterministic** DERIVED / heuristics |
| Cognitive clarity JSON (5 fields) | **LLM** Gemini |
| Document / image text extraction | **Tika + Tesseract** (`POST /api/extract`) |
| Trust explanations | **Templates** |
| Observation structure | **Regex / ontology** |
| Voice Conversation / Read Aloud / Whisper | **FUTURE** — not MVP product surfaces |

LLM must **not** classify MVP load signals or diagnose dementia.

## MVP Input → Understanding (ADR-018)

**Proof question:** Can SolenOS turn scattered caregiver information into understandable next steps?

| Item | Detail |
|------|--------|
| Channels | Text (type/paste) + documents (PDF, image, camera) |
| Extract | `POST /api/extract` |
| Care Record path | `POST /api/situation` → situation-entry pipeline |
| Clarity path | `POST /api/analyze` → analyze-pipeline → Gemini |
| Live UI | `AddSituationPanel` — Camera, Upload, textarea, Send |
| Uncertainty DTOs | Humanize at DARE→situation (`caregiver-facing-uncertainty`); ban internal tokens on response fields |

Accept messy incomplete input. Do not wait for perfect structure. Internal extraction reasons never ship as caregiver copy.

## Voice (FUTURE — ADR-017 contract)

Libraries and interfaces remain so voice can enter the **same** User Input → Understanding → Care Record path later.

| Item | Detail |
|------|--------|
| Module | `src/lib/voice/` (interfaces + browser providers + voice-controller) |
| UI | `VoiceConversationPanel` — **unmounted** |
| STT / TTS APIs | `POST /api/observations/voice`, `POST /api/tts/synthesize` — FUTURE product surfaces |
| Gate | `assertFutureCapabilityNotMvp` / `isForbiddenMvpVoiceSurface` |

## TTS architecture (FUTURE)

**First path when re-enabled:** browser `speechSynthesis`.  
**Upgrade path:** Amazon Polly + Google Cloud TTS per ADR-013 (`src/lib/tts/`).

Hard-coded 10 languages: `en,es,zh,tl,vi,ko,fa,ar,ru,hy`.  
**Forbidden as product SoT:** ElevenLabs, Piper, mystery engines.

## Prompts & context

- System: `SOLENOS_SYSTEM_PROMPT` / Gemini execution contract
- Reasoning guidelines: [`solenos-reasoning-guidelines.md`](./solenos-reasoning-guidelines.md) — Care Reality Object pipeline; evaluation examples are **not** keyword templates ([`../02-product/solenos-mvp-reasoning-examples.md`](../02-product/solenos-mvp-reasoning-examples.md))
- Envelope: behavior/urgency/safety/observation tags + context window strategy
- Output schema exactly: `what_is_happening`, `what_matters_now`, `what_to_ask_next`, `risk_level`, `what_can_wait` (+ richer layers assembled post-LLM)

## Memory

- `memory-influence` — influence envelope on BELIEF/priority path
- Family Memory facade — compounds events IN-MEMORY
- Not a general chat memory product

## Constraints

See [ai-behavior-specification.md](./ai-behavior-specification.md) (deterministic tone, uncertainty, safety).  
MVP input: [ADR-018](../15-architecture-decisions/ADR-018-mvp-input-text-documents-only.md).  
Voice FUTURE contract: [ADR-017](../15-architecture-decisions/ADR-017-voice-conversation-browser-io-mvp.md).  
Cloud TTS (post-MVP): [ADR-013](../15-architecture-decisions/ADR-013-tts-polly-google-only.md).

## Failure modes

| Failure | Behavior |
|---------|----------|
| Missing `GEMINI_API_KEY` | 503 on analyze / situation LLM path |
| Invalid JSON from model | Gate / fail-safe |
| Document extract fails | Attachment listed; caregiver can type what they see |
| Unsafe content | Safety terminal after trust |
