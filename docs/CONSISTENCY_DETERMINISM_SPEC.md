# Consistency & Determinism — MVP Contract v1

Determinism enforcement layer for cross-run stability and structural invariance.

## Purpose

SolenOS is a **deterministic cognitive transformation engine**, not a creative system. Identical input must produce identical structure, classification, risk_level, prioritization, and field ordering.

## Three invariance checks

| Check | When | Failure type |
|-------|------|----------------|
| **Output stability** | Before every response return | `OUTPUT_STABILITY_FAILURE` |
| **Repeated input** | Same normalized input seen again in process | `CONSISTENCY_FAILURE` |
| **Prompt regression** | Verify scripts vs golden fixtures | `PROMPT_REGRESSION_FAILURE` |

Runtime prompt regression skips when no goldens are registered (live API). Verify scripts use `VERIFY_PROMPT_REGRESSION_GOLDENS`.

## Immutable output contract

Fixed top-level order:

1. `what_is_happening`
2. `what_matters_now`
3. `what_to_ask_next`
4. `risk_level`
5. `what_can_wait`
6. `follow_up_items`
7. `decision_trace` — `{ signals_used, risk_factors, prioritization_logic, confidence_drivers }`

## Pipeline position

```
… → Output Quality Gate → Determinism Gate → Response
```

Failures log through existing `failure-observability` (no new infrastructure).

## Module

`src/lib/consistency-determinism/`

## Verify

```bash
npm run verify:consistency-determinism
```
