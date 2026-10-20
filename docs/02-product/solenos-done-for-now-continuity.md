# SolenOS Product Directive — "Done for now" Must Preserve Continuity

**Status:** Permanent product behavior  
**Authority:** Product Steward — same force as Input Reality + Situation Relationship  
**Applies to:** All input types (text, questions, documents, photos, discharge, med lists, messages, PDFs, voice-later) — examples are illustrative only

**Companions:** [`solenos-mvp-situation-relationship-architecture.md`](./solenos-mvp-situation-relationship-architecture.md) · Care Reality State · ACS · Living Care Record UX

---

## Core principle

**"Done for now" is NOT a care decision.**  
It is ONLY a user interface action.

When a caregiver taps "Done for now", they are almost never saying:

> "The situation is over."

They are usually saying:

> "I need to stop using the app for now."

These are fundamentally different.

**Never** interpret ending the interaction as ending the care situation.

---

## Default behavior (MVP)

**Default to A — Pause the interaction session.**

| Do not | Why |
|--------|-----|
| **B** — Resolve ACS on Done for now | Button-driven resolution is wrong |
| **C** — Force caregiver to choose pause vs close | Caregiver must not manage situation lifecycle |

That responsibility belongs to SolenOS (Situation Relationship Engine).

---

## What persists (without exception)

When "Done for now" is selected, persist:

- CareContext  
- Active Care Situation  
- Care Reality State  
- Living Care Record  
- Timeline  
- Evidence  
- Open uncertainties  
- Relationship links  
- Decision memory  
- Pattern history  

**The ONLY thing that changes:**

Current interaction session → **Paused**

Nothing else is reset.  
Nothing is forgotten.

---

## Returning later

When the caregiver returns hours, days, or weeks later, SolenOS should continue naturally.

Example feel (not a fixed template):

> "Last time you were documenting a recent fall. No new updates have been added since then. Would you like to continue?"

The caregiver should immediately feel:

> "SolenOS remembers where we left off."

**Never** restart as if they are beginning again.

---

## How situations become resolved

Active Care Situations must **NEVER** become resolved simply because the caregiver pressed "Done for now."

Resolution is determined **only** by the Situation Relationship Engine — **evidence-driven**, not button-driven.

Example pattern (illustrative only):

- Situation: recent fall  
- Later evidence: urgent care done · walking improved · no further concerns · quiet period  
- Engine may move situation toward Resolved / Historical  
- Later unrelated note (e.g. eating concern) → new Active situation; prior fall remains Historical  

Caregiver does not perform these transitions manually.

---

## Situation lifecycle (not binary open/closed)

| State | Meaning |
|-------|---------|
| **Active** | New information is still arriving |
| **Quiet** | No recent updates; may still be relevant |
| **Resolved** | Evidence indicates natural conclusion |
| **Historical** | Retained for continuity, decision memory, future understanding |

Transitions may include Active → Quiet → Resolved → Historical, and **Quiet → Active** if related information arrives.

---

## Relationship Engine responsibility

Before changing a situation's state, evaluate:

- Is new evidence still arriving?  
- Have previous uncertainties been answered?  
- Has the original concern naturally concluded?  
- Does this update belong to an existing situation?  
- Does it create a related situation?  
- Does it create a completely new situation?  

Lifecycle changes emerge from **accumulated evidence**, not UI actions.

---

## Caregiver experience

The caregiver should never feel responsible for organizing, closing, or managing care situations.

Their job: share what is happening.  
SolenOS: preserve continuity.

---

## Engineering principle

Not: *"We remember your notes."*  
Yes: *"We remember the person's evolving care reality."*

If pressing "Done for now" causes SolenOS to behave as though the caregiver is starting over, the implementation is **incorrect** and must be redesigned.

**UI contract:** Done for now clears the current composer / LCR turn view only. It must **not** empty Open situations, wipe local TrackedSituation persistence, or force first-time capture UX. Pause API returns surviving `situations` / `ui_situations` + `return_continuity.suppress_first_time_ux` so the shell can stay continuous.

Aligns with: Care Reality State → Active Care Situation → Progressive Understanding → Living Care Record.
