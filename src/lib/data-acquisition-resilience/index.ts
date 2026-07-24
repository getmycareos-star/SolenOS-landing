export {
  DARE_IDENTITY,
  DARE_CORE_RULE,
  OCR_CONFIDENCE_THRESHOLD,
  AUTO_VALIDATE_CONFIDENCE,
  CONFIDENCE_SOURCES,
  AMBIGUITY_FLAGS,
  CORRECTION_TYPES,
} from "./contract-constants";

export type {
  RawInput,
  RawInputType,
  ExtractionCandidate,
  UncertainEventCandidate,
  DocumentUnreadableSection,
  DisambiguationQuestion,
  ConflictingEventSet,
  ConflictingClaim,
  CorrectionEvent,
  ValidatedCareEvent,
  DareIngestResult,
  DareProjection,
  ApplyCorrectionInput,
  ConfidenceSource,
  AmbiguityFlag,
  CorrectionType,
  CompletenessLevel,
} from "./types";

export {
  ingestRawInput,
  getDareProjection,
  applyCorrection,
  confirmCandidate,
  validatedToCanonical,
  resetDareStore,
} from "./pipeline";

export type { IngestRawInputParams } from "./pipeline";

export {
  extractCandidatesFromRawInput,
  buildUncertainEvents,
  generateDisambiguationQuestions,
  shouldAutoValidate,
  checkOcrFailure,
} from "./extract-candidates";

export { evolveConfidence } from "./confidence-evolution";
export { reconcileCrossDocument } from "./cross-document-reconcile";
