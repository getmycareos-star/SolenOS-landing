# SolenOS Care Reality Engine Foundation (MVP)

**Status:** Permanent Product Steward / MVP foundation  
**Authority:** Integrated system — not a collection of independent features  
**Companions:** Product North Star · Care Reality Intelligence · Response Contract · Input Entry Contract · ADR-022 · [`solenos-care-reality-engine-principles.md`](./solenos-care-reality-engine-principles.md)  
**Implementation:** `src/lib/care-reality-engine` · wired through `situation-entry` · `verify:care-reality-engine` · principles: `verify:care-reality-engine-principles`

---

## What SolenOS is

> An evolving intelligence layer that maintains an understanding of one person's changing care reality.

Not: notes app · document summarizer · chatbot · reminder app · medical advice system.

Caregivers must understand: what is happening · what changed · what matters now · what remains uncertain · what to remember for continuity.

---

## Implementation phases (order)

| Phase | Layer | Status |
|-------|--------|--------|
| 1 | Care Recipient Identity + Contributor attribution | Foundation |
| 2 | Baseline Memory Profile | Foundation |
| 3 | Event · Observation · Decision · Action · Outcome · Unknown | Foundation |
| 4 | Situation (evolving thread) | Foundation |
| 5 | Evidence Understanding Pipeline | Foundation |
| 6 | Change Detection | Foundation |
| 7 | Behavioral Observation (no diagnosis) | Foundation |
| 8 | Evidence Priority + Conflict | Foundation |
| 9 | Caregiver Capacity Adaptation | Foundation |
| 10 | Care Transition Detection | Foundation |
| 11 | Safety Boundary | Foundation |
| 12 | Memory Correction (no silent overwrite) | Foundation |
| 13 | Response / Orientation Validation | Foundation |

Do not skip layers. Do not build marketplace, family chat, reminders, AI companion, disease library, or prediction engines.

---

## Critical rule — examples are illustrations only

Scenarios, names, conditions, medications, falls, hospitals in this or any design doc are **illustrations only**.

They must **never** become hardcoded templates or canned responses.

Every response derives from the caregiver's actual evidence.

**Behavior Reference Only — Never Hard Code:** Examples 1–42 (new concern, improvement, documents, decisions, multi-contributor, conflict, emotion-only, return continuity, long threads, relationships, unknowns, baseline change, corrections, memory decay, priority, narrative, etc.) demonstrate **reasoning patterns**. Do **not** create special logic for eating, falls, medications, confusion, dementia symptoms, or hospital visits. The engine must generalize:

```
Input → Extract reality → Attach to person → Identify situation → Connect relationships
→ Detect change → Preserve uncertainty → Update understanding
```

Verify: `npm run verify:care-reality-behavior` (target ≥95% pattern pass). Module: `src/lib/care-reality-engine/behavior-examples.ts`.

---

## MVP minimum reality objects (not 45 tables)

Person · Situation · Observation/Event · Contributor · Relationship · Decision · **Action** · Outcome · Evidence · Unknown · Memory

Action ≠ Outcome. Supporting layers (Episode, Phase, Preference, Commitment, Risk Signal, Narrative, …) **emerge from relationships** among these objects.

Pipeline: **Input → Understanding → Relationships → Changing Care Reality** — never Input → AI Summary → Tasks.

---

## Real MVP test (not PDF summary)

Fail if the product only summarizes a PDF.

Pass when messy input containing a **document**, a **text note**, and an **observation** produces a coherent Care Reality with:

- changes  
- uncertainty  
- next understanding  

That is the moat.

---

## Pipeline (all sources)

```
Scan | Snap | Upload | Share | Voice* | Text
        → Evidence Understanding
        → Care Reality Update
        → Situation Relationship Engine
        → Response Contract
```

\* Voice = FUTURE (ADR-018) — same pipeline later.

Documents are evidence. Events create context. Decisions create history. Outcomes create learning. Relationships create intelligence.
