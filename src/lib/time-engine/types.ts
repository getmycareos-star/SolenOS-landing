import type { TIME_HORIZON_KEYS, UNSCHEDULED_TEMPORAL_LABEL } from "./contract-constants";
import type { TimeControl } from "../settings-governance/types";

export type TimeHorizonKey = (typeof TIME_HORIZON_KEYS)[number];

export type TimeHorizonModel = {
  NOW: string;
  TODAY: string;
  SOON: string;
  LATER: string;
};

export type UrgencyDecayFunction = (timeDeltaHours: number, lambda: number) => number;

export type SolenOSTimeEngine = {
  timezoneDetection: boolean;
  coarseLocationEnabled: boolean;
  strictTimeHorizonMode: boolean;
  timeHorizonModel: TimeHorizonModel;
  urgencyDecayFunction: UrgencyDecayFunction;
};

export type TimeInputSignals = {
  explicitTime?: string;
  relativeTime?: string;
  inferredTime?: string;
  missingTime: boolean;
};

export type TimeClassification = {
  originalTimestamp?: string;
  horizon: TimeHorizonKey;
  urgencyScore: number;
  decayAdjustedUrgency: number;
  /** Hours since event relevance — used for decay. */
  relevanceDeltaHours: number;
  confidence: number;
};

export type UnscheduledTemporalState = {
  label: typeof UNSCHEDULED_TEMPORAL_LABEL;
  urgencyScore: 0;
  decayAdjustedUrgency: 0;
  confidence: number;
};

export type TemporalClassification =
  | { kind: "classified"; classification: TimeClassification }
  | { kind: "unscheduled"; state: UnscheduledTemporalState };

export type TemporalPrioritySignal = {
  /** Resolved horizon model labels from settings — not a deadline. */
  horizon: TimeHorizonModel;
  activeHorizon: TimeHorizonKey | "UNSCHEDULED";
  urgencyScore: number;
  decayAdjustedUrgency: number;
  dependencyBoost: number;
  strictMode: boolean;
  /** Present when strictTimeHorizonMode is false and signals blend. */
  blendedHorizons?: Partial<Record<TimeHorizonKey, number>>;
};

export type MemoryTimeOverride = {
  suggestedHorizon?: TimeHorizonKey;
  source: "repeated_pattern" | "historical_dependency" | "behavior_pattern";
  confidenceReduction: number;
  detail: string;
  /** Primary input classification remains visible. */
  visibleClassification: TimeHorizonKey | "UNSCHEDULED";
};

export type TimeConflictFlag = {
  explicitPreferred: boolean;
  uncertaintyFlagged: boolean;
  detail: string;
};

export type TimeEngineWeightEnvelope = {
  temporalUrgency: number;
  horizonCompression: number;
  dependencyBoost: number;
};

export type TimeEngineGuaranteeResult = {
  ok: boolean;
  violations: string[];
};

export type TimeEngineLayerResult = {
  engine: SolenOSTimeEngine;
  signals: TimeInputSignals;
  temporal: TemporalClassification;
  memoryOverride?: MemoryTimeOverride;
  conflict?: TimeConflictFlag;
  prioritySignal: TemporalPrioritySignal;
  envelope: TimeEngineWeightEnvelope;
  guarantee: TimeEngineGuaranteeResult;
};

export type TimeEngineLayerPayload = {
  activeHorizon: TimeHorizonKey | "UNSCHEDULED";
  urgencyScore: number;
  decayAdjustedUrgency: number;
  dependencyBoost: number;
  missingTime: boolean;
  strictMode: boolean;
  memoryOverrideApplied: boolean;
  uncertaintyFlagged: boolean;
  envelope: TimeEngineWeightEnvelope;
};

export type ReadTimeEngineConfigParams = {
  timeControl: TimeControl;
};
