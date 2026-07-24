import {
  HORIZON_HOURS,
  HORIZON_URGENCY_BASE,
  MAX_TIMEZONE_HORIZON_SHIFT_HOURS,
  UNSCHEDULED_TEMPORAL_LABEL,
} from "./contract-constants";
import { applyDecayToUrgency } from "./decay";
import { estimateHoursUntil } from "./extract-signals";
import type {
  SolenOSTimeEngine,
  TemporalClassification,
  TimeHorizonKey,
  TimeInputSignals,
} from "./types";

export type ClassifyHorizonParams = {
  signals: TimeInputSignals;
  engine: SolenOSTimeEngine;
  /** Hours since the event became relevant; 0 for upcoming time refs. */
  relevanceDeltaHours?: number;
  /** Soft shift from timezone/coarse location — classification ONLY. */
  timezoneShiftHours?: number;
  reinforcementFactor?: number;
};

function hoursToHorizon(hours: number): TimeHorizonKey {
  if (hours <= HORIZON_HOURS.NOW_MAX) return "NOW";
  if (hours <= HORIZON_HOURS.TODAY_MAX) return "TODAY";
  if (hours <= HORIZON_HOURS.SOON_MAX) return "SOON";
  return "LATER";
}

/**
 * Map hours into one of four horizons. Timezone/location may shift mapping slightly;
 * they never change urgency scores directly.
 */
export function classifyHorizonFromHours(
  hoursUntil: number,
  timezoneShiftHours: number = 0,
): TimeHorizonKey {
  const shift = Math.max(
    -MAX_TIMEZONE_HORIZON_SHIFT_HOURS,
    Math.min(MAX_TIMEZONE_HORIZON_SHIFT_HOURS, timezoneShiftHours),
  );
  return hoursToHorizon(Math.max(0, hoursUntil + shift));
}

function baseConfidence(signals: TimeInputSignals): number {
  if (signals.explicitTime) return 0.9;
  if (signals.relativeTime) return 0.8;
  if (signals.inferredTime) return 0.55;
  return 0.3;
}

/**
 * Classify time input into horizon or UNSCHEDULED TEMPORAL STATE.
 * Missing time → no urgency assumption, no deadline inference.
 */
export function classifyTemporalInput(params: ClassifyHorizonParams): TemporalClassification {
  const {
    signals,
    engine,
    relevanceDeltaHours = 0,
    timezoneShiftHours = 0,
    reinforcementFactor = 1,
  } = params;

  if (signals.missingTime) {
    return {
      kind: "unscheduled",
      state: {
        label: UNSCHEDULED_TEMPORAL_LABEL,
        urgencyScore: 0,
        decayAdjustedUrgency: 0,
        confidence: 1,
      },
    };
  }

  const hoursUntil = estimateHoursUntil(signals);
  if (hoursUntil === undefined) {
    // Signal present but unparseable — still not a deadline; treat as unscheduled.
    return {
      kind: "unscheduled",
      state: {
        label: UNSCHEDULED_TEMPORAL_LABEL,
        urgencyScore: 0,
        decayAdjustedUrgency: 0,
        confidence: 0.7,
      },
    };
  }

  const horizon = classifyHorizonFromHours(hoursUntil, timezoneShiftHours);
  const urgencyScore = HORIZON_URGENCY_BASE[horizon];
  const decayAdjustedUrgency = applyDecayToUrgency(
    urgencyScore,
    relevanceDeltaHours,
    reinforcementFactor,
    undefined,
    engine.urgencyDecayFunction,
  );

  return {
    kind: "classified",
    classification: {
      originalTimestamp: signals.explicitTime ?? signals.relativeTime ?? signals.inferredTime,
      horizon,
      urgencyScore,
      decayAdjustedUrgency,
      relevanceDeltaHours,
      confidence: baseConfidence(signals),
    },
  };
}

/**
 * When strictTimeHorizonMode is true, enforce a single discrete horizon (no blend).
 * When false, allow blended urgency weights across adjacent horizons.
 */
export function buildHorizonBlend(
  active: TimeHorizonKey,
  urgency: number,
  strictMode: boolean,
): Partial<Record<TimeHorizonKey, number>> | undefined {
  if (strictMode) {
    return undefined;
  }

  const order: TimeHorizonKey[] = ["NOW", "TODAY", "SOON", "LATER"];
  const idx = order.indexOf(active);
  const blend: Partial<Record<TimeHorizonKey, number>> = { [active]: urgency };

  if (idx > 0) {
    blend[order[idx - 1]] = urgency * 0.25;
  }
  if (idx < order.length - 1) {
    blend[order[idx + 1]] = urgency * 0.35;
  }

  return blend;
}
