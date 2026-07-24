import {
  MULTI_SITUATION_ELEVATION,
} from "./contract-constants";
import {
  evaluateTimeCurve,
  normalizeTau,
  pressureHoursFromRemaining,
} from "./curves";
import { normalizeThresholds, thresholdZone } from "./thresholds";
import type {
  CurveKParams,
  RiskOverTimeResult,
  TimeCurveType,
  TimeThresholds,
} from "./types";

/**
 * Canonical model:
 *   RiskOverTime(t) = BaseRisk × TimeCurveType(t)
 *
 * `t` is pressure hours (increases as deadline approaches / time-to-harm grows).
 * Prefer hoursUntilDeadline + thresholds; optional explicit pressureHours.
 */
export function computeRiskOverTime(params: {
  baseRisk: number;
  curveType: TimeCurveType;
  hoursUntilDeadline?: number;
  pressureHours?: number;
  thresholds?: Partial<TimeThresholds>;
  curveK?: CurveKParams;
}): RiskOverTimeResult {
  const thresholds = normalizeThresholds(params.thresholds, params.curveType);
  const hours =
    params.hoursUntilDeadline !== undefined && Number.isFinite(params.hoursUntilDeadline)
      ? Math.max(0, params.hoursUntilDeadline)
      : thresholds.safeThresholdTime;

  const pressureHours =
    params.pressureHours !== undefined
      ? Math.max(0, params.pressureHours)
      : pressureHoursFromRemaining(hours, thresholds);

  const tau = normalizeTau(pressureHours, thresholds.safeThresholdTime);
  const curveMultiplier = evaluateTimeCurve(params.curveType, tau, {
    hoursUntilDeadline: hours,
    thresholds,
    curveK: params.curveK,
  });

  const base = Number.isFinite(params.baseRisk) ? Math.max(0, params.baseRisk) : 0;

  return {
    curveType: params.curveType,
    pressureHours,
    tau,
    curveMultiplier,
    riskOverTime: base * curveMultiplier,
    thresholdZone: thresholdZone(hours, thresholds),
    thresholds,
  };
}

/**
 * Map curve-derived risk / zone → TimeUrgency key for Priority Contract.
 * Objective threshold mapping — not LLM judgment.
 */
export function curveZoneToTimeUrgency(
  zone: RiskOverTimeResult["thresholdZone"],
  curveType: TimeCurveType,
): "NOW" | "SOON" | "TODAY" | "LATER" {
  if (zone === "critical") return "NOW";
  if (curveType === "SAFETY_CRITICAL_OVERRIDE" && zone === "warning") return "NOW";
  if (zone === "warning") {
    if (curveType === "ACUTE_MEDICAL" || curveType === "MEDICATION_DEPENDENT") {
      return "SOON";
    }
    return "TODAY";
  }
  if (curveType === "ACUTE_MEDICAL" || curveType === "MEDICATION_DEPENDENT") {
    return "TODAY";
  }
  return "LATER";
}

/**
 * Optional v1.5: two moderate curve risks → elevated combined floor.
 * Soft-link friendly with situation-risk-register overlap (caller supplies risks).
 */
export function elevateMultiSituationRisk(
  curveRisks: readonly number[],
): number | undefined {
  const mods = curveRisks.filter(
    (r) =>
      Number.isFinite(r) &&
      r >= MULTI_SITUATION_ELEVATION.moderateBandMin &&
      r <= MULTI_SITUATION_ELEVATION.moderateBandMax,
  );
  if (mods.length < 2) return undefined;
  const max = Math.max(...curveRisks.filter((r) => Number.isFinite(r)));
  return Math.max(max, MULTI_SITUATION_ELEVATION.elevatedFloor);
}

/**
 * Stub: human delay buffer / time-to-action prediction (optional v1.5).
 * Returns suggested action buffer hours — MVP noop returns 0.
 */
export function estimateHumanDelayBufferHours(_signals?: {
  caregiverLoad?: number;
  interruptionRisk?: string;
}): number {
  return 0;
}
