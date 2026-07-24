# ADR-011 — Delegation Is Suggest-Only

## Decision

Delegation layer emits suggestions when CLI is HIGH/CRITICAL. MVP forbids auto-reassignment and availability forecasting.

## Alternatives considered

- Auto-assign to least-loaded person
- Calendar-aware scheduling
- Full task management product

## Reason selected

Wrong automatic assignment destroys trust and creates new conflict. Suggest-only preserves Care Graph human authority.

## Tradeoffs

- Less “automation theater”
- Load relief depends on human follow-through

## Future implications

Accepted-delegation applying ownership requires ADR superseding this + durable graph + notifications.
