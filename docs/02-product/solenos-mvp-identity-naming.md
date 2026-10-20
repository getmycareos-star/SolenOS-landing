# SolenOS MVP Identity Naming Rule

**Status:** Permanent MVP product behavior  
**Implementation:** `src/lib/care-recipient-identity` · `CareRecipientNameGate` · `verify:care-recipient-identity`  
**Authority:** Product Steward  
**Decision:** **A** — Ask once how they call the person; use that consistently; allow change later  
**Companions:** [`solenos-mvp-identity-model.md`](./solenos-mvp-identity-model.md) · First-time caregiver experience

---

## Why A (not B, not C)

| Choice | Problem |
|--------|---------|
| **B** Infer from notes | Wrong person / wrong role → instant distrust |
| **C** “Your loved one” forever | Healthcare-portal distance; weak continuity |
| **A** Ask once, use consistently | Personal continuity without guessing |

The person's name is not just a data field — it creates continuity. SolenOS should **not** guess. Incorrect assumptions damage trust.

---

## Decision A (locked)

During first setup — **after first successful capture** (not before; see First-Time Caregiver Locked B) — ask how they refer to the person receiving care.

Example prompt (not fixed template):

> "What should we call the person this care record is for?"

Allow: Mom · Dad · Grandma · given name · custom name

Use that chosen name consistently:

- "Added to Mom's Living Care Record."  
- "Recent changes related to Mom."  
- "What changed with Mom?"  

---

## Do not auto-infer

If the caregiver writes “My mom fell yesterday,” do **not** silently create Person: Mom.

- If care identity exists → use it  
- If none exists → ask for confirmation naturally  

---

## Display vs identity

Chosen name = **display label**, not medical identity.

Internally preserve:

- `care_recipient_id`  
- `display_name`  
- relationship (optional)  
- contributor relationship  

---

## Avoid in caregiver UI

- "the patient"  
- "the subject"  
- "the individual"  
- "your loved one" (unless truly necessary)  

Feel: preserving a **person's story**, not managing a case file.

---

## Change later

Allow the caregiver to change the display name later (e.g. Mom → Mary / Grandma Rose). Preserve identity; do not force a label forever.
