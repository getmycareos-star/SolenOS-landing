# ADR-003 — Priority Contract Is Deterministic (Not LLM)

## Decision

Situation ranking uses **Priority Contract** formulas (risk×severity, time curves, uncertainty, dependency, completion). CRITICAL×NOW always tops. LLM produces clarity JSON; it does not replace ranking.

## Alternatives considered

- Ask the LLM what matters most
- Rank by user preference / emotion alone
- Rank by caregiver tip relevance

## Reason selected

Safety and continuity require inspectable, testable ranking under stress. LLM preference is unstable and unverifiable.

## Tradeoffs

- Formula maintenance burden
- Less “fluent” personalization until care profile weights mature

## Future implications

Any LLM re-ranking feature needs explicit ADR revocation of this decision — strongly discouraged.
