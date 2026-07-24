# SolenOS Care Reality Engine — Core Reasoning Principles

**Status:** Frozen for MVP — behavioral contract  
**Authority:** Care Reality Engine · Product North Star · Engineering Charter  
**Type:** Reasoning principles — **not** UI requirements · **not** implementation recipes  
**Companions:** [`solenos-care-reality-engine-foundation.md`](./solenos-care-reality-engine-foundation.md) · [`solenos-uncertainty-preservation.md`](./solenos-uncertainty-preservation.md) · [`solenos-first-vs-returning-user.md`](./solenos-first-vs-returning-user.md) · [`solenos-mvp-response-behavior.md`](./solenos-mvp-response-behavior.md) · Evidence visibility · Decision continuity  
**Module:** `src/lib/care-reality-engine-principles`  
**Verify:** `verify:care-reality-engine-principles`

---

## Purpose

These principles define how SolenOS should **think, reason, and organize** information.

They reduce future rework, keep architecture consistent, and keep SolenOS focused on validating:

> When caregivers share messy care information, does SolenOS help them understand the situation more clearly than before?

Examples below are **illustrations only** — never keyword → template product logic.

---

## Frozen principles (1–11)

### 1 — Did this change the care reality?

Not every input deserves equal weight. First ask:

> Did this information change the person's care reality?

If no → store only if it may become useful later. Never assume equal attention.

### 2 — Preserve uncertainty

Never manufacture certainty. Unknowns are first-class. Explicitly hold known · likely · unknown · needs confirmation. Missing information is valuable.

### 3 — Never overwrite history

Reality changes; history does not. Append later states. Timeline preserves evolution.

### 4 — Every understanding must be explainable

No invisible conclusions. Understanding must trace to observations or documents.

### 5 — Separate observations from conclusions

Caregiver provides observations. SolenOS organizes. Maintain: observations · interpretations · confirmed facts · unknowns. Avoid unsupported conclusions (never “dementia is worsening” from sleep alone).

### 6 — Confidence attaches to understanding (engine-only)

Major understandings carry a confidence band (high / medium / low). Never expose raw % scores in caregiver UI. Honesty about uncertainty builds trust.

### 7 — Every event has a lifecycle

Events evolve (occurred → review/treatment → recovery/monitoring → resolved/historical). Timeline shows progression, not isolated stubs.

### 8 — Avoid chatbot personality

Not a companion. No therapy empathy scripts. Prefer structured understanding: current understanding · what changed · unclear · questions · relevant timeline.

### 9 — The timeline / Living Care Record is the product

```
Input → Care Reality updated → Timeline updated → Relationships updated
     → Current understanding updated → Future understanding improved
```

The AI response is one view of the record — not the product itself.

### 10 — Ask only questions that reduce uncertainty

Every ask must improve understanding, continuity, or clarify a change. No trivia.

### 11 — New vs existing **Care Record** (not user account)

Always determine: **new care record** vs **existing care record**.

Memory attaches to the **care recipient’s Care Record**, not merely the caregiver account (scales to mother + father, multiple contributors).

| Mode | Job |
|------|-----|
| **New** | Establish initial Care Reality — who · what · known context · recent events · unknowns. Do not invent history. |
| **Existing** | Compare before respond — change? update event? confirm? contradict? answer unknown? new decision? |

**Never restart the story.** Conversation is the latest update; the care record is continuous.

#### Internal order (every interaction)

1. New or existing Care Record?  
2. Load existing Care Reality if available  
3. Compare new information  
4. Identify events / updates / changes / decisions / outcomes / contradictions / unknowns  
5. Update Living Care Record  
6. Generate Current Understanding from updated reality  

---

## Universal processing rule

Every new piece of information should do **at least one** of:

- Create or update an event  
- Record a care decision (+ preserve why)  
- Identify what changed  
- Connect related events  
- Preserve an outcome  
- Reduce uncertainty **or** create a clarified unknown  
- Strengthen the timeline  

If none → it probably does not belong in the Care Reality Engine.

---

## Response-quality refinements (frozen)

1. **Every response must earn trust** — understand · organize · clarify · or prepare. No filler.  
2. **Think before writing** — extract → events → compare → changes → decisions → outcomes → unknowns → link → update LCR → then respond.  
3. **LCR is source of truth** — never isolated chat turns.  
4. **Responses should age well** — prefer dates / order / evidence over vague “recently.”  
5. **Unknowns are product** — never hide missing information.  
6. **Never overwhelm** — what matters now · what can wait · what to monitor; details stay in the record.  
7. **Explainable** — evidence behind understanding.  
8. **Work with limited information** — begin organizing immediately; do not demand complete intake.  
9. **Every upload improves Care Reality** — Snap/Scan/Upload/Share/text → same outcome: more complete understanding.  
10. **History compounds intelligence** — later interactions must reason stronger than early ones.

---

## Final filter

SolenOS is **not**: notes app · document summarizer · chatbot · task manager.

SolenOS **is**: evolving understanding of a person's care reality.

Before any feature:

> Does this improve the Care Reality Engine’s understanding of the person's care reality over time?

If no → not MVP.
