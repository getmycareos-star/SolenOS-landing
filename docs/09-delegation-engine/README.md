# 09 — Delegation Engine

**Paths:** `src/lib/delegation-layer`, `derived/compute-delegation.ts`, `family-intelligence/delegation-network.ts`  
**Status:** IMPLEMENTED suggest-only; no auto-reassignment.

## Purpose

When caregiver load is **HIGH or CRITICAL**, suggest tasks other people could take — reduce primary overload without becoming a workflow engine.

## Gate

```
if load ∉ {HIGH, CRITICAL} → []
```

## Candidate selection

- Demands `pending|in_progress` with `pressureScore ≥ 45`
- Prefer unassigned OR owned by primary OR blocked
- Sort by pressure ascending (give away manageable first)
- Max 3 suggestions

## Assignee reasoning

1. Lowest non-overloaded `ResponsibilityLoad` person (exclude primary)
2. Else sharedCaregivers / externalCaregivers / first non-primary person

```
loadReductionEstimate = min(25, round(pressure × 0.35))
```

Reason strings explain unassigned vs primary-owned vs blocked.

## Workload balancing

Uses responsibility-graph load scores; does **not** forecast calendar availability (MVP forbidden).

## Family Intelligence Delegation Network

Facade compounds successRate / overload concentration IN-MEMORY (+ noop Postgres). Does not auto-apply assignments.

## Failure / edge cases

| Case | Result |
|------|--------|
| No alternate persons | `[]` |
| All overloaded | fallback names or `[]` |
| Suggestions when load LOW | Guarantee violation if emitted |

## Modify safely

Keep suggest-only until ADR approves auto-assign. Update PRD when gates change. Verify: `verify:delegation-layer`.
