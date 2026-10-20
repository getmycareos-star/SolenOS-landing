# Event Extraction Rule (SolenOS)

**Status:** Locked product SoT  
**Authority:** Timeline layer of the Living Care Record  
**Companions:** Observation · Decision · Outcome · Relationship · Unknown extraction · Care Reality Engine foundation  
**Module:** `src/lib/care-reality-extraction`  
**Verify:** `verify:care-reality-extraction`

---

## Core instruction

> Do **not** ask “what does this mean?” when extracting events.  
> Ask **“what happened in the person’s care journey, when did it happen, and who was involved?”**

**Events are the timeline. Observations are the evidence. They must remain separate.**

---

## What an event is

The Event layer must contain only things that **happened** in the care journey.

An event answers:

> “What occurred that changed, influenced, or belongs to the person’s care story?”

| Layer | Role |
|-------|------|
| Observation | What was **noticed** (state, behavior) |
| Event | What **happened** (action, encounter, transition, occurrence) |

Events are not observations. An observation describes what was noticed. An event describes something that happened.

---

## Required fields

| Field | Meaning |
|-------|---------|
| Event | Neutral description of what happened |
| Time | When the event occurred — if exact date unknown, preserve approximate timeframe |
| Participants | People or organizations involved (caregiver, family member, doctor, hospital, care team, …) |
| Related observations | Links to **existing** observation objects only — do **not** create new observations here |

---

## Rules

1. Identify **real-world occurrences** in the care journey.  
2. Separate events from observations: observations = state/behavior; events = actions, encounters, transitions, or occurrences.  
3. Store **healthcare interactions** as events, not observations.  
4. Store **care transitions** as events when something changes in the care journey.  
5. Store treatment-related **journey occurrences** (encounters, setting changes) as events before analyzing meaning; deliberate treatment **choices** belong in Decision (see Decision Extraction).  
6. Preserve incomplete information — if the reason is unknown, store the event **without inventing an explanation**.  
7. Avoid converting **future intentions** into events — a planned action is not an event until it happens.  
8. Avoid adding **conclusions** — record what happened, not why it happened or whether it was good or bad.

---

## Purpose

Events provide the **timeline structure** of SolenOS. They allow the system to understand:

- what happened before a change  
- what happened after a decision  
- which observations occurred around important moments  
- how the care journey evolved over time  

The Event layer represents the sequence of **real-world occurrences**, not the system’s interpretation.

---

## Never hardcode illustrations

Names, places, or scenarios in companion docs (hospital visit, rehab transition, …) are illustrations only — never product if-branches.
