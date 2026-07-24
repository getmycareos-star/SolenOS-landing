# SolenOS MVP Collaboration Model Decision

**Status:** Permanent MVP architecture constraint  
**Authority:** Product Steward  
**Decision:** **B** — Shared Care Reality with attribution (“who said what”) from day one  
**Companions:** [`solenos-mvp-identity-model.md`](./solenos-mvp-identity-model.md) · Source priority / conflict rules · Input Reality

---

## Principle

The Living Care Record belongs to the **care recipient**, not an individual caregiver.

Multiple caregivers may contribute to the **same** Care Reality.

MVP must support **attribution from day one** — without building a family collaboration product.

---

## Why B (not A, not C)

| Choice | Problem |
|--------|---------|
| **A** Single primary only | Continuity loss across people; painful migration later |
| **C** Separate realities per caregiver | Fragmentation — opposite of the thesis |
| **B** Shared Care Reality + attribution | One story; multiple trusted contributors |

Real failure SolenOS solves: one sibling knows everything; everyone else has fragments.

---

## Attribution (MVP)

Every important input should preserve:

- `care_recipient_id`  
- `contributor_id`  
- contributor relationship  
- timestamp  
- source type  
- confidence/context (engine; never caregiver % dump)  

Illustrative:

| What | Attribution |
|------|-------------|
| “Mom refused lunch.” | Daughter |
| “Mom seemed more confused today.” | Son |
| Medication changed after appointment | Caregiver + clinician participants |

---

## MVP does **not** require

- family chat  
- social feed  
- complex collaboration tools  
- household management  

**Goal is not** communication between caregivers.  
**Goal is** preserving a **shared understanding** of one person's care reality.

Conflicting information → preserve both + surface uncertainty (see Input Reality source-priority rules). **Never** split into parallel records.

---

## Naming (architecture vocabulary)

Do **not** call contributors “users” in the product model (pushes SaaS workspace thinking).

| Term | Role |
|------|------|
| **Care Recipient** | The story |
| **Contributor** | Source of knowledge |
| **Care Reality** | Shared understanding |

---

## Locked shape

**One person. One Living Care Record. Multiple trusted contributors.**

---

## Implementation status (MVP spine)

**IMPLEMENTED (in-memory + `.data/` durable):**

- Care Reality store key = `care_recipient_id` (ACS, CRS, CareContext)
- Contributors link via `ensureContributorCareReality` / `linkCaregiverToRecipient` (durable map)
- Attribution: `contributor_id` on ACS observations + CareEvent `source_attribution`
- API accepts optional `contributor_id` + `care_recipient_id` (join shared reality)
- Conflicts: preserve both perspectives; soft notes from another contributor do not fork ACS

**NOT MVP:** family chat, social feed, household management, graph UI of contributor edges.