# 05 — Care Graph

**Status:** IMPLEMENTED logic; IN-MEMORY stores; family-intelligence persistence adapters NOOP.

## Entities

| Entity | Module | Meaning |
|--------|--------|---------|
| Person | responsibility-graph | Actor with role |
| Responsibility | responsibility-graph | Owned accountability unit |
| Demand | demand-engine (STATE) | Actionable demand on a Situation |
| CareProfile | care-profile | Role, relationships, workload intensity, time sensitivity |
| CareGraph edges | family-intelligence | `depends_on \| supports \| owns_responsibility \| absorbs_workload` |

## Relationships

```
Situation (STATE root)
  └── Demands
        └── Ownership eval (assigned|unassigned|shared|blocked)
Person ──owns──▶ Responsibility ──covers──▶ Demand
CareProfile weights module envelopes (not LLM prompt chrome)
Family Intelligence Care Graph bridges responsibility-graph + care-profile
```

## Graph logic

### Load score (responsibility-graph)
```
loadScore = activeResponsibilities + 1.5 × highPressureResponsibilities
overloaded = loadScore ≥ 8
```
`HIGH_PRESSURE_RESPONSIBILITY_THRESHOLD = 70` (pressure on demands).

### Health
- **critical** — high-pressure demand unassigned
- **at_risk** — unassigned or open conflicts
- **healthy** — otherwise

### Care profile weights
| Role | Weight |
|------|--------|
| primary | 1.0 |
| shared | 0.85 |
| secondary | 0.7 |
| observer | 0.3 |

Inference confidence threshold 0.7; repeat signal threshold 2.

## State transitions

See [state-machines.md](./state-machines.md) for caregiver / family / delegation states.

Responsibility statuses: `assigned → accepted → in_progress → completed | failed`.

## Examples

1. Unassigned medication refill demand with pressure ≥70 → graph health critical; crisis medical category may emit; delegation may suggest secondary with lighter load if CLI HIGH.
2. Observer-only household → low weighting; primary still owns.

## Edge cases

- No delegate candidates → empty suggestions
- Process restart → empty graph (gap)
- `care_profile_state` DB column unused

## How to modify safely

- Keep ownership deterministic; no silent auto-reassign
- Update PRD + this doc + verify:responsibility-graph
- Wire durable persistence via ADR before claiming continuity across restarts
