# PRD — Delegation Engine

**Module paths:** `delegation-layer`, `derived/compute-delegation.ts`  
**Implementation status:** **INTERNAL · IMPLEMENTED** (Path B analyze — suggest-only; auto-reassign **FUTURE** forbidden MVP)  
**Index:** [module-status.md](../../17-canonical-architecture/module-status.md)

## User problem

Primary caregivers absorb every demand until collapse. Others could help but lack clear, low-friction asks grounded in real load.

## Success definition

- Suggestions only when CLI HIGH/CRITICAL
- Max 3; prefer lightest non-overloaded person
- Never auto-reassigns ownership
- Each suggestion has task, person, reason, optional loadReductionEstimate

## Constraints / design reasoning

See ADR-011. Auto-assign rejected to protect Care Graph trust.
