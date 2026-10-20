# SolenOS Product Directive — Open Uncertainties After "Done for now"

**Status:** Permanent product behavior  
**Implementation:** `src/lib/return-continuity` · GET `/api/situation` `return_continuity.soft_invite` · `verify:return-continuity` (G10)  
**Authority:** Product Steward  
**Decision:** **B** — Soft offer once on return; then stop  
**Companions:** [`solenos-done-for-now-continuity.md`](./solenos-done-for-now-continuity.md) · [`solenos-welcome-begin-continuity.md`](./solenos-welcome-begin-continuity.md) · [`solenos-unknown-extraction.md`](./solenos-unknown-extraction.md) · Response Behavior / pushback rules

---

## Why B (not A, not C)

| Choice | Problem |
|--------|---------|
| **A** Never ask again | Important unanswered questions may disappear forever |
| **C** Resume asks immediately | Caregivers feel interrogated the moment they return |
| **B** Soft offer once | Continuity + trust + low cognitive load |

---

## Decision B (locked)

Open uncertainties **must persist** after "Done for now."

When the caregiver returns, SolenOS may **gently acknowledge** unresolved questions **once**.

Example feel (not a fixed template):

> Welcome back.  
> Last time, you were documenting Mom's recent fall.  
> One question is still open: Did she hit her head?  
> You can answer this now or continue updating the record.

Or shorter:

> One question is still open from your previous update…  
> More context would still help if you have it.

This is an **invitation**, not an interruption.

---

## Caregiver may

- answer it  
- ignore it  
- continue adding new information  

**Never** force answering previous questions before continuing.  
**Never** repeatedly ask the same unresolved question on every return.

---

## After the one-time reminder

Treat the uncertainty as a **persistent part of Care Reality State** until it is:

- answered  
- made irrelevant by new evidence  
- or naturally resolved  

If new information answers an earlier uncertainty, **automatically close it** without asking again.

---

## Objective

**Continuity without interrogation.**

Feel: SolenOS remembers unanswered questions, but never pressures them to respond.

Aligns with pushback / never-re-ask-answered-gaps: the soft offer is **not** a quiz loop.

---

## Future refinement (not blocking MVP)

Classify uncertainties by importance:

| Class | Behavior |
|-------|----------|
| **Critical** (e.g. discharge destination, head injury after fall) | May deserve the one-time return reminder |
| **Helpful** (e.g. when did this start?) | Remain visible in the Living Care Record as an open question — calm, not pushed |

Lets SolenOS stay calm while still preserving what it doesn't yet know.
