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
