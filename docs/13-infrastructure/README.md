# 13 — Infrastructure

## Runtime

- **App:** Next.js 15 (`next.config.ts` currently empty defaults)
- **UI:** React 19
- **API:** App Router route handlers
- **Optional:** `fastify-shim` (not default path)

## Environment

Copy `.env.local.example` → `.env.local` (or add keys to `.env`).

**Restart required:** Next.js reads env files only at process start. After adding or changing `GEMINI_API_KEY` (or any variable) in `.env` or `.env.local`, restart `npm run dev`.

| Variable | Role |
|----------|------|
| `GEMINI_API_KEY` | Required for `/api/analyze` and Gemini server STT (`/api/observations/voice`) |
| `SOLENOS_GEMINI_MODEL` | Default gemini-1.5-pro |
| `SOLENOS_LLM_PROVIDER` | gemini \| ollama \| openai |
| `SOLENOS_LLM_MODEL` | Override |
| `OPENAI_*` / `OLLAMA_*` | Alternate providers |
| `DATABASE_URL` | Postgres telemetry |
| `SOLENOS_TELEMETRY_DISABLED=1` | Disable writes |
| `TIKA_*` / `TESSERACT_OCR` | Document extract util |

**Security note:** never commit real keys; keep `.env.local` private. Rotate if an example file ever contained a live key.

## Deploy assumptions

- **No** checked-in `Dockerfile`, `vercel.json`, or CI workflows found at documentation time
- Assume single Node process: **in-memory stores are not multi-instance safe**
- Horizontal scale requires durable STATE + shared session store (ADR required)

**Internal preview qualification:** [`preview-qualification.md`](./preview-qualification.md) — Path A gate `npm run verify:product-path`; same-machine `.data/` yes; cloud/multi-instance **not** qualified.

## Observability

- Failure observability / isolation modules exist in-lib; verify scripts cover contracts
- `system_events` / cases tables for architectural event ledger when wired

## Modify safely

Document new env vars here + onboarding. Do not put secrets in `architecture-map.ts` or docs.
