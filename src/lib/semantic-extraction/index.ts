/** Semantic extraction — exports. */

export type {
  SemanticExtraction,
  ExtractionResult,
  ExtractionCoverage,
  ExtractionSource,
  ExtractionObservation,
  ExtractionMeasurement,
  ExtractionMedication,
  ExtractionTemporalFact,
  ExtractionAttribution,
  ExtractionContradiction,
  ExtractionUncertainty,
  ExtractionQuestion,
  ExtractionAppointment,
  CaregiverLoadSignal,
} from "./types";

export {
  SemanticExtractor,
  createSemanticExtractor,
  EXTRACTION_MODEL_LADDER,
} from "./extractor";
export { buildExtractionPrompt, EXTRACTION_SYSTEM_PROMPT } from "./prompt";
export { extractWithRules, isStructurallyEmpty } from "./rule-extractor";
export {
  extractionCoverage,
  mergeExtractions,
  normalizeExtraction,
  salvageJson,
} from "./normalize";

// ─── Qwen Reasoning Layer ─────────────────────────────────────────────────
export {
  QwenReasoningEngine,
  createQwenReasoningEngine,
  type ReasoningInput,
} from "./reasoning-engine";
export type { QwenReasoningOutput } from "./reasoning-engine";
export type {
  CaregiverIntent,
  CaregiverEmotionalState,
  CaregiverTrustLevel,
  CaregiverUrgency,
  CaregiverIntentAnalysis,
  DomainTrajectory,
  InflectionPoint,
  CrossObservationSynthesis,
  ContradictionHypothesis,
  ContradictionResolution,
  BaselineEnrichment,
  UncertaintyExplanation,
} from "./reasoning-types";
export {
  INTENT_PROMPT,
  SYNTHESIS_PROMPT,
  CONTRADICTION_PROMPT,
  BASELINE_PROMPT,
  UNCERTAINTY_PROMPT,
  REASONING_SYSTEM_MESSAGE,
} from "./reasoning-prompts";
