# /api/analyze — Core Execution Pipeline v1

## Role

The **only cognitive execution layer** in SolenOS MVP.

Transforms: `input string → structured SolenOS Decision JSON`

Stateless. No memory, cache, events, or session persistence.

## Request

```typescript
type AnalyzeRequest = {
  input: string;
  source_type: "text" | "document";
};
```

Document extraction happens **before** this endpoint (`/api/v1/ingest/extract`).

## Pipeline (immutable order)

```
1. Input Normalization
2. Prompt Assembly (LangChain)
3. Gemini LLM Call (single pass)
4. Zod Validation (SolenOSSchema)
5. Retry (max 2, exact notice)
6. Response Return
```

## Success response

Returns the **exact** Zod-parsed object — six SolenOS fields, no metadata:

```json
{
  "what_is_happening": "...",
  "what_matters_now": "...",
  "what_to_ask_next": "...",
  "risk_level": "low",
  "what_can_wait": "...",
  "follow_up_items": []
}
```

## Failure response (422)

After 3 attempts (initial + 2 retries):

```json
{
  "error": "unable_to_process",
  "reason": "invalid_model_output"
}
```

## Configuration

Requires `GEMINI_API_KEY`. LLM provider for this endpoint is **Gemini only**.

## Module layout

| Path | Role |
|------|------|
| `src/app/api/analyze/route.ts` | HTTP boundary |
| `src/lib/analyze-pipeline/` | Normalize, orchestrate, retry |
| `src/lib/solenos-langchain-adapter/` | Prompt + Gemini invoke |
| `src/lib/response-validator/` | Zod hard gate |

## Verify

```bash
npm run verify:analyze
```

## Related endpoints

`POST /api/v1/runtime/execute` remains the event-sourced deterministic runtime (separate path).
