# 08 — Crisis Engine

**Paths:** `src/lib/crisis-prevention-layer`, `derived/compute-crisis-risks.ts`, `family-intelligence/crisis-prediction.ts`  
**Status:** IMPLEMENTED predictive heuristics; facade compounding IN-MEMORY.

## Purpose

Surface **future failure probability** (medical / caregiver / family / financial) with ETA and explanation — predictive, not reactive priority.

## Demand probability

```
P = RiskOverTime×0.55 + (pressure/100)×0.25 + uncertaintyBoost×0.2
```
Medical with pressure&lt;70 and P&lt;0.35 gets +0.15 predictive boost.  
Emit if P ≥ 0.2; keep top 5 by P then ETA.

Time curves: medical→`MEDICATION_DEPENDENT`, financial→`CHRONIC_CARE`, family→`SOCIAL_COORDINATION`.

Category via demand.category or keyword regex (meds, bills, family conflict, etc.).

## Caregiver burnout crisis

When CLI HIGH/CRITICAL:
```
P = burnout×0.5 + (CRITICAL?0.35:0.2) + (loadScore/100)×0.15
```
Emit if P ≥ 0.25; ETA ~12h / 36h band.

## Family conflict crisis

```
P = 0.2 + openConflicts×0.12 + conflictLoadContrib×0.1
```
Emit ≥ 0.22; ETA ~72h.

## Escalation (honest)

| Level | Exists? |
|-------|---------|
| In-product explanation + ranking adjacency | YES |
| Auto notify doctor / 911 / hospital webhook | **NO — FUTURE stub** |
| Human override of false positive | STUB API only |

## Intervention

Crisis layer informs EXPLANATION / UX; Safety Enforcement remains terminal for output constraints. No autonomous clinical intervention.

## Limitations

- Keyword classification brittle
- No durable longitudinal crisis model across restarts
- Not a medical device

## Modify safely

Preserve explanation requirement (guarantee). Threshold changes need PRD + ADR + `verify:crisis-prevention`.
