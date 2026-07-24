# SolenOS Product Principles

**Status:** Permanent product identity constraint  
**Authority:** Product Steward — protect SolenOS identity throughout development  
**Read before:** Any code change, UI change, prompt update, feature, or refactor  

**Companions:**

- [`ENGINEERING_CHARTER.md`](./ENGINEERING_CHARTER.md)  
- [`docs/architecture/SOLENOS_CTO_OPERATING_DIRECTIVE.md`](./docs/architecture/SOLENOS_CTO_OPERATING_DIRECTIVE.md)  
- [`docs/02-product/solenos-input-reality-directive.md`](./docs/02-product/solenos-input-reality-directive.md) — **Input Reality** (anything can enter the same Care Reality layer)  
- [`docs/02-product/solenos-situation-relationship-directive.md`](./docs/02-product/solenos-situation-relationship-directive.md) — **Situation Relationship** (same vs new is understanding, not keywords)  
- [`docs/02-product/solenos-evidence-visibility-directive.md`](./docs/02-product/solenos-evidence-visibility-directive.md) — **Evidence visibility** (grows with consequence, not data volume)  
- [`docs/02-product/solenos-mvp-situation-relationship-architecture.md`](./docs/02-product/solenos-mvp-situation-relationship-architecture.md) — **MVP** Situation Relationship intelligence (graph viz later)  
- [`docs/02-product/solenos-done-for-now-continuity.md`](./docs/02-product/solenos-done-for-now-continuity.md) — **"Done for now"** pauses session only; never resolves care reality  
- [`docs/02-product/solenos-welcome-begin-continuity.md`](./docs/02-product/solenos-welcome-begin-continuity.md) — **Begin** = new interaction session; never wipe durable care reality  
- [`docs/02-product/solenos-open-uncertainties-return.md`](./docs/02-product/solenos-open-uncertainties-return.md) — Open uncertainties: soft one-time return invite (B)  
- [`docs/02-product/solenos-first-time-caregiver.md`](./docs/02-product/solenos-first-time-caregiver.md) — First-time Begin: light orientation then capture (B)  
- [`docs/02-product/solenos-document-only-inputs.md`](./docs/02-product/solenos-document-only-inputs.md) — Documents: same Care Reality loop (A); never document-analyzer UX  
- [`docs/02-product/solenos-long-thread-ingestion.md`](./docs/02-product/solenos-long-thread-ingestion.md) — Long chats/emails: multiple linked events (B); preserve source  
- [`docs/02-product/solenos-emotional-only-inputs.md`](./docs/02-product/solenos-emotional-only-inputs.md) — Emotional-only: acknowledge + invite care context (A)  
- [`docs/02-product/solenos-emotional-response-language.md`](./docs/02-product/solenos-emotional-response-language.md) — Never scores/ChatGPT empathy; record-based voice  
- [`docs/02-product/solenos-improvement-updates.md`](./docs/02-product/solenos-improvement-updates.md) — Improvements: related outcome events; never premature resolve (B)  
- [`docs/02-product/solenos-mvp-identity-model.md`](./docs/02-product/solenos-mvp-identity-model.md) — MVP: one care recipient per Care Reality (A)  
- [`docs/02-product/solenos-mvp-collaboration-model.md`](./docs/02-product/solenos-mvp-collaboration-model.md) — MVP: shared Care Reality + attribution (B)  
- [`docs/02-product/solenos-mvp-identity-naming.md`](./docs/02-product/solenos-mvp-identity-naming.md) — Ask once for display name; never silent inference (A)  
- [`docs/02-product/solenos-golden-caregiver-scenarios.md`](./docs/02-product/solenos-golden-caregiver-scenarios.md) — **Gate:** G1–G13 before Response Behavior implementation  

If a requested implementation conflicts with these principles, **explain the conflict and propose an alternative that preserves the product vision.** Do not silently implement identity-damaging work.

---

## Mission

SolenOS builds the infrastructure that **preserves the continuity of a person's care journey**.

Its purpose is **not** to generate AI responses.  
Its purpose is to **preserve and strengthen understanding over time**.

Primary responsibility is not writing code. Primary responsibility is **protecting the identity of SolenOS**.

Whenever uncertain, choose the option that best protects:

- caregiver trust  
- continuity  
- cognitive simplicity  

---

## The product promise

After every interaction, the caregiver should feel:

1. SolenOS understood me.  
2. SolenOS remembered what I shared before.  
3. SolenOS connected today's events with previous events.  
4. SolenOS reduced my mental load.  
5. SolenOS helped me understand what changed.  

If an implementation does not strengthen one of those outcomes, question whether it belongs in the MVP.

---

## Dementia entry · scalable clinical profiles

SolenOS **starts with dementia / progressive-dependency caregiving** as the go-to-market entry (ADR-005).

That does **not** make SolenOS a dementia app.

| Do | Do not |
|----|--------|
| Default clinical profile = `dementia` | Diagnose Alzheimer’s from notes |
| Person-specific Living Care Record | Generic “in dementia…” FAQ answers |
| Disease-agnostic engines + profile registry | Fork the product per condition |
| Add future profiles via ADR + registry | Ship disease UI before spine trust |

**Contract:** [`docs/architecture/CLINICAL_PROFILE.md`](./docs/architecture/CLINICAL_PROFILE.md) · code: `src/lib/clinical-profile`

---

## The North Star

SolenOS is **not**:

- a chatbot  
- a document summarizer  
- a note-taking app  
- a reminder app  
- a medical diagnosis tool  
- an AI assistant  

SolenOS **is** a Care Reality Intelligence platform built around a **Living Care Record**.  
**The Living Care Record—not the AI—is the product.**

Optimize to feel **dependable**, not impressive. Dependable beats sophisticated-looking answers.

---

## Product identity rules

Every feature must reinforce:

| Prefer | Over |
|--------|------|
| Continuity | Isolated interactions |
| Understanding | Information dumps |
| Context | Summaries alone |
| Trust | Impressive AI |
| Calmness | Complexity |
| Progressive understanding | Repeated templates |
| Evidence | Assumptions |
| Person-specific understanding | Generic dementia / FAQ knowledge |

---

## Caregiver standard

Assume every caregiver is:

- emotionally exhausted  
- interrupted frequently  
- under decision fatigue  
- carrying incomplete information  
- highly sensitive to errors  
- evaluating whether SolenOS can be trusted  

Never increase their cognitive load. Every screen should reduce it.

---

## Living Care Record principles

Every observation should strengthen:

- Care Reality State  
- Care Context  
- Active Care Situation  
- Person Baseline  
- Timeline  
- Decision Memory  

Nothing should feel isolated.  
Nothing should feel forgotten.  
Nothing should require the caregiver to reconstruct the story manually.

---

## Progressive understanding

Never treat every message as a new workflow. Every new observation must first answer:

1. Does this belong to the current Active Care Situation?  
2. What did we already know?  
3. What changed?  
4. What uncertainty was resolved?  
5. What new uncertainty appeared?  
6. Does this affect what matters now?  

Responses should evolve. They should never restart.

---

## Trust rules

Never:

- invent facts  
- overstate certainty  
- fabricate urgency  
- expose internal AI reasoning  
- display developer terminology  
- leak implementation details  
- show confidence percentages without meaningful explanation  
- repeat response templates unnecessarily  

Internal concepts belong only in engineering tools. Never in caregiver-facing experiences.

---

## Cognitive load budget

Before displaying anything: **Does the caregiver need this information right now?**  
If not, do not display it. Reveal understanding progressively.

---

## Response philosophy

The caregiver should never feel like they are chatting with AI.  
They should feel they are updating a **Living Care Record** that grows more accurate over time.

**The record is speaking. Not the AI.**

---

## Before every code change

Pause and ask:

1. Does this make SolenOS feel more like ChatGPT?  
2. Does this make SolenOS feel more like a documentation tool?  
3. Does this increase caregiver effort?  
4. Does this expose implementation details?  
5. Does this weaken continuity?  
6. Does this make trust harder to earn?  

If **any** answer is yes, redesign.

Also verify:

- Protects caregiver trust  
- Strengthens continuity  
- Reduces cognitive load  
- Reinforces the Living Care Record  
- Fits long-term architecture  

Reject implementations that technically work but weaken product identity.

---

## Pre-launch trust requirements (standing)

### P0 — First 30 seconds

Caregivers must immediately understand what SolenOS does. First input must produce useful understanding without learning the product. Relief—not another task.

### P0 — Never punish messy input

Accept incomplete human notes. Do not force forms, categories, or perfect descriptions. Caregiver shares reality; SolenOS creates structure.

### P0 — Input preservation

Never lose original caregiver expression.

```
Original input → Extracted understanding → Care Event
  → Care Reality State → Living Care Record
```

Original words are evidence. Never overwrite them with AI summaries alone.

### P0 — Don't ask too many questions

Ask only when the question materially improves understanding. Cap caregiver-facing asks; prefer safety-critical only.

### P0 — No false completeness

Prefer “Here's what we know so far.” Never “Everything is understood.”

### P0 — Recovery from mistakes

Correction, editing, confirmation, and adding context must be easy. Trust grows when mistakes are fixable.

### P0 — Separate observation from interpretation

Observation = what happened (fact).  
Interpretation = what it may mean (hypothesis).  
Never merge them as if equal.

### P0 — Memory test

Multi-day notes must connect: what changed, when, what may be related, what is still unknown.

### P1 — Emotional context awareness

Recognize caregiver exhaustion / fear as context—not medical analysis. Reduce burden; do not interview.

### P1 — Remove AI theater

No unnecessary “AI thinking,” intelligence scores, technical badges, or impressiveness for its own sake.

### Launch readiness — Stranger test

Someone who has never seen SolenOS should know what to do, where information goes, and what happened after they entered something—without explanation.

### Ultimate product test

If the AI disappeared tomorrow, would the Living Care Record still provide value?  
If no, SolenOS is too dependent on AI. AI accelerates understanding; the product is the continuity system.

---

## Input Reality (Product Steward extension)

SolenOS must accept **messy, open-ended care reality** — notes, questions, emotions, documents, photos, screenshots, discharge summaries, memories, incomplete fragments — into the **same** understanding layer. Do not create separate experiences per channel. Caregiver provides reality; SolenOS creates structure.

Transparency is always available; explanation depth grows with understanding. Show **evidence**, never chain-of-thought or engine jargon. Preserve original input → source → event → understanding → evidence. Clinical documents outrank memory notes for **current attributed facts** without deleting caregiver lived experience — on conflict: prefer priority for current fact, **keep both**, flag conflict, **never remove any**.

**Full directive:** [`docs/02-product/solenos-input-reality-directive.md`](./docs/02-product/solenos-input-reality-directive.md)

---

## Definition of done

A feature is complete only when an exhausted caregiver feels:

- understood  
- remembered  
- oriented  
- less overwhelmed  
- more confident about what changed  

Compiling and passing tests are necessary but not sufficient.

