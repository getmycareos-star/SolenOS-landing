# Retired: Gemini execution contract

This document is retained only as historical context. Gemini is not an approved SolenOS inference provider.

## Current production boundary

- Caregiver-facing model inference runs through authenticated FastAPI routes.
- The backend calls the existing private Railway Ollama deployment through `app.services.qwen_gateway`.
- The configured model is Qwen, controlled by `OLLAMA_MODEL`.
- The browser must never connect directly to Ollama or receive model credentials.
- Model output is an untrusted proposal. Backend validation, evidence ownership checks, and caregiver review remain mandatory before any Living Care Record change.
- If Qwen is unavailable or returns invalid output, the workflow must report failure. It must not silently switch to Gemini, OpenAI-hosted inference, or deterministic text substitution.

## Retired components

The former `POST /api/analyze` Gemini pipeline is closed and is not a caregiver entry point. Do not restore its provider key, model selector, or retry path.

The direct Gemini client, Gemini environment-key helper, and server-side Gemini transcription module have been removed. The remaining legacy adapter is a fail-closed compatibility stub and performs no inference. Server-side Whisper transcription is disabled. The supported MVP speech input remains browser Web Speech recognition.

## Current configuration

Backend deployment settings:
- `OLLAMA_BASE_URL`
- `OLLAMA_MODEL`
- `OLLAMA_TIMEOUT_SECONDS`
- `OLLAMA_NUM_CTX`
- `OLLAMA_NUM_THREADS`
- `OLLAMA_NUM_PREDICT`

No `GEMINI_API_KEY` or OpenAI-hosted inference key is required for the active caregiver inference path.
