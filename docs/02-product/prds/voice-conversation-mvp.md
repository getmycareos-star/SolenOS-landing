# PRD — Voice Conversation (FUTURE)

**Implementation status:** **FUTURE · STUB** — not MVP; libraries exist; UI unmounted (ADR-018)  
**Index:** [module-status.md](../../17-canonical-architecture/module-status.md)  
**ADR:** [ADR-017](../../15-architecture-decisions/ADR-017-voice-conversation-browser-io-mvp.md) (architecture contract)  
**Superseded for MVP by:** [ADR-018](../../15-architecture-decisions/ADR-018-mvp-input-text-documents-only.md)  
**Validate (when re-enabled):** Do caregivers use voice? Does it reduce cognitive load during stress?

## Product goal

> I speak naturally → SolenOS understands → SolenOS responds aloud.

Transcript is **internal only** — not the hero UX.

MVP first proves text + documents → understandable next steps. Voice plugs into the same User Input → Understanding → Care Record path later.

## Future constraints (non-negotiable when shipped)

| Layer | Preferred first path | Upgrade behind interface |
|-------|----------------------|---------------------------|
| Speech input | Browser `SpeechRecognition` | Whisper, Gemini STT, server STT |
| Speech output | Browser `speechSynthesis` | Polly, Google Cloud TTS |
| Reasoning | Gemini via `/api/analyze` / situation pipeline | — |

## Voice Conversation Mode (when mounted)

1. Caregiver taps **Voice Mode** in cognitive workspace
2. States: Listening… → Processing… → Responding…
3. Spoken input → analyze → spoken clarity
4. Multi-turn back-and-forth in memory without typing

## Distinct surfaces (all FUTURE for MVP)

| Surface | Purpose |
|---------|---------|
| **Voice Mode** | Full speak-and-hear conversation loop |
| **Dictate** | Browser STT into textarea |
| **Read Aloud** | Browser TTS on clarity results |

## Languages

Same 10 codes as settings: `en es zh tl vi ko fa ar ru hy`. Locale map in `src/lib/voice/speech-language.ts`.

## Explicitly not MVP

Do not implement as live product: voice input UI, speech recognition product path, voice conversation mode, TTS / Hear SolenOS, Whisper, voice APIs, translation-voice pipelines.
