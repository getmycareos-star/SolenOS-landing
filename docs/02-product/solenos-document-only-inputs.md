# SolenOS Product Directive — Document-Only Inputs

**Status:** Permanent product behavior  
**Authority:** Product Steward  
**Decision:** **A** — Same Care Reality loop as any other input  
**Companions:** Input Reality · Evidence visibility · Response Behavior · ADR-018

---

## Principle

> A document is just another input into the Care Reality. It should **not** create a different interaction model.

Users may type, upload PDFs, discharge summaries, screenshots, scans, photos — SolenOS behaves **consistently** regardless of input type.

---

## Why A (not B, not C)

| Choice | Problem |
|--------|---------|
| **B** Document-first / source priority chrome | Feels like a document analyzer — wrong identity |
| **C** Always ask “what should I know?” first | Friction; many docs already have enough |
| **A** Same Acknowledge → Understand → Decision loop | Continuity of care reality, not file review |

---

## Decision A (locked)

Documents enter the **same** Care Reality pipeline as text, voice (later), photos, screenshots, and messages.

**Never** create a separate “document workflow.”

When a caregiver uploads a document without additional text:

1. Preserve the document  
2. Extract what can be understood  
3. Add that understanding to the Living Care Record  
4. Determine what changed in the Care Reality  
5. Identify only the most important missing context  
6. Ask no more than **1–3** relevant clarification questions when needed  

Response driven by **evidence maturity**.

- Strong evidence → explain what was understood; separate confirmed vs unknown  
- Thin evidence → acknowledge what was found; request minimum additional context  

---

## Permanent focus rule

> The first response should always be about the **person's care reality** — not about the document itself.

**Bad:** “I extracted six medications and three diagnoses.”  

**Good:** “I've added the hospital visit to the Living Care Record. The discharge summary shows two medication changes and recommends a follow-up appointment. One detail is still unclear…”

---

## Never expose

OCR details · extraction confidence · parser results · schema labels · internal reasoning · “document analyzer” framing

---

## Feel

> "This document helped SolenOS better understand the care journey."

Not:

> "SolenOS analyzed my PDF."
