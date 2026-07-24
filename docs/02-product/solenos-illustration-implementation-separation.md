# Illustration vs Implementation Separation (SolenOS)

**Status:** Locked architecture directive  
**Authority:** All SolenOS product docs · Intelligence Layer · Identity naming · Golden scenarios  
**Companions:** [`solenos-intelligence-no-hardcode.md`](./solenos-intelligence-no-hardcode.md) · [`solenos-golden-caregiver-scenarios.md`](./solenos-golden-caregiver-scenarios.md) · [`solenos-mvp-identity-naming.md`](./solenos-mvp-identity-naming.md) · [`solenos-care-reality-engine-foundation.md`](./solenos-care-reality-engine-foundation.md)  
**Module:** `src/lib/care-reality-intelligence/illustration-implementation-separation.ts`  
**Verify:** `verify:illustration-implementation-separation`

---

## Critical instruction

Examples, scenarios, caregiver stories, and phrases in SolenOS architecture documents are **NOT product content**.

They are **illustrations only**.

Their purpose is to help implementers understand:

- the intended **reasoning process**
- the expected **system behavior**
- the **type of intelligence** SolenOS should create

They must **never** be directly converted into:

- code if-branches on example nouns  
- database records or schema fields  
- UI copy / default content  
- fixed categories or hardcoded workflows  
- demo timelines or prefilled care realities (unless explicitly requested demo mode)

---

## Gate question (before any commit from architecture docs)

> Am I implementing the **intelligence behind** this example, or am I accidentally implementing the **example itself**?

| If… | Then… |
|-----|--------|
| Second | **Do not build it.** Replace with generalized system behavior. |
| First | Proceed — structure, not the sentence. |

---

## Prompt interpretation

When docs say **Example:** / **Imagine:** / **Scenario:** / **Illustration only:**

| Mean | Do not mean |
|------|-------------|
| Understand the intended behavior | Add this exact thing to the product |

---

## Correct interpretation

**Illustration:** *“Mom tried leaving the house.”*

**Implement structure:**

```
Care Recipient → Observation → Baseline comparison → Possible safety-related change
→ Unknown (cause) → Relationship to prior events
```

**Never implement:**

```
{ name: "Mom", condition: "confused", event: "tried leaving house" }
```

Never: hardcoded “Mom” product branches · fixed dementia scenarios · example-specific buttons/fields/workflows.

The system must work for **any** care recipient, family relationship, long-term condition, and caregiver situation.

---

## Architecture rule

**Never build around examples. Build around underlying objects.**

| Wrong | Correct |
|-------|---------|
| Mom → Confusion → Medication | Care Recipient → Observation → Change → Related Event → Decision → Outcome → Unknown |

---

## Data model rule

Store **universal structures**, not example-shaped fields.

| Wrong | Correct |
|-------|---------|
| `mom_confusion_event: true` | `type: observation`, subject, category, description, timestamp, confidence, related_events |

---

## UI rule

Production must **begin empty** and learn from the caregiver’s own reality.

Do **not** display:

- sample caregiver stories as defaults  
- fake timelines  
- demo situations  
- prefilled patient information  

…unless an **explicit demo mode** is requested.

Identity placeholders such as “Mom, Dad, or a given name” (Locked A — ask how they call the person) are **naming invites**, not demo care stories.

---

## Search rule (before adding features)

Search the codebase for illustration leakage (names, phrases, sample stories, temporary labels).  
If a hit is an **example** accidentally treated as product logic → **remove it**.  
If it is a **required system concept** (e.g. caregiver-chosen display name “Mom”) → keep.

Companion constraint: [`solenos-intelligence-no-hardcode.md`](./solenos-intelligence-no-hardcode.md) (no keyword/symptom banks).

---

## Core principle

Examples are **teaching tools**.

They explain *what SolenOS should understand* — not *what SolenOS should store*.

Learn the **pattern** behind the example. Never memorize the example itself.
