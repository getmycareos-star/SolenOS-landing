import type { CareProfile } from "../care-profile/types";
import type { MemoryInfluenceEnvelope, MemoryInfluenceState } from "../memory-influence/types";
import type {
  MemoryTimeOverride,
  TemporalClassification,
  TimeConflictFlag,
  TimeHorizonKey,
  TimeInputSignals,
} from "./types";

const DEPENDENCY_PATTERN_KEYS = [
  "medication_missed_recurring",
  "appointment_scheduling_recurring",
  "ongoing_medication_task",
  "pending_follow_up",
];

/**
 * Memory may suggest an alternate horizon ONLY via repeated patterns,
 * historical dependency urgency, or behavior patterns.
 * Primary Time Engine classification always remains visible.
 */
export function resolveMemoryTimeOverride(params: {
  temporal: TemporalClassification;
  memoryState?: MemoryInfluenceState;
  memoryEnvelope?: MemoryInfluenceEnvelope;
}): MemoryTimeOverride | undefined {
  const { temporal, memoryState, memoryEnvelope } = params;
  if (!memoryState || !memoryEnvelope) return undefined;

  const visibleClassification: TimeHorizonKey | "UNSCHEDULED" =
    temporal.kind === "unscheduled" ? "UNSCHEDULED" : temporal.classification.horizon;

  const patternEntries = memoryState.memory.longTermPatternMemory.entries.filter(
    (e) => !e.tags.outdated && !e.tags.incorrect && e.occurrenceCount >= 3,
  );
  const operationalEntries = memoryState.memory.operationalMemory.entries.filter(
    (e) =>
      !e.tags.outdated &&
      !e.tags.incorrect &&
      DEPENDENCY_PATTERN_KEYS.some((k) => e.key.includes(k) || e.influenceLabel.includes(k.replace(/_/g, " "))),
  );

  if (patternEntries.length === 0 && operationalEntries.length === 0) {
    return undefined;
  }

  if (memoryEnvelope.patternBias < 0.15 && memoryEnvelope.operationalBias < 0.15) {
    return undefined;
  }

  // Historical medication / dependency pressure tends toward NOW/TODAY — suggestion only.
  let suggestedHorizon: TimeHorizonKey = "TODAY";
  if (memoryEnvelope.operationalBias >= 0.35 || operationalEntries.length > 0) {
    suggestedHorizon = "NOW";
  } else if (memoryEnvelope.patternBias >= 0.25) {
    suggestedHorizon = "TODAY";
  } else {
    suggestedHorizon = "SOON";
  }

  const source =
    operationalEntries.length > 0
      ? ("historical_dependency" as const)
      : patternEntries.length > 0
        ? ("repeated_pattern" as const)
        : ("behavior_pattern" as const);

  return {
    suggestedHorizon,
    source,
    confidenceReduction: 0.15,
    detail: `memory ${source} suggests ${suggestedHorizon}; primary=${visibleClassification}`,
    visibleClassification,
  };
}

/**
 * Explicit input preferred over memory routine; reduce confidence and flag uncertainty.
 */
export function resolveTimeConflict(params: {
  signals: TimeInputSignals;
  memoryOverride?: MemoryTimeOverride;
}): TimeConflictFlag | undefined {
  const { signals, memoryOverride } = params;
  if (!memoryOverride) return undefined;

  const hasExplicit = Boolean(signals.explicitTime || signals.relativeTime);
  if (!hasExplicit) {
    return {
      explicitPreferred: false,
      uncertaintyFlagged: true,
      detail: "memory influence without explicit time — uncertainty flagged",
    };
  }

  return {
    explicitPreferred: true,
    uncertaintyFlagged: true,
    detail: "explicit time preferred over memory routine; confidence reduced",
  };
}

/**
 * care-profile timeSensitivity may boost dependencyBoost — never sets urgency alone.
 */
export function computeDependencyBoost(params: {
  careProfile?: CareProfile;
  memoryEnvelope?: MemoryInfluenceEnvelope;
  emotionalBias?: number;
}): number {
  let boost = 0;

  if (params.careProfile?.timeSensitivity === "morning") {
    boost += 0.08;
  } else if (params.careProfile?.timeSensitivity === "night") {
    boost += 0.06;
  }

  if (params.careProfile?.conditionSignals.medicationReminders) {
    boost += 0.1;
  }

  if (params.memoryEnvelope) {
    boost += params.memoryEnvelope.operationalBias * 0.2;
    boost += params.memoryEnvelope.patternBias * 0.1;
  }

  if (params.emotionalBias && params.emotionalBias > 0) {
    // Emotional reinforcement slows effective decay via boost — does not invent deadlines.
    boost += Math.min(0.15, params.emotionalBias * 0.2);
  }

  return Math.min(0.5, Math.max(0, boost));
}
