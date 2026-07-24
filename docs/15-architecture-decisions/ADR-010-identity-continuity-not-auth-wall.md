# ADR-010 — Identity Continuity, Not Auth Wall

## Decision

Never block first inference on authentication. Login restores care state; signup upgrades ephemeral→persistent without resetting graph. Credential storage may mature later without changing this continuity principle.

## Alternatives considered

- Mandatory account before analyze
- OAuth-only gate
- Stateless analyze with zero continuity

## Reason selected

Overwhelmed caregivers abandon signup walls. Continuity of care graph is the product; auth is a binding mechanism.

## Tradeoffs

- Weak session security in MVP (in-memory stub)
- Harder multi-device continuity until durable store exists

## Future implications

Production auth must preserve “no graph reset” and rehydration semantics; replace hash/storage without changing API meaning.
