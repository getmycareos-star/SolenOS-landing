# SolenOS — Failure-First Product Intelligence

> **Caregiver questions are not the product. They are symptoms of failures in continuity, memory, coordination, progression awareness, or decision-making.**

---

## Core principle

Every recurring caregiver question represents a **failure somewhere in the current care system**.

SolenOS identifies that failure and determines whether **continuity can eliminate or reduce it**.

The product is built around **system failures**, not questions.

---

## New product rule

Stop viewing caregiver questions as isolated requests.

Instead ask:

1. **What failed** that caused this question to exist?
2. If continuity can eliminate that failure → **build that capability**
3. If continuity cannot (e.g. insurance eligibility) → **educational content**, not core product

Implementation: `classifyCaregiverFailure()`

---

## Failure mapping examples

| Question | NOT about | Failure | Product response |
|---|---|---|---|
| "Is it time for 24/7 care?" | 24/7 care options | Invisible progression | Timeline, Diff, State of Care, Pattern Learning |
| "Am I doing enough?" | Moral judgment | No objective view | State of Care, Transparency Panel, Load, Confidence |
| "I can't remember the last appointment" | Better memory | Memory reconstruction failure | Immutable CareEvents, Timeline, Visit Summaries |
| "Should I hire professional help?" | An opinion | Decision without context | Progression, burden, trends, State of Care |
| "Is this behavior normal?" | Medical norms | No context for change | Timeline, Diff, Patterns, Uncertainty Layer |
| "I'm overwhelmed" | Therapy chat | Cognitive overload | Attention Budget, Prioritization, Return Value, Load |

---

## Failure → engine map

Every engine exists because it eliminates a specific failure:

| Failure | Engine |
|---|---|
| Memory failure | Timeline Reconstruction |
| Progression invisible | Diff Engine |
| Fragmented observations | CareContext |
| Contradictory reports | Contradiction Detection |
| Missing information | Clarification Engine |
| Decision overload | Prioritization Engine |
| Cognitive overload | Attention Budget |
| Low trust | Care Transparency Panel |
| Returning after absence | Return Value Loop |
| Emotional overload | Caregiver Load Engine |

**If an engine cannot be tied to a real caregiver failure, it is not MVP.**

Implementation: `FAILURE_ENGINE_MAP` in `failure-engine-map.ts`

---

## Product opportunity

Instead of asking *"Is my parent getting worse?"*, the caregiver opens SolenOS and immediately sees:

- What changed
- What is stable
- What needs attention
- What is uncertain
- What should happen next

**The question disappears** because the system already surfaced the answer.

Implementation: `buildOpeningSurface()`

---

## Feature evaluation rule

Before building any feature:

| Criterion | Required |
|---|---|
| Which caregiver failure does this solve? | Must identify |
| Reduces uncertainty? | ≥2 of 4 |
| Reduces cognitive load? | impact criteria |
| Reduces reconstruction? | to pass |
| Fewer questions needed? | |

If no → **outside core mission**.

Implementation: `evaluateFeature()`

---

## Final product invariant

SolenOS succeeds when it systematically removes failures through a continuously updated, evidence-based CareContext — so caregivers increasingly stop asking those questions because the system has already made the evolving care situation understandable.

---

## Code map

```
src/lib/care-context/
  failure-engine-map.ts      — failure → engine canonical map
  classify-failure.ts        — failure-first classification + feature gate
  opening-surface.ts         — what caregivers see on open
  diagnose-question-failure.ts
  proactive-surface.ts
  engines/attention-budget.ts
  engines/contradiction-detection.ts
```

See also: [PRODUCT_FAILURE_MODEL.md](./PRODUCT_FAILURE_MODEL.md)
