# 07 — Confidence Engine

**Paths:** `src/lib/confidence-layer`, `derived/compute-confidence.ts`  
**Status:** IMPLEMENTED DERIVED.

## Purpose

Answer “Am I doing enough?” with a **0–100 reassurance score** and plain-English explanation. Does **not** rank situations (Priority Contract does).

## Formula (as implemented)

```
score = 82
      + min(12, completedCritical×4)
      − missingCritical×7
      − unresolvedHighRisk×6
      − loadPenalty[LOW:0 | MOD:4 | HIGH:12 | CRIT:22]
      − avgBeliefUncertainty×18
      − conflictPenalty×28 − openConflicts×3
      − min(25, sum(top3 crisis probs)×30)
      − burnout×15

if failSafe → cap at 42
clamp 0–100
```

`missingCritical` ≈ criticalUnassigned + overdue + overdueCritical + max(0, highPressureOpen−1).

## Explanation templates

Built in `buildConfidenceExplanation` — examples:

- Fail-safe: clarifying first is the right call
- Three critical completed: explicit praise of finished risk work
- Heavy load: remaining items important but not all urgent
- High-risk open: address those before lower-priority tasks

## User-facing outputs

Payload via confidence layer: `{ confidence, missingCriticalActions, unresolvedHighRiskSituations, explanation, guaranteeOk }`.

## Assumptions

- Inputs truthful relative to current in-memory STATE
- Crisis list optional; empty list ≠ “no world risk”, only “no emitted predictive risks”

## Failure modes

- Guarantee fails if explanation empty or score out of range
- Using score to hide CRITICAL×NOW → forbidden

## Scale / modify

Keep pure function; add inputs only with ADR if semantics change. Verify: `verify:confidence-layer` (alias of caregiver-expansion).
