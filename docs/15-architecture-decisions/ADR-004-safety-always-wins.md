# ADR-004 — Safety Always Wins

## Decision

**Safety Enforcement** is the terminal gate after Fail-Safe, Crisis, Confidence, Delegation, and Human Trust. Safety overrides everything (`V14_PRINCIPLES`, pipeline notes).

## Alternatives considered

- Soft safety suggestions only
- Safety as prompt preamble without code gate
- Allowing trust layer to bypass safety for empathy

## Reason selected

Output harm is unacceptable even when explainability or load messaging conflicts.

## Tradeoffs

- May block some helpful-sounding content
- Requires careful distinction: filter output, don’t erase risk memory

## Future implications

Reorder pipeline only with verify coverage proving Safety remains terminal.
