# SolenOS First User vs Returning User Intelligence Model

**Status:** Permanent Product Steward / MVP intelligence gate  
**Authority:** Care Reality memory maturity — not chatbot session mode  
**Companions:** [`solenos-baseline-comparison-engine.md`](./solenos-baseline-comparison-engine.md) · [`solenos-initial-care-reality-assessment.md`](./solenos-initial-care-reality-assessment.md) · First-Time Caregiver · Welcome/Begin Continuity · Final Intelligence Refinement · Response Contract  
**Implementation:** `src/lib/care-memory-maturity` · caregiver-response-composer · `verify:care-memory-maturity` · `verify:initial-care-reality-assessment`

---

## Core principle

SolenOS behaves differently depending on whether a **Care Reality** already exists.

| State | Meaning | Purpose |
|-------|---------|---------|
| **New** (no prior care memory) | Beginning of a care story | Capture + organize the first layer of understanding |
| **Returning** (existing care memory) | Continuing a care story | Compare new input to what is already held |

Do **not** treat every message as an isolated conversation.  
Do **not** pretend continuity when none exists.  
Do **not** restart the story when memory exists.

The product is a **Living Care Record** that becomes more intelligent as care history accumulates — not a chatbot that answers each turn in isolation.

---

## State 1 — New user (no previous care memory)

### System has

No care profile · no person timeline · no prior observations · no decisions · no outcomes · no patterns · no historical context.

### Must not

- Fabricate continuity (“stays connected to what was already held”)  
- Reference previous events that do not exist  
- Summarize as if a relationship already exists  
- Diagnose or create false certainty  
- Force onboarding forms, questionnaires, or empty dashboards before value  

### First interaction goal

Transform unstructured input into the **beginning** of a structured care reality.

Feel: *“My situation has been captured and organized.”*  
Never: *“I received an AI-generated summary.”*

### Behavior

1. Recognize care context  
2. Identify care recipient when available (ask-once name — never silent inference)  
3. Extract observations; separate facts from uncertainty  
4. Create first timeline / observation anchor  
5. Preserve caregiver perspective  
6. Ask only high-value missing context (timeline, change from usual, pattern, daily impact)  

### Internal foundation (first memory)

Care person · Observation · Uncertainty · Timeline entry — purpose is evolving understanding, not storage theater.

### Weak vs strong first response

| Weak (avoid) | Strong (target) |
|--------------|-----------------|
| Generic concern/stress checklist | Beginning of this care situation, organized |
| Fake “as we discussed before” | Known vs still unclear from **this** input |
| Condition language | What we know / what changed / what to understand better |

---

## State 2 — Returning user (existing care memory)

Central question shifts from **“What is happening?”** to **“What changed from what we previously understood?”**

### Behavior

1. Retrieve relevant prior context  
2. Compare new information to held memory  
3. Detect change and repeated patterns  
4. Preserve new observations  
5. Update uncertainty  
6. Maintain continuity (never restart)  

### Orientation structure

- **Already known** — relevant prior understanding  
- **New** — what arrived today  
- **Changed** — difference from previous reality  
- **Still unclear** — open gaps  
- **Remembered** — what stays in the care story  

---

## Intelligence evolution loop

First input → Observation → Care reality begins → New information → Compare → Detect change → Preserve decisions → Observe outcomes → Improve care memory

---

## MVP build / do-not-build

**New user — build:** first care record · first observation · first timeline · uncertainty · first memory anchor · preserve caregiver meaning  

**New user — do not:** empty dashboards · complex setup · long questionnaires · mandatory profile before value · generic AI chat  

**Returning — build:** connect to prior events · change over time · patterns · decisions/reasoning · unresolved questions · evolving history  

---

## Success metric

Not: “Did the AI respond?”  

Yes: Over time, can the caregiver understand **what changed, when, why decisions were made, and what remains uncertain?**

---

## Never hardcode

Design examples are illustrations only. Derive state from actual observation/CRS memory depth — never phrase-specific product logic.
