import type { TimeOfDay } from "./contract-constants";
import type { SupportSignal, SupportState } from "./types";
import {
  hasCrisisSignal,
  hasCriticalOverload,
  hasFatigueSignal,
  isReentryCandidate,
  isStabilizationCandidate,
} from "./map-support-state";

export type DeliveryEligibility = {
  eligible: boolean;
  reason: string;
};

/**
 * Per-spec delivery rules:
 * - Crisis: recent high-risk event
 * - Overload: critical depletion signal
 * - Re-entry: user returns after prolonged absence
 * - Stabilization (stable): rare periodic after sustained pressure
 * - Fatigue: elevated depletion during active care
 *
 * Default: not eligible (silence preferred).
 */
export function assessDeliveryEligibility(
  signal: SupportSignal,
  supportState: SupportState,
  sustained_pressure_days: number = 0,
): DeliveryEligibility {
  if (hasCrisisSignal(signal)) {
    return { eligible: true, reason: "crisis: recent high-risk event" };
  }

  if (supportState === "overload" && hasCriticalOverload(signal)) {
    return { eligible: true, reason: "overload: critical depletion signal" };
  }

  if (supportState === "reentry" && isReentryCandidate(signal)) {
    return { eligible: true, reason: "re-entry: prolonged absence return" };
  }

  if (supportState === "fatigue" && hasFatigueSignal(signal)) {
    return { eligible: true, reason: "fatigue: sustained care pressure with elevated depletion" };
  }

  if (
    supportState === "stable" &&
    isStabilizationCandidate(signal, sustained_pressure_days)
  ) {
    return {
      eligible: true,
      reason: "stabilization: rare periodic after sustained pressure",
    };
  }

  if (signal.care_context_state === "uncertain") {
    return { eligible: false, reason: "unclear value: care context uncertain" };
  }

  return { eligible: false, reason: "default silence: no delivery rule matched" };
}

/**
 * Time-of-day gating:
 * - late_night: validation/decompression (allowed)
 * - morning: orientation (allowed)
 * - avoid during high activity unless crisis
 */
export function isTimeOfDayPermitted(
  timeOfDay: TimeOfDay,
  supportState: SupportState,
): DeliveryEligibility {
  if (supportState === "crisis") {
    return { eligible: true, reason: "crisis overrides time-of-day restrictions" };
  }

  if (timeOfDay === "late_night") {
    return { eligible: true, reason: "late_night: validation/decompression window" };
  }

  if (timeOfDay === "morning") {
    return { eligible: true, reason: "morning: orientation window" };
  }

  if (timeOfDay === "night") {
    return { eligible: true, reason: "night: low-activity decompression window" };
  }

  // afternoon — avoid during likely high activity unless crisis (handled above)
  return {
    eligible: false,
    reason: "time-of-day: avoid during high activity unless crisis",
  };
}

export function combineDeliveryChecks(
  ...checks: readonly DeliveryEligibility[]
): DeliveryEligibility {
  for (const check of checks) {
    if (!check.eligible) return check;
  }
  return { eligible: true, reason: checks.map((c) => c.reason).join("; ") };
}
