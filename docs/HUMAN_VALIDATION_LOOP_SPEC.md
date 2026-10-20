# Human Validation Loop — MVP Contract v1

Post-response binary feedback layer. **Not analytics.**

## Purpose

Answer one question only:

> Does SolenOS reduce caregiver confusion after structured output is shown?

## When it runs

Only **after** SolenOS output is rendered in the UI. No background collection, no inference.

## UX flow

1. **Required:** “Was this helpful?” → `yes` | `no` (single tap, no text)
2. **Optional:** “Did this reduce confusion?” → `yes` | `no` | `skip` (non-blocking)

## Storage contract (exactly four fields)

```json
{
  "response_id": "uuid",
  "helpful": true,
  "reduced_confusion": null,
  "timestamp": "ISO-8601"
}
```

**Never stored:** user input, medical content, full outputs, session history, identity.

## Architecture position

```
SolenOS Output → UI Render → Human Validation Prompt → Store minimal signal → End
```

- Module: `src/lib/human-validation-loop/`
- API: `POST /api/feedback` (does **not** influence `/api/analyze`)
- UI: `src/components/HumanValidationLoop.tsx`

Storage is ephemeral in-memory (inspectable via `peekValidationSignals()` for dev only).

## Invalid evolution

Analytics dashboards, scoring, cohort grouping, behavioral inference, or any depth beyond binary self-report → **system invalid**.
