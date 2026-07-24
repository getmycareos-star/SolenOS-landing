import {
  CURVE_DEFAULT_THRESHOLDS,
  DEFAULT_THRESHOLDS_HOURS,
} from "./contract-constants";
import type {
  ThresholdZone,
  TimeCurveType,
  TimeThresholds,
} from "./types";

function clampNonNeg(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

/** Canonical default threshold pack (medication-refill style). */
export function defaultThresholds(): TimeThresholds {
  return { ...DEFAULT_THRESHOLDS_HOURS };
}

/** Curve-class default thresholds. */
export function thresholdsForCurve(curveType: TimeCurveType): TimeThresholds {
  return { ...CURVE_DEFAULT_THRESHOLDS[curveType] };
}

/**
 * Merge partial thresholds with curve defaults; enforce ordering
 * safe ≥ warning ≥ critical ≥ 0.
 */
export function normalizeThresholds(
  partial: Partial<TimeThresholds> | undefined,
  curveType?: TimeCurveType,
): TimeThresholds {
  const base = curveType ? thresholdsForCurve(curveType) : defaultThresholds();
  let safe = clampNonNeg(partial?.safeThresholdTime ?? base.safeThresholdTime);
  let warning = clampNonNeg(partial?.warningThresholdTime ?? base.warningThresholdTime);
  let critical = clampNonNeg(partial?.criticalThresholdTime ?? base.criticalThresholdTime);

  if (warning > safe) warning = safe;
  if (critical > warning) critical = warning;

  return {
    safeThresholdTime: safe,
    warningThresholdTime: warning,
    criticalThresholdTime: critical,
  };
}

/**
 * Zone from hours remaining vs thresholds.
 * critical: hours ≤ criticalThreshold
 * warning: hours ≤ warningThreshold
 * safe: otherwise
 */
export function thresholdZone(
  hoursUntilDeadline: number,
  thresholds: TimeThresholds,
): ThresholdZone {
  const hours = clampNonNeg(hoursUntilDeadline);
  if (hours <= thresholds.criticalThresholdTime) return "critical";
  if (hours <= thresholds.warningThresholdTime) return "warning";
  return "safe";
}

export function isPastCritical(
  hoursUntilDeadline: number,
  thresholds: TimeThresholds,
): boolean {
  return thresholdZone(hoursUntilDeadline, thresholds) === "critical";
}

export function isInWarningZone(
  hoursUntilDeadline: number,
  thresholds: TimeThresholds,
): boolean {
  const zone = thresholdZone(hoursUntilDeadline, thresholds);
  return zone === "warning" || zone === "critical";
}

export function isSafeWindow(
  hoursUntilDeadline: number,
  thresholds: TimeThresholds,
): boolean {
  return thresholdZone(hoursUntilDeadline, thresholds) === "safe";
}
