# 06 — Careload Engine

**Master facade:** `src/lib/caregiver-load-engine`  
**Also:** `caregiver-load-index`, `emotional-load-signal`, `load-interpretation`, `interaction-load-signal`, `caregiver-psychological-load`, `attention-engine`, [`deterministic-prioritization`](./deterministic-prioritization.md)  
**Status:** IMPLEMENTED; persistence mostly session Maps / noop.

## Why it exists

Primary unmet need = **burden reduction**, not more information. Load detection runs **before** Priority and LLM so the system cannot tip-spam an overloaded caregiver.

## Pipeline position

Early: Load Interpretation + High-Signal Stress + Interaction Load + Caregiver Load Engine → Attention Engine → … → CLI surface → ELS → Priority.

## Caregiver Load Index (CLI)

```
raw =
  activeDemandCount × 1.5
+ highPressureDemandCount × 4
+ uncertaintyLoad × 0.2
+ conflictLoad × 0.2
+ coordinationLoad × 0.15
+ timePressureLoad × 0.15
+ prolongedUnresolvedBoost

score = (raw / 60) × 100   // CEILING = 60
```

| Band | Score | Surface limit |
|------|-------|---------------|
| LOW | 0–25 | 4 |
| MODERATE | 26–50 | 3 |
| HIGH | 51–75 | 2 |
| CRITICAL | 76–100 | 1 |

Demand pressure (feeds CLI/crisis/delegation):
```
pressure = urgency×0.35 + riskImpact×0.35 + uncertainty×0.20 + emotionalLoad×0.10
```
Effort excluded. High-pressure threshold **70**.

## Five load dimensions (caregiver-load-engine)

```
cognitive  = repetition×30 + vigilance×28 + supervision×22 + uncertainty×12 + assistance×8
emotional  = emotionalDistress×40 + burnoutLanguage×25 + repetition×15 + uncertainty×10
sleepRisk  = sleep×55 + supervision×20 + burnoutLanguage×15
uncertaintyIndex = uncertainty×0.55 + repetition×0.2 + assistance×0.15 + emotionalDistress×0.1
dependency = supervision×40 + assistance×35 + repetition×10 + sleep×10
```

### Unified burnout
```
P = emotional×0.28 + cognitive×0.22 + sleep×0.24 + uncertainty×0.16 + dependency×0.1
  + burnoutLanguageSignal×0.12
```
Floors: language≥0.35 → elevated floor; emotional≥55 → ≥0.55; acute → ≥0.72.  
Rising / critical ≈ 0.55 / 0.75.

## Interaction load

- Hit ≥0.35; min 2 categories
- BVI = redirect×45 + repetition×25 + alwaysOn×20 + exhaustion×10 (+ bonuses)
- Sleep protection maxActions=2

## Psychological load / containment

Acute triad: emotional harm + sleep disruption + uncertainty overload → **Containment Mode** (max 1 action).  
Moral injury / identity drift: pattern classifiers (high CRITICAL thresholds).

## Emotional Load Signal (ELS)

Stress composite weights: switching 0.22, urgency clustering 0.24, conflicts 0.2, notifications 0.17, interruptions 0.17.  
Burnout composite mixes stress, operational load, bias, depletion, conflicts, switching.  
Fatigue bands LOW≤29 … CRITICAL≥75; `BURNOUT_PROTECTION_THRESHOLD = 0.65`.  
**Recovery minutes = stub** (5/15/45/120).

## Attention Engine

Class A/B/C via regex + urgency; hit 0.4 → Now / Watch / Later.  
Burnout tiers shape behavioral response copy.

## Assumptions & limitations

- Heuristic / regex — not clinical assessment
- IN-MEMORY history; noop `persistCaregiverLoadStores`
- LLM must not classify MVP load signals

## How to modify safely

1. Change weights only with verify scripts (`verify:caregiver-load-engine`, CLI, ELS, interaction, psych, behavioral-spec)
2. Update PRD + this doc + ADR if thresholds shift product meaning
3. Never route load classification through Gemini for MVP
