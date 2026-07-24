# SolenOS Situation Relationship Directive

**Status:** Permanent Product Steward / architecture constraint  
**Authority:** Same force as Input Reality + Response Behavior  
**Why it matters:** If same vs new is wrong, the Living Care Record becomes a pile of notes again.

**Companions:** [`solenos-input-reality-directive.md`](./solenos-input-reality-directive.md) · [`solenos-relationship-extraction.md`](./solenos-relationship-extraction.md) · ACS · Care Reality State · Living Care Record UX (ADR-019)

---

## Key principle

> SolenOS should **not** decide "same situation vs new situation" based only on keywords.  
> It should evaluate whether the new information **changes the understanding of an existing care reality**.

The system's job is **not grouping notes**.  
It is **understanding relationships between changes in a person's life**.

---

## Pipeline

```
New Input
  → Capture Layer
  → Context Analysis
  → Situation Relationship Engine
  → Same / Update / New Related / New Unrelated / Unclear
  → Living Care Record
```

---

## Decision process (ordered)

### 1. Time relationship

Is this likely connected in time?

| Existing | New | Likely |
|----------|-----|--------|
| Mom fell yesterday | She is still having trouble walking today | Same situation |
| Mom fell last month | Mom fell again today | **New** situation (same category, different event) |

### 2. Person relationship

Same care recipient?

| Existing | New | Likely |
|----------|-----|--------|
| Mom refusing food | Dad missed his appointment | Different situation |

### 3. Topic relationship (not keywords)

Understand the underlying issue.

| Existing | New | Likely |
|----------|-----|--------|
| Mom fell yesterday | She seems afraid to walk now | Same (fall → fear → mobility) |

### 4. Does it answer an existing uncertainty?

| Existing | Unknown | New | Action |
|----------|---------|-----|--------|
| Mom refused to eat | Is she drinking? | She drank two glasses but still refused dinner | **Update same situation** |

### 5. Does it strengthen an existing pattern?

Related observations become pattern understanding — not isolated notes.

### 6. Does it represent a new decision?

Some inputs create a **new event** that stays **linked**, not merged into the same event.

Example: Fall situation + “Doctor changed medication after the fall” → **New Decision Event** linked to Fall Situation.

---

## Output is not binary

Avoid `same = true / new = false`.

Internal classification (engine — **not** caregiver UI labels):

| Relationship | Meaning |
|--------------|---------|
| `UPDATE_EXISTING_SITUATION` | Continues / deepens current Active Care Situation |
| `NEW_RELATED_EVENT` | New event node, linked to existing situation |
| `NEW_UNRELATED_SITUATION` | Distinct care reality thread |
| `ADDITIONAL_CONTEXT` | Context that attaches without changing the spine event |
| `UNCERTAIN_NEEDS_REVIEW` | Meaningful ambiguity — rare caregiver ask allowed |

MVP engine code uses `ADD_RELATED_EVENT` for the directive’s `NEW_RELATED_EVENT` (linked, not merged). Caregiver UI never shows these enums.

Example (internal):

```json
{
  "relationship": "UPDATE_EXISTING_SITUATION",
  "related_situation_id": "fall_july_2026",
  "reason": "New mobility difficulty appears connected to recent fall",
  "confidence": "high"
}
```

`confidence` here is **engine-only** (`high` / `medium` / `low`). Never show confidence percentages or internal relationship enums to caregivers.

---

## Caregiver rule

**Do not** ask “Is this a new situation?” every time.

The caregiver should never manage the architecture.

SolenOS quietly decides. Ask only when uncertainty is **meaningful** (`UNCERTAIN_NEEDS_REVIEW`).

Caregiver provides life events. SolenOS maintains continuity.

---

## Situation Graph (missing object)

Not only a single Active Care Situation.

A person's reality is a **graph of related changes**:

```
Fall Situation
  ├── Urgent Care Visit
  ├── Mobility Change
  └── Medication Decision

Eating Change Situation
  ├── Appetite Change
  └── Mood Change
```

Active Care Situation is the **current focus** in that graph — not the whole record.

---

## Product test

Feel: *SolenOS connected this to what we already know — or clearly started a new thread when life did.*

Never: *I have to tell the system how to file my notes.*
