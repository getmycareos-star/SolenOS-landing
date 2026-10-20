# SolenOS Product Directive — First-Time Caregiver Experience

**Status:** Permanent product behavior  
**Authority:** Product Steward  
**Decision:** **B** — Light orientation (1–2 calm sentences), then immediate capture  
**Companions:** [`solenos-welcome-begin-continuity.md`](./solenos-welcome-begin-continuity.md) · Input Reality · Adoption / chaos-first

---

## Why B (not A, not C)

| Choice | Problem |
|--------|---------|
| **A** Empty calm capture | Feels like an empty text box — no mental model |
| **C** Guided first note / examples | Teaches the app before value; feels like a form |
| **B** Light orientation → capture | Purpose clear, then out of the way |

---

## Decision B (locked)

When a first-time caregiver presses "Begin," there is **no** existing Care Reality to restore.

- Do **not** fabricate continuity  
- Do **not** overwhelm with onboarding  

Provide a **brief orientation** in one or two calm sentences that explains purpose, then **immediately invite capture**.

Example feel (not a fixed template):

> Welcome.  
> SolenOS helps you preserve and understand your loved one's care journey over time.  
> Share anything that's happening—notes, messages, documents, photos, or voice recordings. We'll help organize what matters.  
>  
> What's happening today?  
> — or — Share what's on your mind.

---

## What they may share (immediately)

Free text · observations · questions · worries · documents · scanned paperwork · photos · screenshots · voice notes (when channel exists) · messages · emails

**Never** require understanding categories before contributing.  
**Never** force structured forms before value has been demonstrated.

---

## One idea

> "Give us the chaos. We'll help organize what matters."

Feel: *"I can finally get this out of my head."* / *"I can put this somewhere and trust it will make sense later."*  
Never: *"I need to learn another app."* / *"I have another system to maintain."*

Retention is not proven by pain alone — see [solenos-mvp-research-validation.md](./solenos-mvp-research-validation.md).

---

## After first successful capture

**Do not explain SolenOS again.**

From that point, **behavior teaches the product**. If the system consistently remembers, connects, and clarifies, caregivers understand SolenOS without repeated explanations.

**Implementation:** `AddSituationPanel` shows light orientation only when `mode === "initial"` and there is no context root; update mode is a short capture invite only. Identity naming (`CareRecipientNameGate`) waits until after first value — never a pre-capture onboarding form.

---

## MVP channels

Orientation may mention documents/photos now; voice when ADR-018 allows. Do not block first capture waiting for every channel.
