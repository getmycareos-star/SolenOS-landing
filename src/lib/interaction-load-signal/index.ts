/**
 * Caregiver Interaction Load Signal — repetitive emotional interaction loops, boundary stress, sleep protection.
 */

export {
  INTERACTION_LOAD_SIGNAL_IDENTITY,
  INTERACTION_LOAD_SIGNAL_ONE_LINE_TRUTH,
  INTERACTION_LOAD_SIGNAL_PIPELINE_POSITION,
  INTERACTION_LOAD_SIGNAL_FORBIDDEN,
  INTERACTION_LOAD_SYSTEM_INSIGHT,
  INTERACTION_PATTERN_HIT,
  INTERACTION_LOAD_MIN_CATEGORIES,
  BOUNDARY_VIOLATION_STRESS_THRESHOLD,
  REPETITION_FATIGUE_THRESHOLD,
  INTERACTION_LOAD_FLAG_DESCRIPTIONS,
  INTERACTION_LOAD_METRIC_BOOST,
  SLEEP_PROTECTION_MAX_ACTIONS,
  INTERACTION_SURVIVABILITY_NORMALIZATION,
  INTERACTION_SURVIVABILITY_CONTAINMENT,
  INTERACTION_SURVIVABILITY_MINIMAL_SUGGESTION,
  INTERACTION_LOAD_PATTERNS,
  INTERACTION_PATTERN_LABELS,
} from "./contract-constants";

export type {
  InteractionLoadPatternCategory,
  InteractionLoadFlag,
  OutputStrategy,
  SleepDisruptionRiskLevel,
  DetectedInteractionLoadSignals,
  InteractionLoadMetricDeltas,
  SleepProtectionMode,
  InteractionLoadFlagEntry,
  InteractionLoadGuaranteeResult,
  InteractionLoadSignalResult,
  InteractionLoadLayerPayload,
  InteractionLoadForbidden,
  InteractionLoadCliBoost,
} from "./types";

export { detectInteractionLoadSignals } from "./detect";
export {
  clampScore,
  computeBoundaryViolationIndex,
  classifySleepDisruptionRisk,
  computeInteractionLoadMetricDeltas,
  evaluateInteractionLoadFlags,
  isInteractionLoadDetected,
  evaluateSleepProtectionMode,
  hasFlag,
} from "./compute";
export {
  buildInteractionLoadCliBoost,
  applyInteractionLoadToCliInputs,
} from "./integrate-cli";
export { applyInteractionLoadToEmotionalInputs } from "./integrate-emotional-load";
export {
  shapeInteractionSurvivabilityOutput,
  type ShapeInteractionSurvivabilityParams,
} from "./shape-output";
export { runInteractionLoadGuarantee } from "./guarantee";
export {
  processInteractionLoadSignal,
  toInteractionLoadLayerPayload,
  formatInteractionLoadObservation,
  type ProcessInteractionLoadSignalParams,
} from "./process";
