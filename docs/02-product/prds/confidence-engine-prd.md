# PRD — Confidence Engine

**Module paths:** `src/lib/confidence-layer`, `src/lib/solenos-layers/derived/compute-confidence.ts`  
**Implementation status:** **INTERNAL · IMPLEMENTED** (Path B analyze — DERIVED pure function; not caregiver reassurance %)  
**Index:** [module-status.md](../../17-canonical-architecture/module-status.md)

## User problem

Caregivers constantly ask: **“Am I doing enough?”** Guilt and ambiguity harm decision quality. They need calibrated reassurance grounded in structural state — not pep talk or false calm.

## User behavior

- Completes some high-pressure actions; leaves others open
- Experiences fail-safe pauses and fears they “fell behind”
- Needs plain English, not priority jargon

## Success definition

- Score 0–100 always accompanied by non-empty explanation
- Reflects missing critical actions, unresolved HIGH/CRITICAL situations, load, conflicts, crisis probs, burnout
- Fail-safe engaged → score capped; explanation frames clarifying as correct
- **Never replaces Priority Contract** as ranking authority

## Edge cases

| Case | Expected |
|------|----------|
| 3+ completed critical today, none missing | High reassurance template |
| Fail-safe on | Cap ~42; clarify-first message |
| Crisis risks present but no overdue critical | Reassure on overdue; acknowledge later items |
| Heavy load with open work | Guilt-reducing copy; harm-first focus |

## Failure states

- Empty explanation → guarantee failure
- Using confidence to reorder CRITICAL×NOW → **forbidden**
- Inflating score to improve UX metrics → **forbidden**

## UX expectations

- Shown as reassurance adjacent to decision, not as “system confidence %” for medical certainty
- Tone: calm, specific, non-panicked

## Constraints

- Pure DERIVED — no confidence database
- Inputs from STATE/BELIEF/CLI/crisis only

## Design reasoning

Separating “reassurance” from “priority” prevents the classic trap of ranking by how sure the model feels. Alternatives (LLM self-rated confidence, hiding uncertainty) rejected.
