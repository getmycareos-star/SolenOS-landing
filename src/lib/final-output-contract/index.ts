export {
  FINAL_OUTPUT_CONTRACT_IDENTITY,
  CANONICAL_RISK_LEVELS,
  CANONICAL_CONFIDENCE_LEVELS,
  REQUIRED_OUTPUT_FIELDS,
  DECISION_TRACE_FIELDS,
  CONFIDENCE_STATE_FIELDS,
  MAX_HIGH_IMPACT_QUESTIONS,
  MAX_FOLLOW_UP_ITEMS,
  LLM_OUTPUT_SCHEMA_JSON,
} from "./contract-constants";

export type {
  CanonicalRiskLevel,
  CanonicalConfidenceLevel,
  DecisionTrace,
  ConfidenceState,
  TrustLayerOutput,
  FinalOutputContract,
  FinalOutputValidationError,
} from "./types";

export {
  DecisionTraceSchema,
  ConfidenceStateSchema,
  FinalOutputContractSchema,
  validateFinalOutput,
  isFinalOutputValidationError,
  extractFinalOutputPayload,
} from "./schema";

export {
  createEmptyDecisionTrace,
  createEmptyConfidenceState,
  createEmptyTrustLayer,
  buildDegradedOutput,
  mapRiskToCanonical,
  mapConfidenceToCanonical,
  computeCompleteness,
  canonicalizeRiskLevel,
} from "./degrade";

export { compileFromSituationResponse, compileAndValidate } from "./compile";

export {
  processFinalOutput,
  enforceFinalOutputAtBoundary,
} from "./pipeline";
