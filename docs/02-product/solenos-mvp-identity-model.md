# SolenOS MVP Identity Model Decision

**Status:** Permanent MVP architecture constraint  
**Authority:** Product Steward  
**Decision:** **A** — One care recipient per Care Reality; caregiver is context, not the record subject  
**Companions:** Care Graph · Input Reality · Welcome/Begin identity continuity · [`solenos-care-recipient-anchor.md`](./solenos-care-recipient-anchor.md) · [`solenos-baseline-comparison-engine.md`](./solenos-baseline-comparison-engine.md)

---

## Central question

The Living Care Record must answer:

> "What is happening with **this person's** care reality over time?"

The person at the center is the **care recipient**.

---

## Why A (not B, not C for MVP)

| Choice | MVP risk |
|--------|----------|
| **B** Care recipient + caregiver as first-class linked profiles | Pulls toward family collaboration / social graph too early |
| **C** Household / multiple recipients | Complexity before proving continuity |
| **A** One person → one evolving care reality | Depth of continuity; clean foundation |

**B is strategically correct long term** — not the core MVP object.  
**C is real** — after one journey is proven.

---

## Decision A (locked)

**Primary subject:** Care Recipient (Mom / Dad / loved one receiving care)

**Caregiver is:** contributor · observer · decision participant · source of information · relationship context — **not** the record subject.

Every CareEvent must connect to:

- `care_recipient_id`  
- Care Reality State  
- Active Care Situation  
- Living Care Record  

Illustrative:

| Field | Value |
|-------|--------|
| Person | Mom |
| Contributor | Caregiver |
| Observation | Reduced eating today |

---

## Do not model MVP as

- household record  
- family workspace  
- caregiver social network  

Those may come later. MVP goal: **depth of continuity for one person's care journey**.

**One person. One evolving care reality. One Living Care Record.**

---

## Caregiver identity from day one (not the center)

Store caregiver identity from day one for **trust / attribution** later:

- Who observed this?  
- Who made this decision?  
- Who confirmed this information?  

The **relationship exists**. The **story belongs to the person receiving care**.
