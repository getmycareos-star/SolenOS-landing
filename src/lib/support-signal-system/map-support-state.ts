import {
  REENTRY_INACTIVITY_DAYS_THRESHOLD,
  STABILIZATION_SUSTAINED_PRESSURE_DAYS,
} from "./contract-constants";
import type { SupportSignal, SupportState } from "./types";

/**
 * Map observational signals → SupportState for notification selection ONLY.
 * Does NOT alter product behavior, UI modes, or lifecycle routing.
 */
export function mapSupportState(signal: SupportSignal): SupportState {
  if (signal.recent_high_risk_event) {
    return "crisis";
  }

  if (signal.caregiver_depletion_state === "critical") {
    return "overload";
  }

  if (signal.inactivity_days >= REENTRY_INACTIVITY_DAYS_THRESHOLD) {
    return "reentry";
  }

  if (
    signal.caregiver_depletion_state === "elevated" &&
    (signal.care_context_state === "active_care" || signal.care_context_state === "crisis")
  ) {
    return "fatigue";
  }

  if (
    signal.caregiver_depletion_state === "normal" &&
    signal.care_context_state !== "uncertain"
  ) {
    return "stable";
  }

  // Unclear observational picture — default stable bucket for selection,
  // but delivery rules will suppress unless stabilization criteria met.
  return "stable";
}

export function isStabilizationCandidate(
  signal: SupportSignal,
  sustained_pressure_days: number = 0,
): boolean {
  return (
    signal.caregiver_depletion_state === "normal" &&
    signal.care_context_state !== "uncertain" &&
    !signal.recent_high_risk_event &&
    sustained_pressure_days >= STABILIZATION_SUSTAINED_PRESSURE_DAYS
  );
}

export function isReentryCandidate(signal: SupportSignal): boolean {
  return signal.inactivity_days >= REENTRY_INACTIVITY_DAYS_THRESHOLD;
}

export function hasCriticalOverload(signal: SupportSignal): boolean {
  return signal.caregiver_depletion_state === "critical";
}

export function hasCrisisSignal(signal: SupportSignal): boolean {
  return signal.recent_high_risk_event;
}

export function hasFatigueSignal(signal: SupportSignal): boolean {
  return (
    signal.caregiver_depletion_state === "elevated" &&
    (signal.care_context_state === "active_care" || signal.care_context_state === "crisis")
  );
}
