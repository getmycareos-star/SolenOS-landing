# Baseline Comparison Engine (SolenOS Architecture Directive #2)

**Status:** Locked architecture directive  
**Authority:** Care Reality Engine · Situation Model · Care Recipient Anchor · Care Epistemics (G34/G45)  
**Companions:** [`solenos-care-recipient-anchor.md`](./solenos-care-recipient-anchor.md) · [`solenos-care-reality-situation-model.md`](./solenos-care-reality-situation-model.md) · [`solenos-final-intelligence-refinement.md`](./solenos-final-intelligence-refinement.md) · [`solenos-care-reality-engine-foundation.md`](./solenos-care-reality-engine-foundation.md) · [`solenos-initial-care-reality-assessment.md`](./solenos-initial-care-reality-assessment.md)  
**Module:** `src/lib/care-reality-intelligence/baseline-comparison-engine.ts`  
**Verify:** `verify:baseline-comparison-engine`

---

## Problem

Recognizing information is not understanding change.

Caregivers need:

> **What is different from before?**

Without a previous normal, SolenOS can only summarize events.

| Summary (wrong product) | Care intelligence (required) |
|-------------------------|------------------------------|
| Mom is sleeping more and has become confused | Mom's sleep and cognition appear different from her previous baseline — timing may relate to nearby medical transitions; **cause unclear** |

---

## Core principle

Every person receiving care has a **baseline**. SolenOS continuously learns:

```
Previous Reality → New Observation → Difference Detected → Possible Meaning → What Needs Attention
```

Ask **what changed?** — never only **what information do we have?**

The baseline is **not** a profile form. It is an evolving understanding from caregiver interactions, documents, and observations.

---

## Domains (internal)

| Domain | Living baseline examples (illustrations only) |
|--------|-----------------------------------------------|
| Function | Walking, preparing food, personal care, staying home safely |
| Cognition | Typical memory, familiar routines, recognition patterns |
| Behavior | Calm/agitation patterns, sleep habits, social patterns |
| Physical | Mobility, appetite, energy, sleep |
| Medical | Medications, recent procedures, known risks |

Examples in this doc are **illustrations only** — never product if-branches on cook / hospital / dementia nouns.

---

## Comparison contract

Every new input is compared against held baseline (same-turn discourse **or** prior durable familiarity):

1. What was normal before?  
2. What is happening now?  
3. What changed?  
4. When did the change begin? (often unknown)  
5. What events happened around the change? (related context — not proven cause)

### Never invent causation

**Bad:** “Mom is sleeping more because dementia is progressing.”  
**Good:** “Mom is sleeping more than usual. Possible factors may include recent medication changes, illness recovery, or condition progression — **the cause is unclear**.”

Never assume a new observation is automatically caused by a diagnosis.

---

## Data model (`Baseline_State`)

```
person_id
domain: cognition | behavior | function | physical | medical | general
previous_state
current_observation
change_detected
date_change_noticed
related_events
confidence   ← engine-only; never % in caregiver UI
unknowns
```

---

## MVP scope

1. Reconstruct baseline from first caregiver input that establishes usual / used-to / every-X patterns.  
2. Compare every new input (including same-turn contrast) against that baseline.  
3. Surface **meaningful** changes only — not every textual difference.  
4. Preserve uncertainty about timing and cause.  
5. Do **not** ship a complete medical baseline system yet.

---

## Pipeline position

```
Care Recipient Anchor
        ↓
Baseline Comparison Engine
        ↓
Situation Model
        ↓
Response Contract / Composer
```

Fix **reasoning** (baseline → change). Do not patch UI copy with scenario templates.

---

## Product feel

| Before | After SolenOS |
|--------|----------------|
| “I don't know if this is new or normal.” | “This is different from Mom's usual pattern. It started after a nearby care transition — here is what we know and what remains unclear.” |

---

## Acceptance test (illustration fixture)

Input: used-to daily activity + month-long cessation + leaving-home with mistaken purpose.

| Fail | Succeed |
|------|---------|
| Flat extraction (“stopped cooking and left the house”) · task list · dementia causation | Current understanding of **changes from previous routine** · distinct meaningful changes · shift from prior pattern · still unclear on timing / co-occurrence / prior medical or environmental context |

---

## Product principle

Do not build SolenOS as a memory of everything the caregiver says.

Build SolenOS as a system that understands:

> **Who was this person before, what is different now, and what does that change mean?**

The baseline is what transforms SolenOS from a note-taking tool into a care intelligence system.
