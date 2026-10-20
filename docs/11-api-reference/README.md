# 11 — API Reference

**Base:** Next.js App Router under `src/app/api/**`.  
**Auth middleware:** none. Identity endpoints verify credentials against in-memory maps only.

## Routes

### `POST /api/analyze`
- **Auth:** none (open). Requires `GEMINI_API_KEY` or **503**.
- **Body:** `{ input, source_type: "text"|"document", telemetry_user_id?, care_session_id?, prior_input_raw?, resume_context?, language_preference?, governance_settings? }`
- **Behavior:** Full analyze-pipeline; returns clarity fields + optional layers (trust, safety, confidence, crisis, delegation, load, continuity, …).
- **Errors:** 422 pipeline/validation; 503 missing LLM key.

### `POST /api/observations`
- Body: `{ raw_text, caregiver_id?, source?: "text"|"voice" }`
- Records observation intelligence (heuristic). Default caregiver `default_caregiver`.
- MVP product path: **text** (`source: "text"`). Voice source is FUTURE (ADR-018).

### `POST /api/observations/voice` — FUTURE
- Multipart: `audio`|`file`, optional `caregiver_id`, `language_hint`, `edited_transcript`, `preview_only`
- Server STT priority: Whisper (`OPENAI_API_KEY`) → Gemini (`GEMINI_API_KEY`) → none
- **Not an MVP product surface** (ADR-018). Prefer text observation via `POST /api/observations`.
- No server STT keys → **503** with `client_stt_hint`.

### `GET /api/observations/weekly-summary`
- Query: `caregiver_id?` → weekly pattern JSON (counts, recurring, emotional/memory incidents, changes).

### `GET /api/observations/export`
- Query: `caregiver_id?`, `format=html|text|json|pdf` → export report.
- `pdf` is HTML print stub (`X-SolenOS-Pdf-Path: html_print_stub`) until pdfkit.

### `POST /api/tts/synthesize` — FUTURE
- Body: `{ text, language_preference?, voice_profile?: "female"|"male" }`
- Returns MP3 (Polly or Google Cloud TTS by language). Soft-fail **503** if credentials missing.
- **Not MVP** (ADR-018). Accessibility readback only when voice UI is re-enabled — not a conversational chat endpoint.

### `POST /api/human-override`
- Body: `{ situationId, kind: dismiss_priority|override_assumption|mark_wrong_reasoning, targetId?, note?, userId? }`
- **STUB:** records intent; does not mutate STATE/BELIEF.

### `POST /api/identity/signup`
- Body: `{ care_session_id, email, password (≥8), telemetry_user_id? }` → bind ephemeral→persistent (in-memory credentials).

### `POST /api/identity/login`
- Body: `{ email, password, care_session_id? }` → 401 bad creds; 404 missing care graph; else rehydrate.

### `GET|PATCH /api/user/language`
- Keyed by `telemetry_user_id` UUID; language preference among `SOLENOS_LANGUAGES`.

### `POST /api/support-signal/evaluate`
- Evaluates deliver/suppress support signal from care context / depletion / inactivity inputs. Push delivery out of scope.

### `POST /api/feedback`
- `{ interaction_id, helpful_yes_no, reduced_confusion_yes_no }` — does not influence analyze ranking. 503 if store unavailable.

### `POST /api/extract`
- Multipart: `file` (also accepts `document` / `image`) — image or PDF.
- **Status:** IMPLEMENTED helper for MVP workspace. Wraps existing `tika-extractor` (Apache Tika + **Tesseract.js** OCR).
- Returns `{ filename, content_type, text, ok, extractor: "tika_tesseract", note? }`.
- **Not PaddleOCR.** Full self-hosted PaddleOCR (GPU sidecar/WASM) is documented as FUTURE; production PDFs need Tika server (`TIKA_SERVER_URL`).

## Integrations

See [integrations/](./integrations/) for external system contracts (mostly FUTURE).

## README drift note

Root `README.md` still describes analyze-only MVP surface; this file is authoritative for current routes.
