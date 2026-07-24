# Decision Extraction Rule (SolenOS)

**Status:** Locked product SoT  
**Authority:** Reasoning-memory layer of the Living Care Record  
**Companions:** Observation · Event · Relationship · Outcome extraction · [`solenos-decision-continuity.md`](./solenos-decision-continuity.md) · Decision Memory module · [`solenos-outcome-extraction.md`](./solenos-outcome-extraction.md)  
**Module:** `src/lib/care-reality-extraction` · `src/lib/decision-memory`  
**Verify:** `verify:care-reality-extraction` · G13 in `verify:continuity-core-tier1`

---

## Complete extraction stack (MVP core)

```
Observation → Event → Decision → Relationship → Response Contract
```

| Layer | Ask |
|-------|-----|
| **Observation** | What was directly witnessed about the person receiving care? |
| **Event** | What happened, when, who was involved? |
| **Decision** | Was a choice made, by whom, with what evidence, and do we know why? |
| **Relationship** | What changed, what connects to it, and what evidence supports that connection? |

Illustration only (never product if-branches): hospital visit → **Event**; medication change → **Decision** with **Reason unknown** when why is missing; confusion / leave-home / appetite / sleep → **Observations**; family disagreement → not Observation or Decision; links between those objects → **Relationship** (never “X caused Y”).

---

## Core question

> Do **not** ask “what happened?” when extracting decisions.  
> Ask **“was a choice made, who made it, what information supported it, and do we know why?”**

A care journey is not only a timeline of events. It is a history of human decisions made under uncertainty.

---

## What a decision is

The Decision layer must contain only choices or actions made by people involved in the care journey.

A decision answers: *What choice was made, by whom, based on what information, and what happened afterward?*

Decisions are not events, observations, or outcomes.

| Layer | Role |
|-------|------|
| Observation | Something noticed |
| Event | Something that happened |
| Decision | A choice or deliberate care action by a person or care team |
| Outcome | What happened after the decision |

---

## Required fields

| Field | Meaning |
|-------|---------|
| Decision | Neutral description of the choice or action taken |
| Who made it | Person, family member, caregiver, clinician, or organization involved |
| Why | Stated reason or purpose — if unavailable, store as **Reason unknown** |
| Evidence | Information that influenced the decision (observations, events, documents, conversations, clinical info) |
| Alternatives considered | Other options discussed or available — if unknown, preserve uncertainty |
| Outcome | What happened after the decision — if not yet happened, mark **pending** |
| Current status | Present state: active · completed · changed · reversed · uncertain · needs review |

---

## Rules

1. Only create a decision when a human or organization made a choice, selected an option, changed a plan, or took a deliberate care action.  
2. Separate decisions from events: a hospital visit is an **event**; a medication adjustment made during that visit is a **decision**. (Illustrations only — never hardcode those nouns as product logic.)  
3. Separate decisions from observations: a person sleeping more is an **observation**; choosing to review medication because of that change is a **decision**.  
4. Preserve missing reasoning — if a decision happened but why is unknown, store **Reason unknown**.  
5. Never infer motivations — do not assume why a doctor, caregiver, or family member made a choice.  
6. Never create decisions from suggestions — a recommendation is not a decision unless someone accepted or acted on it.  
7. Link decisions to the evidence available at the time — preserve context that existed when the choice was made.  
8. Track decisions over time — a decision can change as new information appears.

---

## Purpose

The Decision layer preserves the reasoning behind the care journey. It allows SolenOS to answer:

- What choices were made?  
- Who made them?  
- Why were they made?  
- What information influenced them?  
- Did the decision work?  
- Does this decision still apply today?

Preserve the memory of **care reasoning**, not just the action that occurred.

---

## Never hardcode illustrations

Examples in this doc (hospital visit, medication adjustment, sleeping more) are for implementer understanding only — never product if-branches or phrase templates.
