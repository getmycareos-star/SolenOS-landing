/**
 * Load-First Interpretation — recognition before care advice.
 * Heuristic detection on stress-normalizer path; feeds Emotional Load + output shaping.
 */

export {
  LOAD_INTERPRETATION_IDENTITY,
  LOAD_INTERPRETATION_ONE_LINE_TRUTH,
  LOAD_INTERPRETATION_PIPELINE_POSITION,
  LOAD_INTERPRETATION_FORBIDDEN,
  LOAD_FIRST_EMOTIONAL_SCORE_THRESHOLD,
  LOAD_FIRST_BURNOUT_THRESHOLD,
  LOAD_FIRST_MIN_SIGNAL_CATEGORIES,
  LOAD_SIGNAL_CATEGORY_HIT,
  LOAD_EMOTIONAL_BOOST,
  LOAD_SIGNAL_PATTERNS,
  PRIMARY_CONTRIBUTOR_LABELS,
  LOAD_FIRST_MINIMAL_ACTION,
  LOAD_FIRST_SAFE_TO_IGNORE,
} from "./contract-constants";

export type {
  LoadSignalCategory,
  DetectedLoadSignals,
  LoadInterpretation,
  LoadInterpretationBoost,
  LoadInterpretationLayerPayload,
  LoadInterpretationForbidden,
} from "./types";

export { detectLoadSignals } from "./detect";
export {
  buildPrimaryContributors,
  buildBurdenSummary,
  computeEmotionalLoadScore,
} from "./build-burden";
export {
  buildLoadInterpretationBoost,
  applyLoadInterpretationToEmotionalInputs,
} from "./integrate-emotional-load";
export {
  shapeLoadFirstOutput,
  type ShapeLoadFirstOutputParams,
} from "./shape-output";
export {
  processLoadInterpretation,
  toLoadInterpretationLayerPayload,
  formatLoadInterpretationObservation,
  type ProcessLoadInterpretationParams,
} from "./process";
