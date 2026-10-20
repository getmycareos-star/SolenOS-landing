# Uncertainty Preservation Engine (SolenOS)

**Status:** Locked architecture directive  
**Authority:** Situation Generator · Intelligence Validation · Care Reality Memory · Response Contract  
**Companions:** [`solenos-situation-generator.md`](./solenos-situation-generator.md) · [`solenos-intelligence-validation.md`](./solenos-intelligence-validation.md) · [`solenos-clinical-situation-classification.md`](./solenos-clinical-situation-classification.md) · [`solenos-response-intelligence-upgrade.md`](./solenos-response-intelligence-upgrade.md)  
**Module:** `src/lib/care-reality-intelligence/uncertainty-preservation.ts`  
**Verify:** `verify:uncertainty-preservation`

---

## Purpose

SolenOS must **stop acting like it knows the cause of events**.  
It must separate **what happened** from **why it happened**.

| Unsafe | Correct |
|--------|---------|
| Observation → Diagnosis | Observation → Possible relationships → Unknowns preserved |
| Correlation → Cause | Timing held · cause unknown |

The value is not answering faster. The value is helping families see: **what changed · what is connected · what is known · what is uncertain**.

---

## Core principle

**Preserve uncertainty — do not remove it.**

Trust comes from knowing the difference between:

- “We know this happened.”
- “We are still trying to understand why.”

---

## Required internal model (per important care fact)

```
Observation
|
├── What happened?
├── When did it happen?
├── Source
├── Confidence (observation vs cause — separate)
├── Related events
├── Possible explanations
└── Unknowns
```

**Never store conclusions as facts.**

| Bad | Good |
|-----|------|
| Medication caused confusion | Medication changed · Confusion increased afterward · Possible relationship · Cause unknown |

---

## Caregiver-facing structure

Always separate (human language — never confidence % or engine enums):

1. **What we know** — facts directly supported by caregiver input  
2. **What may be connected** — events near each other in time  
3. **What remains unclear** — what would improve understanding  

### Output rule

❌ “The medication caused Mom's increased sleep.”  
✅ “Mom's increased sleeping happened around the same time as a medication change. It may be useful to understand what medication changed and why.”

---

## Confidence (engine-only)

| Layer | Typical band | Meaning |
|-------|--------------|---------|
| Observation | High when directly reported | Caregiver stated what happened |
| Cause / explanation | Low unless evidence supports | Timing ≠ proven cause |

Never show confidence scores or % to caregivers.

---

## Forbidden assumptions

Do not assume:

- Medication side effects as fact  
- Disease progression as fact  
- Emergencies without evidence  
- Caregiver mistakes  
- Family conflict as the cause of care problems  

Examples in this doc are **illustrations only** — never product if-branches on scenario nouns.

---

## Acceptance test

**Input:** Mom became confused after her medication changed.

| Failed | Successful |
|--------|------------|
| The medication caused confusion. | Confusion increased after a medication change. Events are close in time; reason remains unclear. Understanding which medication changed and why may help. |

---

## Pipeline

```
Text → Situation Classification → Uncertainty Preservation → Care Reality Model → Human Understanding
```

Never: Text → Explanation → False certainty.
