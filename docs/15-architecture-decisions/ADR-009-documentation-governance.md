# ADR-009 — Documentation Governance

## Decision

Documentation is a **first-class system asset**. Feature complete only when code works, tests/verifies pass, docs updated, canonical architecture updated, and PRDs updated if affected. **If code and docs conflict, documentation is source of truth.**

## Alternatives considered

- Code-as-only-truth with optional README
- Auto-generate docs solely from TSDoc
- Marketing-site docs separate from eng

## Reason selected

SolenOS must survive total team loss. Continuity intelligence for the **product** requires continuity intelligence for the **codebase**. Cursor rule encodes Completion Rule for agents.

## Tradeoffs

- Slower apparent velocity
- Docs can lag unless enforced in review — mitigated by alwaysApply rule

## Future implications

Agents and humans must update `/docs` numbered tree + `architecture-map.ts` together. Legacy flat `docs/*.md` migrate gradually via cross-links.
