# SolenOS — Market Research → Product Intelligence

> **Core principle:** SolenOS is not built to answer questions. It is built to understand the underlying care situation that caused the question.

Caregiver questions collected from Reddit and search research are **market signals**, not feature requests. They represent real uncertainty that should influence product design, CareContext reasoning, the Clarification Engine, State of Care, content strategy, and future capabilities.

---

## Product truth

Caregivers are rarely asking for an AI assistant, chatbot, long conversations, or generic health information.

They are asking:

- "Help me understand what is happening."
- "Help me understand what changed."
- "Help me decide what to do next."

**SolenOS thesis:** Maintain an evolving understanding of a family's care journey so caregivers no longer have to reconstruct reality from memory.

---

## Product requirement

Every caregiver question is an opportunity to reconstruct **CareContext**.

Example input:

> "Dad has started wandering at night. I'm exhausted. How do I know if it's time for professional care?"

SolenOS must **not** respond like a search engine.

Instead it should:

1. Create one or more CareEvents
2. Update the Timeline
3. Compare against historical CareContext
4. Detect progression or change
5. Compute what changed
6. Highlight uncertainty
7. Prioritize next actions
8. Recommend consulting an appropriate healthcare professional when clinically appropriate
9. Preserve this as part of the longitudinal care journey

The answer is derived from **evolving context** — not isolated prompts.

Implementation: `src/lib/care-context/interpret-question.ts`

---

## Caregiver questions are signals

Many different questions share the same underlying problem.

| Signal theme | Example surface questions | Underlying need |
|---|---|---|
| Financial uncertainty | Medicare, Medicaid, paying caregivers, cost of care | "I am making difficult care decisions under financial uncertainty." |
| Care coordination | Hiring caregivers, live-in care, respite care | "I cannot coordinate care effectively." |
| Disease progression | 24/7 care, warning signs, supervision | "I don't understand how reality is changing." |
| Emotional burden | Burnout, guilt, work-life balance | "I am carrying too much cognitive load." |
| Decision making | Home vs memory care, when to hire help | "I need confidence in my next decision." |

Implementation: `src/lib/care-context/question-signals.ts`

---

## Search demand vs continuity demand

**Search demand** — user primarily wants information.

> "Does Medicare cover dementia care?"

**Continuity demand** — user is experiencing the exact problem SolenOS solves.

> "I can't remember what happened at the last appointment."
> "Everything is getting mixed up."
> "Things keep changing."

**Product optimizes for continuity demand.** Content may attract search demand; product validation comes from users returning because SolenOS maintains their evolving CareContext.

---

## Continuity questions (engine outputs)

The product should answer these using longitudinal CareContext, not one-off conversations:

- What changed?
- What matters now?
- What can wait?
- What remains uncertain?
- What should happen next?

Implementation: `src/lib/care-context/continuity-engine.ts`

---

## Content strategy (MVP)

Educational content should:

1. Answer the caregiver's question honestly
2. Provide practical guidance
3. Explain uncertainty where appropriate
4. Naturally introduce SolenOS as a **continuity system**

**Never position as:** "AI that answers caregiver questions."

**Always position as:** "The system that remembers, organizes, and continuously understands the care journey."

Priority topics: `src/lib/care-context/content-topics.ts`

---

## Success definition

Research is successfully incorporated when:

- Caregiver questions improve product understanding rather than generating answers
- Educational content attracts caregivers experiencing continuity problems
- SolenOS transforms fragmented situations into evolving CareContext
- Users return because they no longer need to reconstruct reality from memory

---

## Final product principle

> SolenOS should never optimize to become the best answer engine for caregiver questions.

> It should optimize to become the best system for continuously understanding the care journey that caused those questions in the first place.

---

## Code map

```
src/lib/care-context/
  types.ts                      — CareContext, signals, engine outputs
  caregiver-jobs.ts             — five real user jobs
  reason-through-context.ts     — full pipeline orchestrator
  engines/                      — see PRODUCT_ARCHITECTURE.md
  interpret-question.ts         — question → signals (not answers)
  apply-to-context.ts           — merge into longitudinal context
  continuity-engine.ts          — State of Care surface outputs
  content-topics.ts             — priority content registry

src/lib/care-snapshot/          — export primitive (CareContext → shareable doc)
```

See also: [PRODUCT_ARCHITECTURE.md](./PRODUCT_ARCHITECTURE.md), [PRODUCT_FAILURE_MODEL.md](./PRODUCT_FAILURE_MODEL.md)
