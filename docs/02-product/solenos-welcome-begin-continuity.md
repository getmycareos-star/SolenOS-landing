# SolenOS Product Directive — "/welcome → Begin"

**Status:** Permanent architectural rule  
**Implementation:** `/?enter=1` reuses `ensureClientDurableCareKey` — never remints care reality · Begin may mint a new `sess_*` interaction session via `ensureClientInteractionSessionId({ forceNew })` · `verify:return-continuity` (G11) · `verify:care-identity`  
**Authority:** Product Steward  
**Decision:** **A** — Begin starts a new **interaction session**; it must **never** wipe durable care reality for the same identity  
**Companions:** [`solenos-done-for-now-continuity.md`](./solenos-done-for-now-continuity.md) · Input Reality · Situation Relationship

---

## Begin ≠ Done for now

| Action | Meaning |
|--------|---------|
| **Done for now** | Pause the current interaction |
| **Begin** | Start interacting again (new interaction session) |

Both must **preserve** the person's durable care reality.

---

## Decision A (locked)

"/welcome → Begin" may create a new **interaction session** for:

- session management  
- analytics  
- privacy boundaries  
- interaction history  

It must **NOT**:

- create a new care reality  
- discard existing understanding  
- reset Care Reality State / ACS / LCR / evidence / relationships / decision memory / open uncertainties  

---

## Same identity → restore

If the same authenticated caregiver returns under the same identity, SolenOS must automatically restore:

- Care Reality State  
- CareContext  
- Active Care Situation (if one exists)  
- Living Care Record  
- Timeline  
- Evidence  
- Relationship history  
- Decision memory  
- Open uncertainties  

Feel: *SolenOS remembers exactly where their care journey left off.*

---

## Architecture

```
Caregiver Identity
        ↓
Care Recipient
        ↓
Durable Care Reality
        ↓
New Interaction Session
```

- **Interaction session** = temporary  
- **Care Reality** = durable  

**Never** tie the lifetime of Care Reality to the lifetime of the interaction session.

---

## Core principle

**Begin** means: *"Start interacting again."*  

It does **NOT** mean: *"Start the person's care journey over."*

If a returning caregiver reaches welcome and presses Begin, SolenOS **continues the person's story**, not restarts it.

Guides: onboarding · session management · routing · persistence · continuity.

---

## MVP honesty

Until durable identity auth is production-ready, demos may use local care keys. That is **session hygiene for demos**, not product truth. Product truth remains: identity → durable care reality → temporary interaction sessions. Do not encode “Begin wipes everything” as the intended caregiver product.
