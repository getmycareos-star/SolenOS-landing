# 30-Second Caregiver Understanding Test (SolenOS)

**Status:** Locked architecture directive  
**Authority:** Intelligence Validation · Output Quality · Situation Generator · Product Constitution  
**Companions:** [`solenos-intelligence-validation.md`](./solenos-intelligence-validation.md) · [`solenos-output-quality.md`](./solenos-output-quality.md) · [`solenos-emotional-language-safety.md`](./solenos-emotional-language-safety.md) · [`solenos-response-intelligence-upgrade.md`](./solenos-response-intelligence-upgrade.md)  
**Module:** `src/lib/care-reality-intelligence/caregiver-understanding-test.ts`  
**Verify:** `verify:caregiver-understanding-test`

---

## Problem

Caregivers do not open SolenOS for a summary. They open it because they are carrying **uncertainty**.

A response can be factually correct and still fail if the caregiver finishes and feels:

- “I already knew that.”  
- “It just repeated what I said.”  
- “I still don’t understand what matters.”  
- “I don’t know what changed.”

---

## Core rule (midnight test)

Before showing any response, evaluate:

> If this caregiver reads this at midnight during a stressful moment, will they understand their situation **better than before**?

If no → **reject / regenerate**. MVP: hard reject so failed output never reaches the panel.

---

## Four improvement dimensions

Every response should improve **at least one** (rich multi-facet captures should improve **more than one**):

| Dimension | Improves when the caregiver… |
|-----------|------------------------------|
| **Understanding** | Sees the current situation more clearly than raw facts |
| **Orientation** | Sees where this fits in the care story / pattern |
| **Uncertainty reduction** | Sees what is known vs still unclear |
| **Priority** | Sees what matters most (not a seven-item dump) |

---

## Failed patterns (reject)

1. **Repeat the caregiver** — near-echo of input  
2. **Unnecessary task lists** — work without understanding  
3. **Too many questions** — interview under stress  
4. **Low-value focus** — family disagreement centered over care recipient  

---

## Required internal reasoning (before language)

Who · What changed · Baseline · Connected events · Known · Uncertain · What matters most · **One** next understanding step  

Then generate language.

---

## Emotional accuracy

| Never | Instead |
|-------|---------|
| “Everything seems fine.” | Meaningful change may be held; cause unclear |
| “This is definitely dementia progression.” | Change from previous patterns; cause still unclear |

---

## MVP scope

Apply along: Care Recipient → Baseline → Observation → Change → Situation → Unknown  

Do **not** optimize for engagement, reminders, notifications, or dashboards.

Optimize for one thing:

> After 30 seconds, does the caregiver understand the situation more clearly?

---

## Final principle

| Normal AI | SolenOS |
|-----------|---------|
| “Did I answer the user’s message?” | “Did I improve the caregiver’s understanding of the person’s changing reality?” |

That is the difference between an assistant and a care intelligence system.

Examples in this doc are illustrations only — never product if-branches.
