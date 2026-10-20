# ADR-017 — Voice Conversation: browser-only speech I/O (FUTURE)

## Status

**Superseded for MVP** by [ADR-018](./ADR-018-mvp-input-text-documents-only.md) (text + documents only).

**Retained as FUTURE architecture contract** — modular browser speech I/O behind interfaces so voice can plug into the same User Input → Understanding → Care Record path later.

Originally accepted as “Voice Conversation MVP”; that MVP scope is **revoked**. Do not mount voice conversation, mic dictation, or Hear SolenOS / Read Aloud in the live MVP product surface.

## Context

When voice returns, caregivers should **speak naturally → SolenOS understands → SolenOS responds aloud**. This is not speech-to-text software; transcript is internal only.

Voice validates a different question than MVP: *Do caregivers use voice? Does it reduce cognitive load during stress?* MVP first proves: *Can SolenOS turn scattered text/documents into understandable next steps?*

## Decision (future when re-enabled)

### Speech input

**Browser Web Speech API (`SpeechRecognition`) preferred first path.**

Forbidden as default primary path without a new ADR: Whisper, OpenAI Speech, Gemini audio STT, Deepgram, AssemblyAI, server-side STT as the only path.

### Speech output

**Browser `speechSynthesis` preferred first path** for conversation responses and Read Aloud.

Cloud TTS (Polly/Google per ADR-013) remains the documented upgrade path behind `ISpeechOutput`.

### Reasoning

**Gemini API** via existing understanding routes (`POST /api/analyze` / situation pipeline) — text in, structured clarity out. No Voice→Whisper→Translation→Gemini pipeline.

### Modular architecture

```
src/lib/voice/
  interfaces/          # ISpeechInput, ISpeechOutput, IVoiceController
  speech-to-text/      # browser-web-speech.ts
  speech-to-text/future/  # whisper, gemini-stt, server-transcribe (FUTURE)
  speech-output/       # browser-speech-synthesis.ts
  speech-output/future/   # cloud-tts (FUTURE)
  voice-controller/    # Listening | Processing | Responding loop
```

Application code depends on **interfaces**, not providers. Voice becomes another channel into the generic input pipeline — never a separate product brain.

### Multilingual

Map `language_preference` (10 SolenOS codes) to Web Speech locales. No translation pipeline between STT and TTS.

## Alternatives rejected

- Server STT + cloud TTS as required MVP path — credential dependency
- Chat-style transcript UI as hero — violates cognitive-clarity positioning
- Single monolithic voice module without interfaces — blocks Whisper/Polly plug-in later

## Consequences

- Keep `src/lib/voice*`, `src/lib/tts*`, unmounted panels, and verify scripts as **future** contracts
- Live MVP: `AddSituationPanel` only (ADR-018)
- ADR-013 remains valid for **post-MVP cloud TTS routing** when credentials exist
- Gate: `assertFutureCapabilityNotMvp` + `isForbiddenMvpVoiceSurface`

## Verification

- `npm run verify:mvp-surface-area` — no mic / voice in live composer
- `npm run verify:voice-conversation` — future module contract (libraries exist; not MVP UI)

See: `docs/02-product/prds/voice-conversation-mvp.md`, `src/lib/voice/`.
