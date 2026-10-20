# System Learning + Metrics Loop

**Status:** PARTIAL — telemetry + feedback collection exist; closed-loop model retraining does **not**.

## Intelligence flywheel (intended)

```
Care events → structured STATE/BELIEF
  → decisions + explanations (EXPLANATION)
  → load / crisis / confidence / delegation signals (DERIVED)
  → user feedback / relief signals
  → better weighting envelopes + pattern memory (Family Intelligence)
```

Today the flywheel compounds mostly **in-process** (Maps) and in optional Postgres **telemetry evidence**, not trained model weights.

## Data that improves predictions (today)

| Signal | Source | Used for learning? |
|--------|--------|-------------------|
| Interaction input/output | `interactions` table / memory store | Evidence ledger; not model training |
| Relief / helpful flags | `/api/feedback`, interaction columns | Stored; **must not** influence analyze ranking (contract) |
| Support signal delivery/suppress | `support_signal_events` | Telemetry of delivery policy |
| Care context / depletion flags | interaction columns | Observational labels |
| Observation patterns | observation-intelligence store | Pattern tracking per caregiver (IN-MEMORY) |
| Decision history WHY | explanation layer | Continuity; not offline RL |
| Family intelligence facades | memory / graph / crisis stores | Compound in-memory snapshots |

## Feedback collection

- `POST /api/feedback` — `helpful_yes_no`, `reduced_confusion_yes_no` keyed by `interaction_id`
- Contract: feedback is for **relief validation / measurement**, not prompt injection into Priority Contract

## Ignored / must-not-learn-from signals

- LLM free text as medical ground truth
- Observation frequency as disease progression
- Panic language amplification into higher crisis probability without structural factors
- Request-supplied `governance_settings` as permanent preference without persistence review

## Model improvement cycle (honest)

| Stage | Status |
|-------|--------|
| Heuristic threshold tuning via verify scripts | IMPLEMENTED (engineering) |
| Deterministic formula changes gated by ADR + docs | PROCESS (governance) |
| Online LLM fine-tuning from feedback | **NOT BUILT** |
| Offline supervised learning on crisis outcomes | **NOT BUILT** |
| Family Memory compounding across restarts | **STUB persistence** (noop Postgres adapters) |

## Product KPI anchors

- Caregiver load reduction / continuity (north star)
- Observation Intelligence: `observations_per_caregiver_per_week`
- Feature rule: improves ≥1 of Family Memory, Care Graph, Decision History, Delegation Network, Crisis Prediction, User Trust, Confidence Engine

## Safe evolution rule

Improve intelligence by **tightening contracts and DERIVED pure functions** first. Do not silently train on caregiver free text for diagnosis. Any learning that mutates behavior needs ADR + PRD + verify coverage.
