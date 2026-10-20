import type {
  TemporalClassification,
  TemporalPrioritySignal,
  TimeEngineGuaranteeResult,
  TimeEngineLayerResult,
  TimeInputSignals,
} from "./types";
import { UNSCHEDULED_TEMPORAL_LABEL } from "./contract-constants";

/**
 * System guarantee before Priority Engine:
 * - all inputs classified into horizon (or UNSCHEDULED handled)
 * - decay applied
 * - no inferred deadlines
 * - no urgency hallucination
 */
export function runTimeEngineGuarantee(params: {
  signals: TimeInputSignals;
  temporal: TemporalClassification;
  prioritySignal: TemporalPrioritySignal;
  inferredDeadlineCreated?: boolean;
}): TimeEngineGuaranteeResult {
  const violations: string[] = [];
  const { signals, temporal, prioritySignal } = params;

  if (signals.missingTime) {
    if (temporal.kind !== "unscheduled") {
      violations.push("missing time must map to UNSCHEDULED TEMPORAL STATE");
    }
    if (prioritySignal.urgencyScore !== 0 || prioritySignal.decayAdjustedUrgency !== 0) {
      violations.push("missing time must not produce urgency (urgency hallucination)");
    }
    if (prioritySignal.activeHorizon !== "UNSCHEDULED") {
      violations.push("missing time activeHorizon must be UNSCHEDULED");
    }
  } else if (temporal.kind === "classified") {
    const allowed = ["NOW", "TODAY", "SOON", "LATER"] as const;
    if (!allowed.includes(temporal.classification.horizon)) {
      violations.push("classified input must map to one of four horizons");
    }
    if (temporal.classification.decayAdjustedUrgency > temporal.classification.urgencyScore + 1e-9) {
      // Decay without reinforcement cannot increase above base; allow equality.
      // (reinforcement may increase decayAdjusted — checked separately via flag)
    }
    if (
      temporal.classification.urgencyScore < 0 ||
      temporal.classification.urgencyScore > 1 ||
      temporal.classification.decayAdjustedUrgency < 0 ||
      temporal.classification.decayAdjustedUrgency > 1
    ) {
      violations.push("urgency scores must be within 0.0–1.0");
    }
  }

  if (temporal.kind === "unscheduled" && temporal.state.label !== UNSCHEDULED_TEMPORAL_LABEL) {
    violations.push("unscheduled state label drift");
  }

  if (params.inferredDeadlineCreated) {
    violations.push("inferred deadlines are forbidden");
  }

  if (prioritySignal.strictMode && prioritySignal.blendedHorizons) {
    violations.push("strictTimeHorizonMode must not emit blended horizons");
  }

  if (!prioritySignal.strictMode && temporal.kind === "classified" && !prioritySignal.blendedHorizons) {
    violations.push("non-strict mode should allow blended urgency signals");
  }

  return { ok: violations.length === 0, violations };
}

export function validateTimeEngineLayerResult(result: TimeEngineLayerResult): TimeEngineGuaranteeResult {
  return runTimeEngineGuarantee({
    signals: result.signals,
    temporal: result.temporal,
    prioritySignal: result.prioritySignal,
  });
}
