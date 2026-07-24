# Gemini 1.5 Pro Execution Contract

## Role

Gemini is a **constrained text transformer** — not the product, not a chatbot, not a medical authority.

Intelligence lives in **constraints**, not the model.

## Security (absolute)

| Rule | Requirement |
|------|-------------|
| Key location | `.env.local` only |
| Key access | `src/app/api/analyze/route.ts` **only** |
| Never in | frontend, prompts, logs, commits, client bundles |

Copy `.env.local.example` → `.env.local` and set `GEMINI_API_KEY`.

**If a key is exposed in chat or commits → rotate immediately in Google AI Studio.**

## Pipeline

```
Input normalization
→ Gemini execution envelope (LangChain)
→ Gemini 1.5 Pro (server-side, apiKey from route)
→ Raw capture (exact string)
→ JSON.parse (strict, no repair)
→ Zod validation
→ return | retry | fail
```

## Execution envelope (required)

Each attempt rebuilds from scratch:

```
SYSTEM: SolenOS System Prompt
RULE: Return ONLY valid JSON...
SCHEMA: { what_is_happening: string, ... }
INPUT: {{normalized_user_input}}
```

On retry: RULE switches to retry text only — **no prior JSON included**.

## Model

Default: `gemini-1.5-pro` (`SOLENOS_GEMINI_MODEL` override)

## Retries

Max **2 retries** (3 total LLM calls) on `JSON.parse` or Zod failure.

Final failure:

```json
{ "error": "unable_to_process", "reason": "invalid_model_output" }
```

## Verify

```bash
npm run verify:gemini
npm run verify:analyze
```

Modules: `src/lib/gemini-contract/`, `src/lib/solenos-langchain-adapter/gemini.ts`
