# PRD — Crisis Engine

**Module paths:** `src/lib/crisis-prevention-layer`, `src/lib/solenos-layers/derived/compute-crisis-risks.ts`, family-intelligence `crisis-prediction.ts`  
**Implementation status:** **INTERNAL · IMPLEMENTED** (Path B analyze — predictive heuristics; not medical alarm) · FI facade **IN-MEMORY**  
**Index:** [module-status.md](../../17-canonical-architecture/module-status.md)

## User problem

Failures (med gaps, burnout, family rupture, financial coverage breaks) often become obvious only after harm. Caregivers need **early structural signals** with explanations — without panic amplification.

## User behavior

- Juggles medical, family, financial, and personal capacity demands
- May ignore low-priority items that become critical on nonlinear time curves
- Needs ETA language that is sober, not alarming spam

## Success definition

- Emits crisis risks with category `medical | caregiver | family | financial`
- Each risk has probability, ETA hours, contributing factors, explanation
- Predictive boost for medium-pressure medical before urgency peaks
- Caregiver burnout crisis when CLI HIGH/CRITICAL
- Top risks bounded (e.g. top 5); explanation required (guarantee)

## Edge cases

| Case | Expected |
|------|----------|
| Completed/cancelled demands | Not emitted |
| Unclassified demand text | No category → skip |
| Open family conflicts | Family crisis probability from conflict load |
| False positive risk | Still explainable; Safety/Fail-Safe govern actions; no auto-call emergency services |

## Failure states

| Failure | Safe behavior |
|---------|----------------|
| Missed crisis | Safety + Priority still handle CRITICAL×NOW; document as known heuristic limit |
| Over-warning | Tone + thresholds (≥0.2 emit) + ranking caps; no panic copy |
| Treating crisis layer as authority over safety | Forbidden — Safety terminal |

## UX expectations

- Predictive (“could become critical within…”) not diagnostic
- Never imply SolenOS contacted doctors / 911
- Family Intelligence facade may compound signals IN-MEMORY

## Constraints

- DERIVED pure — no crisis DB of record
- Not clinical decision support
- External escalation integrations = FUTURE stubs (`11-api-reference/integrations/`)

## Design reasoning

Risk-over-time curves + pressure + uncertainty beat reactive “only show HIGH priority” lists. Alternatives (LLM prognosis, disease timeline from observation counts) explicitly rejected in anti-patterns.
