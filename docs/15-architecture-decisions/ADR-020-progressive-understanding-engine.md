/**
 * ADR-020: Progressive Understanding Engine
 *
 * Status: Accepted
 * Date: 2026-07-16
 */

# ADR-020 — Progressive Understanding Engine

## Context

Persistence, routing, spine linking, and Active Care Situation continuity preserve and connect information. They do not by themselves create an **evolving understanding** of a person's care reality.

Without a dedicated reasoning layer, each observation can still feel like a restarted response — “another form,” “another AI message” — even when events share a `situation_id`.

## Decision

Introduce **Progressive Understanding Engine** as a first-class system component:

`Input → Capture → CareContext → Active Care Situation → Progressive Understanding → Care Reality State → Living Care Record → Timeline`

Module: `src/lib/progressive-understanding`

It is **not** a UI feature, **not** a prompt, and **not** another LLM call. It is deterministic reasoning over ACS state + the new observation.

Care Reality State (ADR-021) sits after this engine and is the SoT for caregiver-facing projection.

### Responsibilities

Before caregiver-facing copy is produced, evaluate the new observation against the open Active Care Situation:

1. Belong to current ACS? (relation owned by ACS classify / spine link)  
2. Answer an earlier uncertainty? → resolve automatically  
3. Strengthen an existing pattern? → evolve synthesis  
4. Introduce a new dimension? → name it (e.g. appetite alongside mood)  
5. Change what matters now? → evolve priorities; do not regenerate from scratch  

### Product rule

Every update response must answer:

> What changed in our understanding since the last update?

Not: what did the caregiver just type.

### Caregiver-facing fields

- `what_changed_in_understanding`  
- Evolving `current_understanding` / synthesis / `what_matters_now` / questions  
- Confirmation copy: “Added…” / “Updated today's care situation…” — not a restarted template  

Hook: `ingestActiveCareObservation` calls `processProgressiveUnderstanding` after relation is known and the observation is appended.

## Consequences

- ACS ingest no longer owns ad-hoc `stageFor` / `synthesisFor` / `mattersFor` alone — Progressive Understanding is SoT for understanding delta  
- Living Care Record UI projects the engine result; it does not re-derive understanding  
- Verify: `verify:progressive-understanding` + ACS / LCR verifies  

## References

- ADR-019 Living Care Record UX  
- Product North Star / Care Reality Intelligence chain  
