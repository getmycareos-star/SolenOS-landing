# SolenOS — Real Caregiver Demand → Product Architecture

> **Every caregiver question is evidence of missing continuity.**

This research is **product research**, not content research. Recurring caregiver questions represent failures in today's caregiving systems: uncertainty, cognitive overload, fragmented memory, and difficult decision-making.

**Goal:** Build a system that makes caregivers need to ask fewer questions over time — not answer more of them.

---

## Core product insight

Caregivers are not asking for more medical information. They lack confidence in their understanding of an **evolving care situation**.

| Continuity questions (product fit) | Not the core problem |
|---|---|
| Am I doing enough? | More medical facts |
| Is this normal? | Chatbot conversations |
| Is it getting worse? | Search results |
| Should I hire help? | Generic health info |
| Am I missing something? | |
| When should I call the doctor? | |
| What should I do next? | |

These are **continuity problems** — failures of situational understanding.

---

## System design principle

> SolenOS must reduce uncertainty before generating recommendations.

Recommendations emerge from increasingly accurate **CareContext**. The product is optimized for **understanding**, not answers.

---

## Product identity

**Never become:** AI therapist, AI doctor, search engine, chatbot, medical encyclopedia.

**Become:** The continuously updated understanding of a family's care journey. Everything else is built on top.

---

## Real user jobs

| Job | Caregiver need | SolenOS response |
|---|---|---|
| 1. Reduce decision fatigue | "What should I do? Is it enough? Is it time?" | Context-backed guidance, fewer blind decisions |
| 2. Reduce cognitive load | Remember symptoms, timelines, meds, appointments | Continuous reality reconstruction |
| 3. Make progression visible | Is it improving, stable, or deteriorating? | Diff Engine + State of Care + Timeline |
| 4. Increase decision confidence | Appropriate confidence, not false certainty | Trust Layer: known, uncertain, evidence |
| 5. Prepare for conversations | Communicate with doctors, family, caregivers | Structured chronological summaries (Care Snapshot) |

Implementation: `src/lib/care-context/caregiver-jobs.ts`

---

## Core engines

| Engine | Purpose | Module |
|---|---|---|
| **Timeline Reconstruction** | Fragmented narratives → chronological sequences | `engines/timeline-engine.ts` |
| **Diff Engine** | "What has changed?" — highest-value output | `engines/diff-engine.ts` |
| **State of Care** | Improving / stable / deteriorating | `engines/state-of-care-engine.ts` |
| **Caregiver Load** | Estimate burden from open issues, crises, complexity | `engines/caregiver-load-engine.ts` |
| **Clarification** | Reduce uncertainty blocking recommendations | `engines/clarification-engine.ts` |
| **Trust Layer** | Explain why, evidence, gaps, confidence | `engines/trust-layer.ts` |
| **Pattern Learning** | Recurring family patterns without causation claims | `engines/pattern-learning-engine.ts` |

Orchestrator: `src/lib/care-context/reason-through-context.ts`

---

## Capability requirement example

**Question:** "Should I hire professional help?"

SolenOS does **not** immediately answer. It reasons through CareContext:

- Has caregiver burden increased?
- Has mobility declined?
- Have nighttime events increased?
- Has supervision demand increased?
- Has wandering become more frequent?
- Have medications changed?
- Has uncertainty increased?
- Have crisis events become more common?

Only then generates guidance from continuity.

---

## Product surface principle

Caregivers do not want more screens, dashboards, settings, or conversations.

They want:

- Fewer things to remember
- Fewer decisions made blindly
- Fewer surprises
- Fewer moments of uncertainty

Every feature is evaluated against those outcomes.

---

## Information demand vs continuity demand

**Information demand** (content may attract): insurance, costs, salaries, legal programs.

**Continuity demand** (product-market fit): "I can't remember what happened", "Is this getting worse?", "What changed?", "Am I missing something?"

Roadmap prioritizes **continuity demand**.

---

## Success definition

Research is reflected when caregivers stop asking:

- Is this normal?
- What changed?
- Should I worry?
- Am I forgetting something?
- What should I do next?

…because SolenOS already surfaced what mattered through evolving CareContext.

**Highest compliment:** "I didn't have to ask because SolenOS had already shown me what mattered."

---

## Final architectural principle

> SolenOS should not optimize to answer more questions. It should optimize to eliminate the need for those questions by maintaining an evolving, evidence-based understanding of the care journey.

---

## Code map

```
src/lib/care-context/
  types.ts                      — extended CareContext + engine outputs
  caregiver-jobs.ts             — five real user jobs
  reason-through-context.ts     — full pipeline orchestrator
  engines/
    timeline-engine.ts
    diff-engine.ts
    state-of-care-engine.ts
    caregiver-load-engine.ts
    clarification-engine.ts
    trust-layer.ts
    pattern-learning-engine.ts
  interpret-question.ts         — question → signals (not answers)
  apply-to-context.ts           — merge into longitudinal context
  continuity-engine.ts          — State of Care surface outputs
```

See also: [PRODUCT_INTELLIGENCE.md](./PRODUCT_INTELLIGENCE.md)
