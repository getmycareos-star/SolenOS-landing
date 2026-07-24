# Outcome Extraction Rule (SolenOS)

**Status:** Locked product SoT  
**Authority:** Learning layer of Care Reality Intelligence  
**Companions:** Observation · Event · Decision · Relationship · Unknown extraction · [`solenos-decision-continuity.md`](./solenos-decision-continuity.md) · Improvement updates  
**Module:** `src/lib/care-reality-extraction` · Decision Memory outcome links  
**Verify:** `verify:care-reality-extraction`

---

## Core instruction

> Do **not** ask “was this successful?” when extracting outcomes.  
> Ask **“what changed after this event or decision, and what evidence shows that?”**

Outcomes turn history into learning. Without them, SolenOS is a history log.

---

## What an outcome is

The Outcome layer contains what happened **after** an event, action, or decision.

An outcome answers: *What happened after something changed or someone took action?*

| Layer | Role |
|-------|------|
| Observation | What was noticed |
| Event | What occurred |
| Decision | What was chosen |
| Outcome | The **result** after that choice or occurrence |

Outcomes are **not** decisions, observations, or interpretations.

---

## Required fields

| Field | Meaning |
|-------|---------|
| Outcome | Neutral description of what happened after an event or decision |
| Related decision/event | The decision or event this outcome follows |
| Time | When the outcome occurred — if unknown, preserve uncertainty |
| Evidence | Observations or information showing that this outcome occurred |
| Status | `observed` · `pending` · `uncertain` · `ongoing` · `resolved` · `changed` |

Status values are **engine-internal**. Caregiver UI uses plain language only.

---

## Rules

1. **Only** create outcomes when there is evidence that something happened after an event or decision.  
2. Separate outcomes from **assumptions** and **interpretations**.  
3. Preserve **mixed** outcomes — a decision can have positive and negative results; never force success/failure.  
4. Preserve **uncertainty** — perceived/reported improvement stays attributed, not converted into clinical certainty.  
5. Do **not** create outcomes from **intentions** (plans to monitor, wants to check — nothing happened yet).  
6. Link outcomes back to the original decision or event — value is the **Decision → Outcome** (or Event → Outcome) relationship.

### Illustration only (never product if-branches)

| Input | Layer |
|-------|--------|
| “Medication was changed.” | Decision |
| “Her dizziness reduced afterward.” | Outcome |
| “Medication worked.” | Interpretation — do **not** create without evidence |
| “She seems better.” | Outcome (uncertain): caregiver reported perceived improvement — **not** “Condition improved.” |
| “Doctor wants to monitor mobility.” | Intention — **no** outcome yet |

---

## Purpose

Outcomes let SolenOS understand:

- what happened after decisions  
- what approaches helped  
- what changed after interventions  
- whether previous choices still make sense  
- patterns across time  

---

## Caregiver surface

Composer may say plain language about what changed afterward.  
Never show: outcome status enums · success/failure scores · “extracted outcome” · engine ids.
