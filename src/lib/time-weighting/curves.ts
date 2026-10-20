import {
  CURVE_K_DEFAULTS,
  CURVE_K_RANGES,
  SAFETY_STEP_FLOOR,
  SAFETY_STEP_MAX,
} from "./contract-constants";
import type { CurveKParams, TimeCurveType, TimeThresholds } from "./types";

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function clampNonNeg(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

/**
 * Normalize k into published ranges for exponential curves.
 */
export function resolveCurveK(
  curveType: TimeCurveType,
  params?: CurveKParams,
): number {
  if (curveType === "ACUTE_MEDICAL") {
    const k = params?.acuteK ?? CURVE_K_DEFAULTS.ACUTE_MEDICAL;
    return clamp(k, CURVE_K_RANGES.ACUTE_MEDICAL.min, CURVE_K_RANGES.ACUTE_MEDICAL.max);
  }
  if (curveType === "MEDICATION_DEPENDENT") {
    const k = params?.medicationK ?? CURVE_K_DEFAULTS.MEDICATION_DEPENDENT;
    return clamp(
      k,
      CURVE_K_RANGES.MEDICATION_DEPENDENT.min,
      CURVE_K_RANGES.MEDICATION_DEPENDENT.max,
    );
  }
  return 0;
}

/**
 * Pressure hours from remaining deadline: 0 at/above safe threshold,
 * grows as hours remaining shrink toward (and past) critical.
 *
 * pressure = max(0, safeThreshold − hoursRemaining)
 */
export function pressureHoursFromRemaining(
  hoursUntilDeadline: number,
  thresholds: TimeThresholds,
): number {
  const remaining = clampNonNeg(hoursUntilDeadline);
  const safe = Math.max(thresholds.safeThresholdTime, 1e-6);
  return Math.max(0, safe - remaining);
}

/**
 * τ ∈ [0, ∞) — scale-free pressure relative to safe window.
 */
export function normalizeTau(pressureHours: number, safeThresholdTime: number): number {
  const safe = Math.max(safeThresholdTime, 1e-6);
  return clampNonNeg(pressureHours) / safe;
}

/**
 * ACUTE MEDICAL — risk = e^(k × τ). Explodes quickly (discharge, surgery, post-op).
 */
export function acuteMedicalCurve(tau: number, k?: number): number {
  const kk = clamp(
    k ?? CURVE_K_DEFAULTS.ACUTE_MEDICAL,
    CURVE_K_RANGES.ACUTE_MEDICAL.min,
    CURVE_K_RANGES.ACUTE_MEDICAL.max,
  );
  return Math.exp(kk * clampNonNeg(tau));
}

/**
 * MEDICATION-DEPENDENT — risk = e^(k × τ) with higher k (insulin, anticoagulants, epilepsy).
 */
export function medicationDependentCurve(tau: number, k?: number): number {
  const kk = clamp(
    k ?? CURVE_K_DEFAULTS.MEDICATION_DEPENDENT,
    CURVE_K_RANGES.MEDICATION_DEPENDENT.min,
    CURVE_K_RANGES.MEDICATION_DEPENDENT.max,
  );
  return Math.exp(kk * clampNonNeg(tau));
}

/**
 * CHRONIC CARE — risk = linear(τ) = 1 + τ (physio, home mods).
 */
export function chronicCareCurve(tau: number): number {
  return 1 + clampNonNeg(tau);
}

/**
 * SOCIAL / CARE COORDINATION — risk = log(1 + τ) mapped to ≥1 for multiplier use,
 * base form is log(1+t); return 1 + log(1+τ) so t=0 → 1 (identity on BaseRisk).
 */
export function socialCoordinationCurve(tau: number): number {
  return 1 + Math.log(1 + clampNonNeg(tau));
}

/**
 * SAFETY CRITICAL OVERRIDE — step: stable floor until critical pressure,
 * then jumps to MAX (missed seizure med, discharge without readiness).
 *
 * Uses absolute hoursRemaining vs criticalThresholdTime when provided via
 * `hoursUntilDeadline`; otherwise steps when τ ≥ critical/safe ratio.
 */
export function safetyCriticalStepCurve(params: {
  hoursUntilDeadline: number;
  thresholds: TimeThresholds;
}): number {
  const remaining = clampNonNeg(params.hoursUntilDeadline);
  if (remaining <= params.thresholds.criticalThresholdTime) {
    return SAFETY_STEP_MAX;
  }
  return SAFETY_STEP_FLOOR;
}

/**
 * Evaluate TimeCurveType(t) given normalized τ (and remaining hours for step).
 * Returns the raw curve multiplier (not yet × BaseRisk).
 */
export function evaluateTimeCurve(
  curveType: TimeCurveType,
  tau: number,
  options?: {
    hoursUntilDeadline?: number;
    thresholds?: TimeThresholds;
    curveK?: CurveKParams;
  },
): number {
  switch (curveType) {
    case "ACUTE_MEDICAL":
      return acuteMedicalCurve(tau, resolveCurveK(curveType, options?.curveK));
    case "MEDICATION_DEPENDENT":
      return medicationDependentCurve(tau, resolveCurveK(curveType, options?.curveK));
    case "CHRONIC_CARE":
      return chronicCareCurve(tau);
    case "SOCIAL_COORDINATION":
      return socialCoordinationCurve(tau);
    case "SAFETY_CRITICAL_OVERRIDE": {
      if (options?.thresholds && options.hoursUntilDeadline !== undefined) {
        return safetyCriticalStepCurve({
          hoursUntilDeadline: options.hoursUntilDeadline,
          thresholds: options.thresholds,
        });
      }
      // Fallback: step when τ ≥ 1 (at/past safe window fully consumed).
      return tau >= 1 ? SAFETY_STEP_MAX : SAFETY_STEP_FLOOR;
    }
    default:
      return chronicCareCurve(tau);
  }
}
