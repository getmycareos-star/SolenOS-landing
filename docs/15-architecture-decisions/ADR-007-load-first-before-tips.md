# ADR-007 — Load-First Before Care Tips

## Decision

Detect and respond to caregiver load **before** tip-style guidance. Under load-first / high-signal stress / containment, shrink actions; do not lead with dementia tips.

## Alternatives considered

- Always-on tips library
- ChatGPT-style ten recommendations
- Medical severity as primary UX

## Reason selected

Primary unmet need is burden reduction. Tips amplify cognitive load when overloaded (`caregiver-load-engine` north star).

## Tradeoffs

- Feels “less helpful” to tip-seeking users in the moment — correct under overload
- Requires strong copy so silence/containment feels supportive

## Future implications

Tip content, if any, remains gated by load state and product boundary verify scripts.
