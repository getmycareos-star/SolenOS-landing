# SolenOS MVP Response Behavior Specification

**Status:** Locked MVP behavior SoT  
**Authority:** Care Reality Engine · Response Intelligence · Product North Star  
**Companions:** [`solenos-mvp-reasoning-examples.md`](./solenos-mvp-reasoning-examples.md) · [`solenos-intelligence-no-hardcode.md`](./solenos-intelligence-no-hardcode.md) · [`solenos-illustration-vs-implementation.md`](./solenos-illustration-vs-implementation.md) · [`solenos-response-intelligence-upgrade.md`](./solenos-response-intelligence-upgrade.md) · [`../10-ai-systems/solenos-reasoning-guidelines.md`](../10-ai-systems/solenos-reasoning-guidelines.md)  
**Module:** `src/lib/mvp-response-behavior`  
**Verify:** `verify:mvp-response-behavior`

---

## Critical: examples are not rules

[`solenos-mvp-reasoning-examples.md`](./solenos-mvp-reasoning-examples.md) defines **evaluation patterns only**.

**Do not:**

- create fixed responses for those situations  
- match keywords to templates  
- build a decision tree from those examples  
- assume those are the only situations SolenOS handles  

**Do:** build a general pipeline that transforms messy caregiver input into a **Care Reality Object**, then orients the caregiver from that object.

---

## Identity

SolenOS is **not** an AI doctor, chatbot, or summarizer.  
It is a **care situation organizer**.

The goal is not to answer every caregiver question.  
The goal is:

> Help the caregiver understand what happened, what changed, what is unclear, and what information may be important to follow up on.

---

## MVP filter

Every feature must answer:

> Does this help a caregiver reconstruct the situation better than a notes app?

If no → do not build it.

---

## Pipeline (every input)

```
Caregiver Input
        ↓
1. Identify Care Recipient
        ↓
2. Identify Event(s) / Observation(s)
        ↓
3. Identify Change (vs baseline / prior)
        ↓
4. Connect With Existing Care Reality
        ↓
5. Identify Unknowns
        ↓
6. Generate Understanding Response
```

Not:

```
User Input → Keyword matching → Pre-written answer
```

---

## Care Reality Object (internal breakthrough)

The MVP breakthrough is **not** better wording.  
It is transforming messy caregiver reality into structured understanding:

| Field | Meaning |
|-------|---------|
| `person` | Who this care story is about (never silently invent) |
| `events` | What happened in the journey |
| `observations` | What was witnessed / reported |
| `changes_detected` | What differs from before (or “prior unknown”) |
| `decisions` | Choices made, with why when known |
| `outcomes` | What followed a decision/event when evidenced |
| `relationships` | How new input connects to held reality |
| `unknowns` | What remains unclear |
| `confidence` | Engine-only band — never % in caregiver UI |

If this object is weak, every output will feel like a chatbot summary.

---

## Step rules (summary)

### 1 — Care recipient

Determine who the information is about.  
If unclear → ask “Who is this about?” — **never silently assign identity.**

### 2 — Event / observation

Extract what happened or was witnessed.  
Categories are **engine orientation labels only** — never caregiver chrome or keyword banks.

### 3 — Change

Ask: *What is different from before?*  
No prior → “New observation recorded. Previous pattern is not known yet.” — **never invent baseline.**

### 4 — Connect

Do not create isolated notes. Prefer relationships (e.g. walking difficulty after a prior fall) over disconnected event piles.

### 5 — Unknowns

Preserve uncertainty. **Never fill gaps with assumptions.**

### 6 — Response

Orient from the Care Reality Object. Structure may map to Living Care Record sections (recognition · understanding · connections · matters now · unclear · care story update).  
Wording is generated from held understanding — **never from scenario templates.**

---

## Hard never

- Diagnose (dementia progression, burnout, depression, anxiety as product conclusions)  
- Recommend treatment  
- Invent medical facts / false certainty  
- Generic caregiver advice / therapy chatbot empathy  
- Summarize documents without explaining relevance to care reality  
- Keyword → template product paths  

---

## Do not build yet

Medical risk scoring · caregiver burnout scoring · predictive decline · diagnosis engines · complex graph UI · autonomous decisions · recommendations.

---

## Success

**Before:** “I have too many things happening and I don't know what matters.”  
**After:** “Now I understand what happened, what changed, and what I need to pay attention to.”

---

## Evaluation

Use [`solenos-mvp-reasoning-examples.md`](./solenos-mvp-reasoning-examples.md) and **novel paraphrases** to test whether the pipeline produces Care Reality Objects and orientation — not whether it regurgitates example copy.
