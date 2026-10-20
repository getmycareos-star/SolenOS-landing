# Reasoning Layer — Care Reality Model Before Language (SolenOS)

**Status:** Locked product SoT · Reasoning architecture correction  
**Authority:** Care Reality Engine · Response Intelligence · Extraction · Composer  
**Companions:** [`solenos-intelligence-no-hardcode.md`](./solenos-intelligence-no-hardcode.md) · [`solenos-care-reality-language.md`](./solenos-care-reality-language.md) · [`solenos-response-intelligence-directive.md`](./solenos-response-intelligence-directive.md) · [`solenos-first-vs-returning-user.md`](./solenos-first-vs-returning-user.md) · [`solenos-care-recipient-anchor.md`](./solenos-care-recipient-anchor.md) · [`solenos-baseline-comparison-engine.md`](./solenos-baseline-comparison-engine.md) · [`solenos-situation-generator.md`](./solenos-situation-generator.md)  
**Module:** `src/lib/care-reality-intelligence/situation-model.ts` · caregiver-response-composer  
**Verify:** `verify:care-reality-situation-model`

---

## Critical warning

**Do not implement this as a keyword detection system.**

Doc examples are **not** fixed categories to search for.  
They are examples of **underlying care reality changes**.

Caregivers will not use clinical language. They provide messy thoughts, emotion, incomplete memories, voice, photos, screenshots, medication images, hospital paperwork, fragmented messages, and repeated concerns over time.

Infer the underlying situation from natural caregiver communication.

| Never search only for | Always ask |
|----------------------|------------|
| “confusion” · “fall” · “medication change” · “sleeping more” | **What appears different from this person’s normal state?** |

---

## Core reasoning object: change from baseline

Internally always ask:

1. What was normal before?  
2. What appears different now?  
3. What event may explain the change?  
4. What remains uncertain?

### Illustration only (never product if-branches)

Input: *“I don't know what's wrong with dad. He used to sit outside every morning but now he just stays in bed and doesn't want to talk.”*

| Wrong | Right |
|-------|-------|
| “User mentioned sitting outside.” | Possible care reality change: reduced activity · reduced engagement · possible mood/behavior shift · change from previous routine. Unknown: when it started · what caused it · whether temporary. |

---

## Care reality category areas (meaning shapes — not keyword banks)

1. **Person state changes** — cognition, memory, awareness, communication, behavior, mood, personality, sleep, appetite, energy  
2. **Safety changes** — falls/near-falls from *context*, leaving home unexpectedly, unsafe decisions, medication errors, inability to complete familiar activities safely, increased supervision needs  
3. **Functional changes** — help with routines, dressing, food prep, mobility, independence  
4. **Care decisions** — medication / hospital / provider / support / family choices  
5. **Care environment changes** — caregiver availability, family involvement, living arrangements, responsibility load  
6. **Unknowns** — unclear cause, missing timeline, missing decision reasoning, conflicting perspectives  

---

## Do not treat all information equally

Separate: facts · observations · emotions · opinions · fears · assumptions · questions.

| Input shape | Internal type | Importance |
|-------------|---------------|------------|
| “My brother thinks I'm overreacting.” | Family perspective | Context — not primary care situation |
| “I noticed she stopped eating after the medication change.” | Observed change + possible relationship | High |

---

## Build Care Reality Model before generating language

Before any caregiver-facing response, construct:

| Field | Question |
|-------|----------|
| Person | Who is this about? |
| Baseline | What was normal before? |
| Observed changes | What is different now? |
| Timeline | What happened before and after? |
| Events | Important moments |
| Decisions | Actions taken |
| Outcomes | What happened afterward? |
| Unknowns | What is unclear? |
| Confidence | How certain is this understanding? (**engine-only** — never % in UI) |

**Only after this model exists** should the system generate language.

---

## First response goal

Not helpful advice. **Orientation.**

Feel: *“Yes, this system understands what is happening.”*  
Never: *“It summarized what I wrote.”*

### MVP one-screen structure

1. **Current understanding** — human explanation of the situation  
2. **What changed** — only meaningful changes  
3. **Still unclear** — important missing context  
4. **One thing to add** — one high-value question  

### Anti-patterns (reject)

- “Here are your tasks”  
- “Here are your notes”  
- “Here are 10 things to monitor”  
- “You should contact…”  
- “Your care summary”  
- “The most important sentence was…”  

These feel like a notes app, chatbot, or medical checklist — not SolenOS.

---

## Final engineering principle

Intelligence is not extracting information.  
Intelligence is recognizing: **“A person's care reality may have changed.”**

Behave like someone who has followed the story over time:

> “Here is what seems different, here is what connects, and here is what we still don't understand.”

That is the Care Reality Engine.

---

## Pipeline discipline (non-negotiable)

```
Ingestion → Extraction → Prioritization → Situation modeling → Response generation → UI
```

**Before changing UI components**, inspect this full pipeline.  
Bugs are usually **upstream of the UI**.  

**Do not patch examples. Fix the reasoning architecture.**
