# ADR-013 — TTS engines: Amazon Polly + Google Cloud TTS only

> **MVP note (ADR-018):** Voice / TTS / Hear SolenOS are **not** MVP product surfaces. This ADR governs the **FUTURE cloud TTS upgrade path** via `src/lib/voice/speech-output/future/` and `src/lib/tts/` when voice is re-enabled (ADR-017 contract).

## Decision

All SolenOS voice **output** uses exactly two engines:

1. **Amazon Polly** (neural) for: `en`, `es`, `zh`, `ko`, `ru`, `ar`
2. **Google Cloud TTS** (Wavenet) for: `tl`, `vi`, `fa`, `hy`

Hard-coded language preference set (never add/remove/rename without ADR):

`en`, `es`, `zh`, `tl`, `vi`, `ko`, `fa`, `ar`, `ru`, `hy`

Voice output always follows `users.language_preference` (and mirrors `voice_language`). Documents may remain English; spoken output must be in the user’s language.

**Forbidden engines:** ElevenLabs, Piper, browser `speechSynthesis` as product SoT, or any other TTS vendor.

## Alternatives considered

- Piper (local) — rejected: inconsistent quality / not the approved dual-cloud contract
- ElevenLabs — rejected: not on the approved engine list
- Single-vendor Polly-only — rejected: Tagalog / Vietnamese / Farsi / Armenian coverage requires Google

## Reason selected

Predictable routing, calm SSML prosody (slow rate, low pitch, 300ms breaks), Female/Male preference mapped to neural voice IDs where available, soft-fail when credentials missing.

## Tradeoffs

- Two cloud credential surfaces to operate
- Soft-fail means “Listen” may be unavailable until creds are configured
- Some languages have a single neural voice (male preference falls back to the same ID)

## Future implications

3am Voice Mode / Weekly Care Briefing / Crisis / Benefit-Tracker hooks must call `synthesizeSpeech` / `synthesizeForVoiceSurface` — never invent a third engine.

See: `src/lib/tts/`, `docs/10-ai-systems/`, migration `013_voice_observation_tts.sql`.
