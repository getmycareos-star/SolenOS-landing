/**
 * ADR-021: Care Reality State + Product Identity Architecture
 *
 * Status: Accepted
 * Date: 2026-07-16
 */

# ADR-021 — Care Reality State & Protecting Product Identity

## Context

Persistence, Active Care Situation continuity, and Progressive Understanding preserve and evolve information. Without a **Care Reality State**, caregiver responses can still feel generated from the latest message — a form processor, not a Living Care Record.

Product identity also requires progressive disclosure, person-first baseline comparison, decision memory, evidence weighting, and cognitive load discipline. Those are architecture contracts; not all require full engines in MVP.

## Decision

### Core chain (updated)

```
Input → Capture → CareContext → Active Care Situation
  → Progressive Understanding → Care Reality State
  → Living Care Record → Timeline
```

### Care Reality State (P0)

Module: `src/lib/care-reality-state`

- Continuously updated understanding of the person's **current** care reality
- Not a note, event, or timeline
- Every observation / clarification updates it
- Every caregiver response is projected from it (plus disclosure plan)
- Durable under `.data/care-reality-state/`; cleared when ACS is paused

### Response Evolution Engine (P0-9)

Before caregiver-facing copy, evaluate:

1. Updates Active Care Situation?
2. Answers a previous uncertainty?
3. Strengthens an existing hypothesis?
4. Introduces a new pattern?
5. Changes what matters now?
6. Invalidates previous understanding?

The response explains how understanding evolved — it never restarts.

### Progressive Information Disclosure (P0-10)

| Stage | Reveal |
|-------|--------|
| early | Confirmation, current understanding, ask only if a real gap warrants it |
| growing | What changed, understanding, Clarity triad, ask only if warranted |
| established | Situation summary, pattern, remembered, evidence optional |

Caregiver-facing asks are **never** an emotional interview or event-kind phrase template (e.g. not “fall → head”) — see ADR-022.

The Living Care Record stores everything; the interface reveals only what helps now.

### Product identity contracts (P1 / P2)

Module: `src/lib/product-identity-architecture` — **CONTRACT** status:

- P1-9 Stable Care Identity  
- P1-10 Baseline vs Change (person history first)  
- P1-11 Decision Memory  
- P1-12 Evidence Hierarchy  
- P1-13 Understanding Lifecycle (revisions on Care Reality State)  
- P2-4 Cognitive Load Budget (one primary question per screen)

### Non-negotiable

> The Living Care Record is the persistent history of an evolving Care Reality State — not a collection of notes.

Internal question: *How has our understanding of this person's care reality changed?*  
Never: *What did the caregiver just type?*

## Consequences

- ACS ingest updates Care Reality State after Progressive Understanding  
- `LivingCareRecordPanel` respects `disclosure_plan`  
- Pause ACS also clears Care Reality State for that caregiver  
- Verify: `verify:care-reality-state`  

## References

- ADR-019 Living Care Record UX  
- ADR-020 Progressive Understanding Engine  
- Product North Star / Care Reality Intelligence  
