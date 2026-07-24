# ADR-002 — Three-Layer Runtime (+ DERIVED)

## Decision

Persist conceptual truth in **STATE**, **BELIEF**, **EXPLANATION**. Compute risk/priority/load/crisis/confidence/delegation as **DERIVED pure functions** — never independent databases of “priority truth.”

## Alternatives considered

- Single mutable “brain” object
- LLM as sole state
- Separate microservices per score with their own stores

## Reason selected

Separates objective ownership (STATE) from uncertain interpretation (BELIEF) from narrative audit (EXPLANATION). DERIVED purity enables verify scripts and prevents score drift stores.

## Tradeoffs

- More facades during migration (`FACADE_DEPRECATION`)
- Engineers must not “just save CLI to Postgres as authority”

## Future implications

Durable persistence should snapshot STATE/BELIEF/EXPLANATION; recompute DERIVED on read.
