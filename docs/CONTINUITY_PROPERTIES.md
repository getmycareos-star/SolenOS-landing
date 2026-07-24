# Continuity Properties — One System Refinement

> Documents are refinements of **one** CareEvent → CareContext runtime — not a feature backlog.

Module: `src/lib/continuity-properties` (vertical integration; **not** a new MVP pillar)

## Properties attached to the existing loop

| Property | Role |
|----------|------|
| **SRL** Source Reliability | Input truth quality on every CareEvent — independent from system confidence |
| **EUM** Explicit Unknowns | Structured missing facts on Care State (known / inferred / unknowns) |
| **OML** Outcome Measurement | Existing `src/lib/oml` — emitted on every Continuity cycle |
| **FDLL** Inference Learning | Explicit caregiver feedback only (correct / incorrect / partial) |
| **Failure map** | Questions → continuity failures → engines (search-only → content) |

## One runtime

```
Observation → CareEvent (+ SRL)
  → CareContext update
  → Timeline / Diff / State of Care (+ EUM)
  → Clarification (from high-priority unknowns)
  → Evidence / Trust
  → OML snapshot
  → Explicit feedback (FDLL) → weight updates
```

## Product rule

Caregiver questions are symptoms of failures. SolenOS eliminates the conditions that make those questions necessary.

## Verify

```bash
npm run verify:continuity-properties
```
