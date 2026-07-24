# Relationship Extraction Rule (SolenOS)

**Status:** Locked product SoT  
**Authority:** Connection layer of Care Reality Intelligence  
**Companions:** Observation · Event · Decision extraction · [`solenos-response-contract.md`](./solenos-response-contract.md) · Situation Relationship directive · MVP situation-relationship architecture  
**Module:** `src/lib/care-reality-extraction/relationships.ts` · Situation Relationship Engine (engine-only labels)  
**Verify:** `verify:care-reality-extraction`

---

## Full extraction stack

```
Observation → Event → Decision → Relationship → Response Contract
```

| Layer | Ask |
|-------|-----|
| Observation | What was directly witnessed about the person receiving care? |
| Event | What happened, when, who was involved? |
| Decision | Was a choice made, by whom, with what evidence, and do we know why? |
| **Relationship** | **What changed, what connects to it, and what evidence supports that connection?** |
| Response Contract | Caregiver orientation (human language — never enums) |

Without relationships, SolenOS is storage.  
With relationships, SolenOS understands change.

---

## Core question

> Do **not** ask “what information exists?”  
> Ask **“what changed, what connects to it, and what evidence supports that connection?”**

---

## What a relationship is

The Relationship layer connects objects in the care reality model.

It answers: *How are different things connected over time?*

Relationships are **connections**, not summaries.  
They are **not** keyword matches, **not** UI enums, and **not** “X caused Y.”

---

## Relationship types (engine-internal)

The system should identify relationships such as:

| Shape | Illustration only (never product hardcoding) |
|-------|-----------------------------------------------|
| Observation → Event | “More confusion noticed” connected to “Hospital visit occurred” |
| Event → Decision | “Fall occurred” connected to “Medication reviewed” |
| Decision → Outcome | “Medication changed” connected to “Dizziness decreased” |
| Observation → Observation | “Sleeping more” connected to “Less daytime activity” |
| Event → Event | “Hospitalization” connected to “Rehabilitation transition” |

These examples exist only so implementers understand **shape**. They must **never** appear as keyword triggers, phrase templates, or if-branches in SolenOS.

---

## Rules

1. **Never** create relationships based only on keyword matching.  
2. Require **temporal**, **contextual**, or **explicit** connection.  
3. **Preserve uncertainty.**  
   - Possible: “may relate to…” / “connection possible, not proven”  
   - Not: “caused…” without evidence  
4. **Do not expose** internal relationship types to caregivers.  
5. The relationship engine supports understanding — it is **not** the user interface.

---

## Purpose

| Without relationships | With relationships |
|----------------------|--------------------|
| SolenOS is storage | SolenOS understands change |

---

## Caregiver surface (Response Contract)

Composer may say plain language such as how moments connect in the care story.  
Never show: relationship enums · edge graphs · confidence % · `observation_to_event` · “caused”.

On a **new** Care Reality, relationship language may appear in **what changed** — not `connection_note` (that facet is prior-story continuity only).  
On a **returning** Care Reality, relationship-backed language may fill `connection_note` when prior-story connection is empty.
