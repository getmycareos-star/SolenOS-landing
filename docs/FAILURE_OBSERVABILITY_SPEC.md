# Failure Observability — Minimal Debug Contract v1

## Purpose

Answer only: **“At which pipeline stage did SolenOS fail?”**

Not analytics, telemetry, dashboards, or user tracking.

## Privacy (absolute)

**Never stored:** user input, medical content, raw model output, identifiers, full logs.

**Allowed metadata only:**

```json
{
  "timestamp": "ISO-8601",
  "stage": "prompt | model | zod | postprocess",
  "failure_type": "PROMPT_FAILURE | MODEL_STRUCTURE_FAILURE | ZOD_VALIDATION_FAILURE | OVERLOAD_FAILURE | INFERENCE_INCONSISTENCY_FAILURE",
  "retry_count": 0
}
```

## When logging occurs

Only on validation failure, retry, or rejection — **never** on success.

## Stage → failure mapping

| Event | Stage | Type |
|-------|-------|------|
| Input overload tags | `prompt` | `OVERLOAD_FAILURE` |
| Invalid JSON | `model` | `MODEL_STRUCTURE_FAILURE` |
| Zod schema fail | `zod` | `ZOD_VALIDATION_FAILURE` |
| Quality gate fail | `postprocess` | `PROMPT_FAILURE` |
| Retry output drift | `postprocess` | `INFERENCE_INCONSISTENCY_FAILURE` |

## After max retries

1. **Preferred:** return last Zod-valid structured output (if any)
2. **Else:** `{ error: "unable_to_process", reason: "pipeline_failure" }`

## Module

`src/lib/failure-observability/` — ephemeral per-request collector + `peekLastFailureLogs()` for dev/debug only.

Not included in `/api/analyze` user responses.

## Verify

```bash
npm run verify:failure-observability
```

Removable without changing successful runtime behavior.
