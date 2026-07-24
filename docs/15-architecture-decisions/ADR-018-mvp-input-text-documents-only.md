# ADR-018 — MVP Input Architecture: Text + Documents Only (No Voice)

## Status

**Accepted** — 2026-07-15

Supersedes ADR-017 for **MVP product scope**. ADR-017 remains the **future** modular voice I/O contract (interfaces + browser adapters), not an MVP ship decision.

> **Note:** Previously drafted as a second “ADR-016”. Canonical ID is **ADR-018** to avoid collision with [ADR-016](./ADR-016-bw-four-state-cognitive-workspace.md) (B&W cognitive workspace).

## Context

SolenOS must prove:

> **Can SolenOS turn scattered caregiver information into understandable next steps?**

Caregivers arrive with chaos — pasted messages, photos of paperwork, incomplete notes. The MVP must **accept and process that mess** without waiting for perfect structure.

Voice (mic STT, conversation mode, TTS/read-aloud, Whisper, voice APIs, translation-voice pipelines) adds browser-permission fragility and validation cost without proving the core continuity thesis.

## Decision

### MVP input methods (only)

1. **Documents / evidence capture** (see Input Entry Contract)
   - **Scan** — physical documents via document scanner (not file picker; not photo-mode-first)
   - **Snap** — live camera for something happening now (not document scanning)
   - **Upload** — existing files via system file picker (never camera/scanner)
   - **Share** — OS Share Target into SolenOS where supported
   - Extract useful information (OCR / Tika) into the **same** understanding pipeline

2. **Text**
   - Typed notes, questions, updates, and observations
   - Pasted text / messages

**Critical:** Entry methods only collect evidence. Origin must never change the reasoning engine.
SoT: [`docs/02-product/solenos-input-entry-contract.md`](../02-product/solenos-input-entry-contract.md).

### Explicitly out of MVP (do not ship UI)

- Voice input / speech recognition
- Voice conversation mode
- Text-to-speech / “Hear SolenOS” / Read Aloud
- Audio processing, Whisper, voice APIs, translation-voice pipelines

### Core MVP flow

```
Document / Photo / Text
        ↓
Processing layer
        ↓
Understanding + extraction (Gemini where needed)
        ↓
Care actions + care timeline updates
```

### Pipeline shape (keep generic for future voice)

```
User Input (text | document [ | voice later ])
        ↓
Understanding Layer
        ↓
Care Record / Actions
```

Voice may enter the **same** ingestion → understanding → Care Record path later. Do not hard-wire the architecture so voice can never be added — but do not mount voice UI in MVP.

### Product rules

- Accept messy, incomplete, unstructured input.
- Capture always succeeds when consent allows; interpretation may degrade.
- Prioritize: document ingestion reliability, OCR quality, information extraction, care timeline, action generation, clear summaries.

## Consequences

- Live workspace composer: **Snap**, **Scan**, **Upload**, **Share**, **Add to record** + textarea (`AddSituationPanel`). Document-only submit is valid when extracted text is ready.
- Share Target: `public/manifest.webmanifest` → `/share-target` → same Living Care Record path.
- Libraries under `src/lib/voice*`, `src/lib/tts*`, and unmounted panels remain as **future** contracts — not product surfaces.
- ADR-013 (TTS provider choice) and ADR-017 (browser voice I/O modules) remain valid for a **future** phase; they do not authorize MVP voice/TTS UI.
- Observation text capture may remain; observation **voice** tabs / mic / Hear SolenOS are post-MVP.

## References

- Module: `src/lib/mvp-input-architecture/`
- Live composer: `src/components/mvp-workspace/AddSituationPanel.tsx`
- Architecture map: `MVP_INPUT_ARCHITECTURE`
- Product north star: reduce memory reconstruction of the care journey
- Supersedes for MVP: [ADR-017](./ADR-017-voice-conversation-browser-io-mvp.md)
