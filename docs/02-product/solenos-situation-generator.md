# Situation Generator Architecture (SolenOS)

**Status:** Locked architecture directive  
**Authority:** Care Recipient Anchor · Baseline Comparison · Initial Care Reality Assessment · Situation Model · Relationship Extraction  
**Companions:** [`solenos-care-reality-situation-model.md`](./solenos-care-reality-situation-model.md) · [`solenos-care-recipient-anchor.md`](./solenos-care-recipient-anchor.md) · [`solenos-baseline-comparison-engine.md`](./solenos-baseline-comparison-engine.md) · [`solenos-relationship-extraction.md`](./solenos-relationship-extraction.md) · [`solenos-mvp-situation-relationship-architecture.md`](./solenos-mvp-situation-relationship-architecture.md) · [`solenos-care-reality-memory.md`](./solenos-care-reality-memory.md)  
**Module:** `src/lib/care-reality-intelligence/situation-generator.ts`  
**Verify:** `verify:situation-generator`

---

## Problem

Extraction is not enough. Caregivers do not need a list of extracted facts.

They need help understanding:

> **What is happening right now?**

Scattered observations must become an understandable **care situation**.

| Weak pipeline | Required pipeline |
|---------------|-------------------|
| Message → extract → summarize → respond | Message → care reality extraction → **situation generation** → relationship mapping → uncertainty → human-oriented response |

Summaries, notes, and task lists are not understanding.

---

## Core rule

Every caregiver input must produce an internal **Active Situation** that answers:

1. Who is this about?  
2. What is happening?  
3. What changed?  
4. What events connect?  
5. What decisions have happened?  
6. What is unknown?  
7. How confident are we? (engine-only — never % in caregiver UI)

This is a **derived understanding object** — not a second ACS store. Durable ACS remains the Living Care Record spine; the generator projects understanding for orientation.

---

## Situation object (internal)

```
Active Situation
├── Care Recipient
├── Current Concern (what is happening now)
├── Observed Changes
├── Related Events
├── Related Decisions
├── Possible Relationships (may connect — not proven cause)
├── Family / contributor context (never primary)
├── Unknowns
└── Confidence (engine-only bands)
```

---

## Priority order

1. Care recipient condition  
2. Changes from normal (when comparable prior or reported change discourse)  
3. Safety-related events  
4. Recent medical events  
5. Decisions already made  
6. Caregiver / family context  
7. Administrative details  

---

## Not diagnosis

| Never | Instead |
|-------|---------|
| “Mom is declining.” | “A change has been observed.” |
| “Medication caused confusion.” | “This occurred around the same time as another event.” |
| “This is dementia progression.” | “The cause is currently unclear.” |

---

## Situation linking

Separate captures about hospital → medication → sleep should form a **possible connected situation**, not three unrelated notes. Certainty: needs confirmation — never invented causation.

---

## Human response

Answer: **What do we understand?**  
Never: **What did you write?**

| Bad | Good |
|-----|------|
| “You mentioned confusion, sleeping, hospital…” | “Several changes appear close together after the hospital visit — confusion, sleep, and whether medication may be related remain the focus; cause unclear.” |

---

## Acceptance test (illustration)

Input about Dad: forgetting places, stopped morning routine enjoyment, more tired after medication change.

| Fail | Succeed |
|------|---------|
| Sentence list · tasks · echo · generic dementia advice | Current understanding of routine/energy/behavior · what changed · medication as possible connection · still unclear · one high-value ask |

---

## Final principle

Do not ask: *What information is inside this message?*  
Ask: *What situation is this caregiver living through?*

Advantage = clearer picture of reality from fragmented experience — not better extraction.
