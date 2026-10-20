# ADR-008 — Containment Mode

## Decision

When high-signal stress detects the acute triad (emotional harm + sleep disruption + uncertainty overload), enter **Containment Mode**: maximize emotional stabilization, **max 1 action**, forbid task expansion.

## Alternatives considered

- More structured plans to “get ahead of chaos”
- Ignoring acute language as noise
- Crisis webhook escalation by default

## Reason selected

Acute burnout makes multi-step plans harmful. Behavioral Spec / psych load guarantees encode this.

## Tradeoffs

- May delay non-critical chores
- Detection heuristics can false-positive — still safer than tip dumps

## Future implications

Tune detectors via verify scripts; do not remove containment for engagement metrics.
