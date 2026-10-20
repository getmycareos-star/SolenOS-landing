import {
  LOAD_FORMULA_WEIGHTS,
  LOAD_SCORE_BANDS,
  LOAD_STATE_SURFACE_LIMITS,
} from "./contract-constants";
import type {
  CaregiverLoad,
  CaregiverLoadInputs,
  CaregiverLoadState,
} from "./types";

export function clampLoadScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n * 100) / 100));
}

/**
 * Raw loadScore =
 *   activeDemandCount * 1.5 +
 *   highPressureDemandCount * 4 +
 *   uncertaintyLoad * 0.2 +
 *   conflictLoad * 0.2 +
 *   coordinationLoad * 0.15 +
 *   timePressureLoad * 0.15
 *
 * Then normalize to 0–100.
 */
export function computeRawLoadScore(input: CaregiverLoadInputs): number {
  const w = LOAD_FORMULA_WEIGHTS;
  return (
    input.activeDemandCount * w.activeDemandCount +
    input.highPressureDemandCount * w.highPressureDemandCount +
    clampLoadScore(input.uncertaintyLoad) * w.uncertaintyLoad +
    clampLoadScore(input.conflictLoad) * w.conflictLoad +
    clampLoadScore(input.coordinationLoad) * w.coordinationLoad +
    clampLoadScore(input.timePressureLoad) * w.timePressureLoad +
    (input.prolongedUnresolvedBoost ?? 0)
  );
}

/**
 * Normalize raw score to 0–100.
 * Soft cap: ~8 active + 4 high-pressure + full component loads ≈ upper bound.
 */
export function normalizeLoadScore(raw: number): number {
  // Theoretical soft ceiling for typical max operational load.
  const CEILING = 60;
  return clampLoadScore((raw / CEILING) * 100);
}

export function classifyLoadState(score: number): CaregiverLoadState {
  const s = clampLoadScore(score);
  if (s <= LOAD_SCORE_BANDS.LOW.max) return "LOW";
  if (s <= LOAD_SCORE_BANDS.MODERATE.max) return "MODERATE";
  if (s <= LOAD_SCORE_BANDS.HIGH.max) return "HIGH";
  return "CRITICAL";
}

export function surfaceLimitForState(state: CaregiverLoadState): number {
  return LOAD_STATE_SURFACE_LIMITS[state];
}

export function computeCaregiverLoad(
  input: CaregiverLoadInputs,
  nowIso = new Date().toISOString(),
): CaregiverLoad {
  const raw = computeRawLoadScore(input);
  const score = normalizeLoadScore(raw);
  const state = classifyLoadState(score);
  return {
    score,
    state,
    activeDemandCount: input.activeDemandCount,
    highPressureDemandCount: input.highPressureDemandCount,
    unresolvedSituationCount: input.unresolvedSituationCount ?? 0,
    uncertaintyLoad: clampLoadScore(input.uncertaintyLoad),
    conflictLoad: clampLoadScore(input.conflictLoad),
    coordinationLoad: clampLoadScore(input.coordinationLoad),
    timePressureLoad: clampLoadScore(input.timePressureLoad),
    updatedAt: nowIso,
  };
}
