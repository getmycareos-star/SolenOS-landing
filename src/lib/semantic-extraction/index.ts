/** Semantic extraction — exports. */

export type {
  SemanticExtraction,
  ExtractionResult,
  ExtractionObservation,
  ExtractionMeasurement,
  ExtractionMedication,
  ExtractionTemporalFact,
  ExtractionAttribution,
  ExtractionContradiction,
  ExtractionUncertainty,
  ExtractionQuestion,
  ExtractionAppointment,
} from "./types";

export { SemanticExtractor, createSemanticExtractor } from "./extractor";
export { buildExtractionPrompt, EXTRACTION_SYSTEM_PROMPT } from "./prompt";