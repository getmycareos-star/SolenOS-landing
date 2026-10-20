# PRD — Voice Observation Capture (FUTURE)

**Implementation status:** **FUTURE · STUB** — not MVP (ADR-018); text observation via `observation-intelligence` is **INTERNAL · IMPLEMENTED**  
**Index:** [module-status.md](../../17-canonical-architecture/module-status.md)  
**KPI (when re-enabled):** `observations_per_caregiver_per_week`  
**Principle:** Capture First. Intelligence Second.

MVP observation capture may use **text**. Voice tabs, mic, and Hear SolenOS are post-MVP.

## Problem

Caregivers need a low-friction way to record what they observe about a loved one. Without consistent capture, pattern intelligence cannot compound.

## What this is (future)

- Voice + text observation capture into the same record shape (`source_type: voice | text`)
- Web Speech (browser) live dictation — preferred first path; server STT FUTURE (`src/lib/voice/speech-to-text/future`)
- Heuristic multi-signal extraction (ontology) — never diagnoses
- Weekly summary + doctor export (HTML / text / PDF print stub)
- TTS Listen for accessibility readback — browser speechSynthesis first; cloud TTS FUTURE per ADR-013

## What this is NOT

- Chatbot / AI companion / "Hello I'm SolenOS AI"
- Dementia diagnosis or clinical decision support
- Care coordination platform
- Conversational voice agent
- An MVP requirement (see ADR-018)

## Languages

Exact 10: `en es zh tl vi ko fa ar ru hy` (settings + TTS + Gemini). See ADR-013 for TTS routing.

## Success

Caregivers record observations consistently enough for pattern intelligence to compound — without turning SolenOS into a voice assistant product.
