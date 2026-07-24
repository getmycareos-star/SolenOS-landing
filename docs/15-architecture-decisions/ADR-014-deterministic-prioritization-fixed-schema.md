# ADR-014 — Deterministic scoring + fixed schema compression

## Decision

SolenOS ranks **extracted issues** with a fixed, inspectable formula and compresses the ranked list into the **exactly six-field Decision Snapshot**. Public output never exposes internal buckets (`DO_FIRST` / `SAFE_TO_DELAY` / `WATCH_CLOSELY`). LLM may assist score *inputs* later; formula and sort order are non-negotiable.

```
priorityScore = safety*3 + time*2 + cost*2 + reversibility*1 + relief*1
```

Each dimension ∈ {0,1,2,3}. Human-impact pain/safety/harm sets `prioritySignal = HIGH_IMPACT` (sort privilege, not a UI bucket). Final sort: HIGH_IMPACT first, then `priorityScore` descending.

## Alternatives considered

- Let the LLM choose “what matters now” in free text
- Expose three-column DO FIRST / SAFE TO DELAY / WATCH CLOSELY UI
- Fold issue ranking into Priority Contract situation scoring only

## Reason selected

Caregivers need cognitive compression with transparent *why*, not another task board or chatbot. Deterministic ranking is verifiable under stress and aligns with ADR-003 (Priority Contract is also non-LLM for situations).

## Relationship to Priority Contract (ADR-003)

| Module | Ranks | Output |
|--------|-------|--------|
| Priority Contract / priority-engine | Situations / action vectors | DERIVED priority for action selection |
| Deterministic Prioritization (this ADR) | Issues from unstructured input | 6-field Decision Snapshot compression |

Both coexist. Deterministic Prioritization overlays `case_memory_layer.decision_snapshot` when its guarantee passes; Priority Contract continues to rank Situations.

## Tradeoffs

- Heuristic dimension assignment can mis-score unfamiliar phrasing (mitigate with verify + later LLM-assisted inputs)
- SolenOS HTTP display schema remains 5-field until FUTURE unification; Decision Snapshot / `deterministic_priority_layer.decision_snapshot` is the 6-field product contract

## Future implications

Unifying public SolenOS response to six fields requires a dedicated PRD + verify matrix change. Internal bucket labels must never become public JSON keys or UI column titles for RESULT surfaces.
