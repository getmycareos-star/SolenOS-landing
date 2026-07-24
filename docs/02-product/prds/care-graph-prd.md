# PRD — Care Graph

**Module paths:** `src/lib/responsibility-graph`, `src/lib/care-profile`, `src/lib/family-intelligence/care-graph.ts`  
**Implementation status:** **INTERNAL · IMPLEMENTED · IN-MEMORY** (Path B analyze / v1.4 — not caregiver composer path) · Postgres adapters **STUB** · `users.care_profile_state` **SCHEMA-ONLY**  
**Index:** [module-status.md](../../17-canonical-architecture/module-status.md)

## User problem

Caregivers lose track of **who owns what**. Tasks float unassigned; secondary caregivers duplicate effort; primary caregivers absorb everything until burnout. Families need an objective ownership graph, not another shared todo list.

## User behavior

- Describes chaotic multi-person care situations via `/api/analyze`
- Expects clarity on ownership gaps (unassigned high-pressure demands)
- May signup later to keep continuity (graph must not reset — identity continuity contract)

## Success definition

- System maintains Person → Responsibility → Demand ownership
- Load per person computed; overloaded flagged
- Graph health: `healthy | at_risk | critical`
- Family Intelligence Care Graph facade exposes dependence/support edges for strategic continuity
- Never auto-reassigns work without human assent (MVP forbid)

## Edge cases

| Case | Expected |
|------|----------|
| No secondary caregivers | Primary owns; delegation may have no candidate → empty suggest list |
| Shared ownership | `shared` ownership state; coordination load rises |
| Blocked ownership | Surfaces as blocked; eligible for suggest-only delegation |
| Observer role | Low role weight (0.3); not primary decision authority |
| Process restart | **Graph lost** (IN-MEMORY) — honest gap |

## Failure states

- Missing persons → cannot recommend delegates
- Conflicting ownership claims → open conflict / at_risk health
- Stub human override does not fix ownership (does not mutate STATE)

## UX expectations

- Sidebar / adapters may show caregiving roles
- Decision surface mentions unassigned critical work via confidence/crisis/delegation layers
- `caregivingPermissions` UI may still be hardcoded stub — do not invent RBAC UX

## Constraints

- STATE ownership only — not a fourth truth layer
- MVP forbids: auto-reassignment, availability forecasting, backup owner automation
- DB `users.care_profile_state` is **SCHEMA-ONLY** (no full TS reader/writer found)

## Design reasoning

Ownership must be deterministic and inspectable so Priority, Delegation, and Crisis engines share one accountability model. Alternatives (chat memory of “who does what”, LLM assignment) rejected — non-deterministic and unsafe under load.
