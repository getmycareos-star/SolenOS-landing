# Observation Extraction Rule (SolenOS)

**Status:** Locked product SoT  
**Authority:** Evidence layer of the Living Care Record  
**Companions:** Observation · Event · Decision · Relationship extraction · Care Reality Engine foundation · Response Contract · [`solenos-unknown-extraction.md`](./solenos-unknown-extraction.md)  
**Module:** `src/lib/care-reality-extraction`  
**Verify:** `verify:care-reality-extraction`

---

## Core question

> Do **not** ask “what is important?” when extracting observations.  
> Ask **“what was directly witnessed or reported about the person receiving care?”**

That prevents jumping into reasoning before the evidence layer exists.

---

## What an observation is

The Observation layer contains only directly reported changes, behaviors, symptoms, or states of the **person receiving care**.

An observation answers: *What did someone directly notice happening?*

The system must **not** store as observations: interpretations, opinions, emotions-as-product, decisions, events, or questions.

---

## Required fields

| Field | Meaning |
|-------|---------|
| Description | Neutral description of what was directly noticed |
| Approximate time | When it occurred; if unknown, preserve uncertainty |
| Source | Who reported or observed it |
| Confidence | How certain this was directly observed (`low` / `medium` / `high`) |

---

## Rules

1. Separate raw caregiver input into care-reality categories **before** creating observations.  
2. Promote only direct observation of the care recipient’s condition, behavior, ability, or state.  
3. Preserve uncertainty — do not convert uncertain statements into facts.  
4. Avoid clinical interpretations or causes.  
5. Avoid caregiver opinions or family disagreements as observations.  
6. Avoid healthcare interactions, appointments, or decisions as observations (those are Event / Decision).  
7. Avoid general caregiver stress statements as observations.

---

## Purpose

Observations are the raw evidence layer. They later support: what changed · patterns · relationships to events/decisions · unresolved questions · follow-ups.

Represent reality **as witnessed**, not the system’s explanation of reality.

---

## Never hardcode illustrations

Any names, symptoms, or scenarios in companion docs are illustrations only — never product if-branches.
