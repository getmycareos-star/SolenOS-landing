# Phase 5 — Compounding learning loop (~93–95)

**Status:** **IN PROGRESS** (Slices 5.1–5.6 implemented) · Slice 2.4 **IMPLEMENTED**  
**Goal:** Every input improves **next** understanding via durable state — not model retraining.  
**Authority:** [`spine-build-sequence.md`](./spine-build-sequence.md) · [`golden-scenario-map.md`](./golden-scenario-map.md) · [`scope-lock.md`](./scope-lock.md)

---

## Entry gate (must pass before Slice 5.1)

| Prerequisite | Status |
|--------------|--------|
| Phase 1 slices 1.1–1.4 | **IMPLEMENTED** |
| Phase 2 slices 2.1–2.3 | **IMPLEMENTED** |
| Phase 2 slice 2.4 (memory correction wire) | **IMPLEMENTED** — `verify:memory-correction` |
| Phase 3 golden map | **IMPLEMENTED** — [`golden-scenario-map.md`](./golden-scenario-map.md) |
| Phase 4 scope lock | **IMPLEMENTED** — `verify:phase4-scope-lock` |

```bash
npm run verify:phase5-entry-gate
```

**Rule:** Entry gate must stay green (`verify:phase5-entry-gate` includes Slice 2.4).

---

## What “compounding learning” means here

| Is | Is not |
|----|--------|
| CRS + ACS + Decision Memory persist; turn N+1 reads turn N belief | LLM fine-tuning or prompt-only “memory” |
| Uncertainties close when answered (`answers_uncertainty`) | Re-asking the same gap every turn |
| Conservative feedback → load/disclosure only | Engagement hacks / empathy training |
| Epistemic depth from held thread context | Keyword scenario templates |

**Success question (Phase 5):** Does turn N+1 clearly use memory from turn N — not restart?

---

## Slices

### 5.1 — CRS → composer as SoT (reasoning depth) — **IMPLEMENTED**

| | |
|--|--|
| **Problem** | Composer sometimes re-derives from latest message; CRS bypassed. |
| **Change** | `resolveCrsComposeContext` — CRS fields first; latest message is delta only. |
| **Modules** | `caregiver-response-composer/crs-compose-sot.ts`, `care-reality-state` |
| **Verify** | `verify:crs-composer-sot`, `verify:return-continuity` (G10–G11) |

### 5.2 — Uncertainty lifecycle — **IMPLEMENTED**

| | |
|--|--|
| **Change** | `uncertainty-lifecycle.ts` — reconcile open→resolved; CRS sync; session compose filter; G10 soft invite |
| **Verify** | `verify:open-uncertainties-return` |

### 5.3 — Feedback → behavior — **IMPLEMENTED**

| | |
|--|--|
| **Change** | `feedback-containment.ts` — confusion → one-turn hold Clarity + zero asks; helpful → no change |
| **Verify** | `verify:feedback-containment` |

### 5.4 — Epistemics depth — **IMPLEMENTED**

| | |
|--|--|
| **Change** | Thread continuity for thin notes (`isThinCareThreadContinuation`); `classifyCaregiverTurn` ↔ `isCareRealityAnchorText` alignment; multi-contributor conflict keeps both. |
| **Verify** | `verify:golden-dementia-baseline` |

### 5.5 — G61 runtime gate — **IMPLEMENTED**

| | |
|--|--|
| **Change** | `applyRealCaregiverTestComposeGate` after acceptance; ADR-025 amended (dev throw / prod log). |
| **Verify** | `verify:golden-dementia-baseline` |

### 5.6 — Retention instrumentation — **IMPLEMENTED**

| | |
|--|--|
| **Change** | `retention-instrumentation.ts` — four research proxies + `aggregateWeeklyRetentionCohortMetrics`; feedback attach; no survey wall. Micro-prompt = FUTURE. |
| **Verify** | `verify:mvp-research-validation` (includes months-of-use reconstruct fixture) |

---

## Phase 5 verify bundle (when slices land)

```bash
npm run verify:phase5-entry-gate
npm run verify:crs-composer-sot          # 5.1
npm run verify:open-uncertainties-return # 5.2
npm run verify:feedback-containment      # 5.3
npm run verify:telemetry-persistence     # 5.3 feedback schema + relief storage
npm run verify:golden-dementia-baseline  # 5.4 thin thread + conflict
npm run verify:mvp-research-validation   # 5.6 retention cohort + months-of-use
npm run verify:return-continuity         # G10–G11
npm run verify:continuity-core-tier1
npm run verify:caregiver-response-composer
npm run verify:phase4-scope-lock         # regression guard
```

---

## Exit criteria (~93–95)

Months-of-use fixture test: reconstruct evolution + decisions + uncertainty across turns. Golden + dementia-critical set green with composer reading CRS SoT.

**Machine twin:** `PHASE_5_COMPOUNDING_LOOP` in `src/lib/solenos-layers/architecture-map.ts`
