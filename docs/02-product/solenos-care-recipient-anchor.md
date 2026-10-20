# Care Recipient Anchor (SolenOS Architecture Correction #1)

**Status:** Locked architecture correction  
**Authority:** MVP Identity Model (Locked A) · Care Reality Engine · Situation Model  
**Companions:** [`solenos-mvp-identity-model.md`](./solenos-mvp-identity-model.md) · [`solenos-mvp-identity-naming.md`](./solenos-mvp-identity-naming.md) · [`solenos-mvp-collaboration-model.md`](./solenos-mvp-collaboration-model.md) · [`solenos-care-reality-situation-model.md`](./solenos-care-reality-situation-model.md)  
**Module:** `src/lib/care-reality-intelligence/care-recipient-anchor.ts`  
**Verify:** `verify:care-recipient-anchor`

---

## Problem

Treating all information in a caregiver message as equally important is wrong.

| Wrong pipeline | Required pipeline |
|----------------|-------------------|
| Text → Important sentences → Summary | Caregiver input → **Identify care recipient** → Current reality → Changes → Situation → Orientation |

The first missing foundation is the **Care Recipient Anchor**.

---

## Core rule

Every caregiver interaction must first answer:

> **Who is this care story about?**

The primary subject of SolenOS is **not** the caregiver.  
The primary subject is the **person receiving care**.

### Illustration only (never product if-branches)

Input: *“My brother thinks I'm worrying too much… Mom has been confused and keeps trying to leave the house.”*

| Incorrect | Correct |
|-----------|---------|
| Main topic: sibling disagreement | **Primary care recipient: Mom** · Care situation: change in cognitive/safety state · Family disagreement: **secondary context** |

---

## Internal processing order (non-negotiable)

```
1. Care Recipient
2. Current State Changes
3. Care Events
4. Care Decisions
5. Outcomes
6. Unknowns
7. Caregiver Context
```

Never allow caregiver emotions, opinions, or family disagreements to replace the care recipient as the center of the record.

---

## Care Reality structure

```
Care Reality
├── Care Recipient
│   ├── Name / relationship
│   ├── Baseline
│   ├── Current changes
│   ├── Events
│   ├── Decisions
│   └── Outcomes
└── Contributors
    ├── Family caregiver
    ├── Sibling
    ├── Clinician
    └── Other sources
```

The caregiver is a **contributor**. They are not the subject of the care reality.

---

## Care Recipient Anchor (before any response)

Internally create:

| Field | Question |
|-------|----------|
| Who is receiving care? | Care recipient |
| What changed? | Recipient-centered changes |
| What events relate? | Journey moments about them |
| Who provided this information? | Contributor attribution |
| What remains uncertain? | Unknowns |

If the system **cannot** identify the care recipient: **do not guess.** Ask naturally: *“Who is this situation about?”*  
Still orient on held recipient-centered changes with neutral language — never invent a name, and never let the identity gap erase care reality understanding.

Display identity still follows Locked A (ask-once; never silently write Mom/Dad into durable identity from notes). The Anchor uses held display name / ACS subject when known.

---

## Response behavior

Orient around the care recipient. Preserve family context **without taking sides**.

| Good feel | Bad feel |
|-----------|----------|
| Changes in Mom's usual pattern; different daily contact may explain different views | “Your brother may not understand” |

---

## Acceptance test (illustration fixture)

Input about Mom after hospital + brother disagreement.

| Fail | Succeed |
|------|---------|
| Focuses on brother · summarizes · task list · medical advice · conflict as main issue | Current understanding about **Mom** · what changed · hospital context · different family perspectives as **related context** · still unclear timing/cause |

---

## Product principle

**The care recipient is the center of gravity.** Everything else is context around that person.

SolenOS does not organize conversations.  
SolenOS understands a person's changing care reality.
