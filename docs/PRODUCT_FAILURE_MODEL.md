# SolenOS — Product Failure Model

> **The failure is not that caregivers ask questions. The failure is that caregiving has no continuously maintained memory or shared understanding. Questions are merely symptoms of that failure.**

---

## The hidden failure

Most caregiving tools optimize for **storing information**.

Caregivers fail because they are forced to **continuously reconstruct reality**:

- What happened?
- What changed?
- What matters now?
- What can wait?
- What should I tell the doctor?
- Am I forgetting something?

No system maintains an evolving understanding of the care journey. **SolenOS exists to eliminate that reconstruction.**

---

## The continuity gap

**Current caregiving:**

```
Observation → Memory → Forgetting → Reconstruction → Decision
```

**SolenOS:**

```
Observation → CareEvent → CareContext → State of Care → Decision
```

Memory is replaced with continuously maintained context.

---

## Questions are symptoms

> "Should I hire professional help?"

They are not asking for an opinion. They reveal **missing connected context**:

- Increasing falls
- Worsening mobility
- Growing caregiver exhaustion
- Nighttime wandering
- Medication changes
- Cognitive decline
- Increasing supervision

Nobody has connected these events into a coherent picture.

---

## Every question maps to missing context

| Caregiver question | Missing capability |
|---|---|
| "Is this getting worse?" | Diff Engine, Timeline Engine |
| "What should I do next?" | Prioritization Engine, State of Care |
| "Am I forgetting something?" | CareContext, Return Value Loop |
| "Should I worry?" | Risk Engine, Trust Layer, Confidence System |
| "What do I tell the doctor?" | Clinical Summary Generator, Timeline Reconstruction |

Implementation: `src/lib/care-context/question-capability-map.ts`

---

## Build the cause, not the answer

**Question:** "Is Dad getting worse?"

**Do NOT build:** A longer AI explanation.

**Build:** Progression detection, timeline reconstruction, change detection, confidence scoring, evidence display.

Implementation: `src/lib/care-context/diagnose-question-failure.ts`

---

## Architectural rule

When a new caregiver question appears:

1. What continuity failure caused this question?
2. Which engine should prevent that failure?
3. Can the system surface this proactively before the caregiver asks?

If yes → **build the engine**, not another response template.

Implementation: `src/lib/care-context/proactive-surface.ts`

---

## Product success metric

**Do not measure:**

- Number of conversations
- Number of AI responses
- Session length

**Measure reductions in:**

- Caregiver uncertainty
- Repeated questions
- Memory reconstruction
- Decision hesitation
- Information fragmentation

Implementation: `src/lib/care-context/success-metrics.ts`

---

## Strategic advantage

LLMs can answer caregiver questions — that advantage is commoditized.

SolenOS' durable advantage: a **longitudinal, structured, evolving model** of one family's care journey. That history cannot be recreated from a single prompt. It compounds over time.

**Accumulated continuity — not the language model — is the defensible asset.**

---

## Final product invariant

> Every caregiver question is evidence of missing continuity. SolenOS transforms fragmented observations into an evolving, evidence-based CareContext so caregivers no longer reconstruct reality from memory. The product wins not by answering more questions, but by making many of those questions unnecessary.

---

## Code map

```
src/lib/care-context/
  question-capability-map.ts   — question → missing engine(s)
  diagnose-question-failure.ts   — continuity failure diagnosis
  proactive-surface.ts           — surface before they ask
  success-metrics.ts             — inverse validation metrics
  continuity-gap.ts              — workflow model comparison
```

See also: [PRODUCT_ARCHITECTURE.md](./PRODUCT_ARCHITECTURE.md), [PRODUCT_INTELLIGENCE.md](./PRODUCT_INTELLIGENCE.md)
