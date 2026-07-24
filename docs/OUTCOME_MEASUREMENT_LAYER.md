# SolenOS — Outcome Measurement Layer (OML)

> **If SolenOS cannot measure reduction in caregiver uncertainty and cognitive load, it does not know if it is working.**

OML is NOT analytics, logging, or dashboards. It is a **core feedback system** tied to CareContext evolution.

---

## What OML measures (MVP)

| # | Metric | Definition | Goal |
|---|---|---|---|
| 1 | Cognitive Load Reduction | Mental effort reconstructing reality | Decrease over time |
| 2 | Time-to-Understanding (TTU) | Seconds/interactions to clarity | Decrease |
| 3 | Change Recognition Latency | Event → surfaced as important change | Decrease |
| 4 | Clarification Load | Follow-up questions to resolve uncertainty | Decrease |
| 5 | Timeline Reconstruction Accuracy | Sequence accuracy vs caregiver corrections | Increase |
| 6 | Caregiver Cognitive Load Score (CCL) | Composite load score | Decrease |
| 7 | Decision Support Impact | Decisions influenced by system clarity | Track impact |

---

## System requirement

Every CareContext update MUST emit:

- Updated Outcome Metrics snapshot
- Delta vs previous state
- Trend direction (improving / worsening / stable)

Implementation: `updateCareContextWithOML()`

---

## Engine integration rule

Each engine declares what metric it improves. If an engine cannot map to a measurable outcome, it is not valid in MVP architecture.

Implementation: `ENGINE_METRIC_MAP` in `engine-metric-map.ts`

---

## Caregiver feedback hook

After key outputs, system collects:

- "Was this helpful in understanding what's going on?"
- "Did this reduce confusion?"
- "Is anything missing or incorrect?"

Responses feed: confidence calibration, pattern learning, failure detection, metric adjustment.

Implementation: `processCaregiverFeedback()`

---

## Product truth

You are not building features. You are building **measurable reduction of caregiver uncertainty over time**.

---

## Code map

```
src/lib/oml/
  types.ts                 — OML data model
  compute-metrics.ts       — all 7 core metrics
  engine-metric-map.ts     — engine → metric declarations
  compute-snapshot.ts      — full snapshot + delta + trend
  session-tracking.ts      — TTU session lifecycle
  caregiver-feedback.ts    — feedback hook + calibration
  integrate-context.ts     — CareContext update integration
```
