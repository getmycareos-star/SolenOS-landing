# 14 — Developer Onboarding

## Goal

A completely new engineer should reach: local app running → understand architecture SoT → run critical verify scripts → know where docs live.

## Run locally

```bash
npm install
copy .env.local.example .env.local
# set GEMINI_API_KEY
npm run dev
```

Open http://localhost:3000

## Architecture overview path (read in order)

1. [`docs/README.md`](../README.md) — governance completion rule
2. [`docs/17-canonical-architecture/`](../17-canonical-architecture/) — living SoT
3. `src/lib/solenos-layers/architecture-map.ts` — machine contract
4. [`docs/02-product/`](../02-product/) + PRDs
5. Module docs 05–10 matching your task
6. ADRs in [`15-architecture-decisions/`](../15-architecture-decisions/)

## Core verify starter (Path A)

```bash
npm run verify:product-path
npm run verify:product-identity
```

Path A: caregiver input → `POST /api/situation` → Living Care Record.  
Preview qualification: [`docs/13-infrastructure/preview-qualification.md`](../13-infrastructure/preview-qualification.md) · Integrity: [`docs/02-product/solenos-product-integrity.md`](../02-product/solenos-product-integrity.md)

Ops/analyze path (`verify:analyze`, `verify:solenos-v14`) is **not** the caregiver product gate. Full script list in root `package.json`.

## Mental model

```
Text/Documents → POST /api/situation → Extraction → SRE
  → CRS / ACS / Decision Memory → Response Contract → Caregiver DTO → LCR Panel
```

## Honest gaps to expect

- Auth credentials & care graph: process memory / soft care keys
- ACS/CRS durability: single-process `.data/` JSON (not multi-instance)
- Human override / reality drift: stubs
- External clinical integrations: not built
- Multi-instance / cloud production: not qualified

## Done means

Code + verify + **docs + canonical architecture (+ PRD if behavior)** per `docs/README.md`.
