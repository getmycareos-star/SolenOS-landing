# MVP Architecture Constraints — Legacy Ops Analyze Path

> **Product identity (authoritative):** SolenOS is an evolving intelligence layer — the Living Care Record — not a stateless API and not “memory optional.”  
> Caregiver MVP entry: `POST /api/situation`.  
> This document describes the **legacy / ops** `POST /api/analyze` compression surface only.

## Ops path definition (not product identity)

The analyze route is a **stateless cognitive transformation** request/response for ops tooling:

```
caregiver input → structured cognitive clarity JSON
```

Single-request → single-response on this path. It does **not** redefine SolenOS as lacking durable care memory. Durable Living Care Record continuity lives on `/api/situation` and related spine stores.

## Allowed surface (historical analyze boundary)

| Layer | Allowed |
|-------|---------|
| Frontend | `src/app/page.tsx` (+ required `layout.tsx`, `globals.css`) — caregiver UI now uses Living Care Record panels |
| Backend (this path) | `POST /api/analyze` (ops-gated) |
| LLM | Gemini **or** Ollama — single pass |
| Prompt | LangChain JS — assembly only |
| Validation | Zod strict gate |
| Utility (optional) | `tika-extractor` lib — file → text (no MVP API route) |

## Immutable flow (analyze only)

```
Input → /api/analyze → LangChain → LLM → Zod → Response
```

No branching, multi-step chains, parallel inference, or hidden paths on this route.

## LLM configuration

| Provider | Env |
|----------|-----|
| Gemini | `GEMINI_API_KEY` |
| Ollama | `OLLAMA_BASE_URL` (default `http://127.0.0.1:11434`) |
| Override | `SOLENOS_LLM_PROVIDER=gemini\|ollama`, `SOLENOS_LLM_MODEL` |

**Cost budget:** 1 LLM call ideal, **max 2 total** (1 retry on Zod failure only).
