# SolenOS MVP Research Validation Directive

**Status:** Permanent Product Steward / MVP validation constraint  
**Authority:** Same force as Product North Star + Product Constitution  
**Companions:** North Star · Constitution · Input Reality · Decision Continuity · Evidence Visibility · Emotional language safety · First-time caregiver · Open uncertainties return

**Implementation:** `src/lib/mvp-research-validation` · `retention-instrumentation.ts` (Slice 5.6 weekly cohort) · composer / north-star gates · `verify:mvp-research-validation`

---

## Retention instrumentation (Slice 5.6)

Ops/research only — **never** a caregiver survey wall or engagement scoreboard.

| Hypothesis | Proxy (from Living Care Record behavior) |
|------------|------------------------------------------|
| Understand better | Orientation surface / helpful or reduced-confusion feedback |
| Less fear of forgetting | Care held + confirmation / connection / return |
| Can explain better | Held facts / situation summary / what matters now |
| Would return on change | Return visit + change update relation |

`aggregateWeeklyRetentionCohortMetrics()` → weekly rates per cohort. Quiet post-session micro-prompt UI = **FUTURE** (`RETENTION_MICRO_PROMPT_STATUS`, requires ADR).

---

## Core finding

Dementia caregivers are not only struggling with tasks. They struggle with:

- remembering everything  
- connecting information  
- deciding what matters  
- understanding change over time  
- communicating the full story to others  

**The hidden burden is cognitive load.**

SolenOS must **not** become another productivity tool.  
The product reduces the amount of care reality a person has to hold in their own memory.

Feel: *"I can put this somewhere and trust it will make sense later."*  
Never: *"I have another system to maintain."*

---

## Retention gap (honesty)

Research validates **pain**. It does **not** yet prove **retention**.

Hardest MVP question:

> What moment is painful enough that a caregiver naturally returns to SolenOS every week?

Hypothesis to test (not vanity metrics):

After using SolenOS, does the caregiver feel:

1. I understand what is happening better.  
2. I am less afraid of forgetting something important.  
3. I can explain the situation better to another person.  
4. I would use this again when something changes.  

Success is **not**: notes created · tasks completed · documents uploaded.

---

## Locked product decisions

### 1. Mental load reduction

Every interaction must reduce cognitive burden.

On any messy input (text, documents, screenshots, messages, observations — voice later), SolenOS creates understanding:

- what happened  
- what changed  
- what is connected  
- what is unknown  

Never respond as if the product only saved a note.

### 2. "What matters now" is the core experience

Do **not** create a task manager or checklist.

Create **prioritization through understanding**:

- What matters now?  
- What can wait?  
- What needs attention later?  

When several concerns arrive together, surface **current situations with status** — not a to-do dump.

### 3. Living Care Record = Care Reality

Core object is **Care Reality**, not a note.

Preserve relationships: Event → Change → Decision → Outcome → New Understanding.

Value = understanding **connections**, not storing events.

### 4. Documents are evidence

Never: Upload → summary (document analyzer).

Always: Document → extract care changes → connect to Care Reality → what changed + what remains unclear.

### 5. Unknowns are first-class

Known / Unknown / Need (possible clarification) — never invent missing information.

### 6. Personalization

Reference this person's history, events, decisions, preferences.  
Never generic dementia advice ("Falls are common in dementia.").

### 7. Emotional inputs

SolenOS is **not** therapy. Locked emotional language safety applies:

Acknowledge burden → invite care-reality share.  
Never ChatGPT empathy ("I hear you", "I'm here for you").

### 8. Input flexibility

Accept chaos. Caregiver does not organize before sending. System organizes afterward.

---

## MVP boundary

### Build now

Care Reality timeline · Situation relationships · Decision memory · Evidence linking · Source attribution · Change detection · Unknown preservation · Document → Care Reality

### Do not build now

Healthcare navigation marketplace · Training platform · Financial assistance · Medical advice engine · Care coordinator replacement · Large resource directory

Future layers only after MVP proves: *Can SolenOS reduce uncertainty and mental load?*

---

## Engineering priority (improve in this order)

1. Care Reality persistence  
2. Situation Relationship Engine  
3. Decision Memory  
4. Evidence linking  
5. Current State understanding  
6. Document → Care Reality pipeline  
7. Response behavior  
8. Mobile simplicity  

---

## Final principle

Caregivers do not need another place to store care information.

They need a system that turns scattered care moments into understandable history — an **external memory system** for the care journey:

```
care events → decisions → outcomes → future understanding
```

The biggest improvement research suggests is not adding features.  
It is making SolenOS feel less like a tool and more like that memory layer.
