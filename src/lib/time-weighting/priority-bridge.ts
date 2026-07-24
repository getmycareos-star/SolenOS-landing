/**
 * Bridge: Time Weighting → Priority Contract time path.
 *
 * Replaces linear TimeDecayFactor = 1/(hours+1) with curve-derived urgency
 * so Priority uses RiskOverTime math: BaseRisk × TimeCurveType(t).
 */

import { SAFETY_STEP_MAX } from "./contract-constants";
import { computeRiskOverTime, curveZoneToTimeUrgency } from "./risk-over-time";
import { normalizeThresholds } from "./thresholds";
import type {
  CurveKParams,
  TimeCurveType,
  TimeThresholds,
} from "./types";

/**
 * Linear legacy factor kept for callers without a curve.
 * TimeDecayFactor = 1 / (hoursUntilDeadline + 1)
 */
export function linearTimeDecayFactor(hoursUntilDeadline: number): number {
  const h = !Number.isFinite(hoursUntilDeadline) || hoursUntilDeadline < 0
    ? 0
    : hoursUntilDeadline;
  return 1 / (h + 1);
}

/**
 * Curve-derived TimeDecayFactor for Priority Contract:
 *   TimeUrgency × TimeDecayFactor
 *
 * Maps curve multiplier into a [0, 1] urgency mass that grows non-linearly
 * as pressure increases — never baseRisk + time.
 *
 * At t=0 (fully safe): near 0 for soft curves; step floor for safety override.
 * At critical: approaches 1.
 */
export function computeCurveTimeDecayFactor(params: {
  curveType: TimeCurveType;
  hoursUntilDeadline: number;
  thresholds?: Partial<TimeThresholds>;
  curveK?: CurveKParams;
  /** Base risk 0–1 used only to compute relative shape for explanation; default 1. */
  baseRisk?: number;
}): number {
  const result = computeRiskOverTime({
    baseRisk: params.baseRisk ?? 1,
    curveType: params.curveType,
    hoursUntilDeadline: params.hoursUntilDeadline,
    thresholds: params.thresholds,
    curveK: params.curveK,
  });

  if (params.curveType === "SAFETY_CRITICAL_OVERRIDE") {
    return result.curveMultiplier >= SAFETY_STEP_MAX ? 1 : linearTimeDecayFactor(
      Math.max(params.hoursUntilDeadline, result.thresholds.criticalThresholdTime + 1),
    ) * 0.25;
  }

  // Identity at τ=0: acute/med exp(0)=1, chronic=1, social=1.
  // Convert growth above 1 into urgency mass; also boost when already critical.
  const growth = Math.max(0, result.curveMultiplier - 1);
  // Compress exponential growth into (0,1]: 1 - e^(-growth) saturates toward 1.
  let factor = 1 - Math.exp(-growth);

  if (result.thresholdZone === "critical") {
    factor = Math.max(factor, 0.85);
  } else if (result.thresholdZone === "warning") {
    factor = Math.max(factor, 0.45);
  }

  // Keep a small residual so NOW×factor still registers near deadline even for
  // soft chronic/social early in the window.
  const legacy = linearTimeDecayFactor(params.hoursUntilDeadline);
  if (params.curveType === "CHRONIC_CARE" || params.curveType === "SOCIAL_COORDINATION") {
    // Soft curves: blend so they don't flatten to linear-only, but remain gentler than acute.
    factor = Math.max(factor, legacy * 0.5);
    factor = Math.min(1, factor * 0.85 + legacy * 0.15);
  }

  return Math.max(0, Math.min(1, factor));
}

/**
 * Resolve Priority time path for a situation: urgency key + decay factor.
 * Prefer curve path when curveType is known.
 */
export function resolvePriorityTimeSignals(params: {
  curveType?: TimeCurveType;
  hoursUntilDeadline: number;
  thresholds?: Partial<TimeThresholds>;
  curveK?: CurveKParams;
  /** Fallback TimeUrgency when no curve (horizon mapping already done by caller). */
  fallbackTimeUrgency?: "NOW" | "SOON" | "TODAY" | "LATER";
}): {
  timeUrgency: "NOW" | "SOON" | "TODAY" | "LATER";
  timeDecayFactor: number;
  usedCurve: boolean;
  curveType?: TimeCurveType;
  riskOverTime?: number;
} {
  if (!params.curveType) {
    return {
      timeUrgency: params.fallbackTimeUrgency ?? "LATER",
      timeDecayFactor: linearTimeDecayFactor(params.hoursUntilDeadline),
      usedCurve: false,
    };
  }

  const thresholds = normalizeThresholds(params.thresholds, params.curveType);
  const rot = computeRiskOverTime({
    baseRisk: 1,
    curveType: params.curveType,
    hoursUntilDeadline: params.hoursUntilDeadline,
    thresholds,
    curveK: params.curveK,
  });

  return {
    timeUrgency: curveZoneToTimeUrgency(rot.thresholdZone, params.curveType),
    timeDecayFactor: computeCurveTimeDecayFactor({
      curveType: params.curveType,
      hoursUntilDeadline: params.hoursUntilDeadline,
      thresholds,
      curveK: params.curveK,
    }),
    usedCurve: true,
    curveType: params.curveType,
    riskOverTime: rot.riskOverTime,
  };
}
