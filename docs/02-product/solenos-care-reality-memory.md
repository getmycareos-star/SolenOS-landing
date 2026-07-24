# Care Reality Memory Objects (SolenOS Memory Object Architecture)

**Status:** Locked architecture directive  
**Authority:** Care Reality Extraction · Situation Generator · Care Recipient Anchor · Baseline Comparison  
**Companions:** [`solenos-situation-generator.md`](./solenos-situation-generator.md) · [`solenos-care-recipient-anchor.md`](./solenos-care-recipient-anchor.md) · [`solenos-long-thread-ingestion.md`](./solenos-long-thread-ingestion.md) · [`solenos-relationship-extraction.md`](./solenos-relationship-extraction.md)  
**Module:** `src/lib/care-reality-intelligence/care-reality-memory.ts`  
**Verify:** `verify:care-reality-memory`

---

## Problem

Remembering repeated words, sentences, or topics is incorrect.

A caregiver does not need a system that remembers what they typed.  
They need a system that remembers **what happened** in the person's care journey.

| The sentence | The memory |
|--------------|------------|
| Evidence only | The care reality behind the sentence |

---

## Pipelines

| Weak (notes app) | Required (care intelligence) |
|------------------|------------------------------|
| Message → important sentences → repeated topics → summary | Message → extract care reality → **structured memory objects** → relationships → update care story → understanding |

---

## Never store as primary memory

- Full sentences as memories  
- Repeated phrases / conversation frequency  
- Emotional statements without care context  
- Family opinions as care facts  
- Chat history as the primary memory  

## Always store

Events · Observations · Decisions · Changes · Outcomes · Unknowns · Relationships · Confidence (engine-only)

---

## Care Reality Object

```
Type: Event | Observation | Decision | Outcome | Unknown | Change | Relationship | ContributorContext
Subject: who this relates to (care recipient)
Description: what happened (structured — not a chat quote)
Time: when
Source: who reported
Related Objects: connections
Confidence: observation vs cause (engine-only)
Status: current | resolved | unknown | historical
```

Contributor / family disagreement = **ContributorContext** — never Observation about the care recipient.

---

## Reality recurrence vs text recurrence

| Wrong | Correct |
|-------|---------|
| “Has the caregiver mentioned this sentence before?” | “Has this **situation** happened before?” |

Repeated “my brother doesn’t understand” ≠ care trend.  
Repeated observations of questioning / forgetting / leaving home confused = continuing care pattern.

---

## Memory priority

1. Changes in the person receiving care  
2. Care decisions  
3. Outcomes  
4. Unknowns  
5. Caregiver context (secondary unless it affects decisions)

---

## Product feel

Never: *“SolenOS remembers what I wrote.”*  
Always: *“SolenOS understands what has been happening.”*

Success answers:

> What has changed in this person's care journey, what decisions were made, what happened afterward, and what remains uncertain?

---

## Acceptance test (illustration)

Input: increased sleeping since hospital + sister thinks overreacting.

| Fail | Succeed |
|------|---------|
| Family disagreement as primary memory · sentence frequency · opinion-as-fact | Hospital **event** · sleep **observation** · possible **relationship** · cause **unknown** · family as **context** |

Examples in this doc are illustrations only — never product if-branches on scenario nouns.
