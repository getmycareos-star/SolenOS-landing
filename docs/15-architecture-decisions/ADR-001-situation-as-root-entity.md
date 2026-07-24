# ADR-001 — Situation as Root Entity

## Decision

All runtime logic hangs off a **Situation** (id, title, status, priority). If something is not a Situation or attached to one, it is not part of runtime logic.

## Alternatives considered

- User-thread / chat session as root
- Patient medical record as root
- Free-floating tasks as root

## Reason selected

Caregiving chaos is situational. Continuity of WHAT (timeline) vs WHY (decision history) requires a stable situational spine (`SITUATION_ROOT_ENTITY`).

## Tradeoffs

- Requires resolution/lifecycle discipline
- Harder to bolt on generic chatbot UX (intentional)

## Future implications

Migrations of UI types must preserve Situation identity. Multi-family tenancy still Situation-centric per care system.
