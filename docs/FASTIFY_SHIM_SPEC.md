# Fastify Shim — Optional Infrastructure Spec v1

## Role

`fastify-shim` is an **optional, fully isolated infrastructure utility layer**.

It is **not** part of SolenOS cognition, API orchestration, or AI processing.

## Default architecture (always)

```
Client → Next.js App Router → LLM + LangChain + Zod + Decision Engine → UI
```

**Fastify is never in the default path.**

```bash
npm run dev    # Next.js only
npm run build  # Next.js only — no Fastify dependency in production bundle
```

## Optional side path (manual only)

```
Client → Fastify (buffer/proxy) → Next.js /api/v1/ingest/extract → raw text
```

Start only when explicitly needed:

```bash
# Terminal 1
npm run dev

# Terminal 2 (optional)
npm run fastify:shim
```

| Shim route | Proxies to | Purpose |
|------------|------------|---------|
| `POST /ingest/raw` | `POST /api/v1/ingest/extract` | Raw file upload proxy (pre-cognition) |
| `GET /health` | — | Infra health check |

## Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `SOLENOS_NEXT_UPSTREAM` | `http://localhost:3000` | Next.js base URL |
| `FASTIFY_SHIM_PORT` | `3001` | Shim listen port |

## Forbidden in Fastify

- LLM / LangChain calls
- `/api/analyze` or runtime execute logic
- Zod validation, decision engine, event store
- Response formatting or schema influence
- Dual API orchestration or duplicated cognitive endpoints

## Removability test

Delete `fastify-shim/` and remove `fastify` devDependencies → SolenOS runs entirely on Next.js with **no behavior change** to cognitive APIs.

## Verify

```bash
npm run verify:fastify
```

## Core principle

> One cognitive system, one execution path (Next.js). Fastify is a disposable infrastructure shim only.
