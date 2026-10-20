export {
  AMBIGUITY_VALIDATION_IDENTITY,
  AMBIGUITY_VALIDATION_ONE_LINE_TRUTH,
  ANTI_STRUCTURE_HALLUCINATION_RULES,
  CLARITY_GATE_FORBIDDEN_ON_AMBIGUOUS,
  CARE_DECOMPRESSION_BYPASS_RULE,
  MIN_SUBSTANTIVE_INPUT_LENGTH,
  CLARITY_CONSTRAINT_PREFIX,
  MISSING_DIMENSION_QUESTIONS,
} from "./contract-constants";
export {
  CLARITY_LEVELS,
  MISSING_DIMENSIONS,
  CLARITY_GATE_ACTIONS,
} from "./types";
export type {
  ClarityLevel,
  MissingDimension,
  InputClarity,
  ClarityGateAction,
  ClarificationGateResult,
} from "./types";
export {
  hasTimeframe,
  hasSuccessCriteria,
  hasScopeBoundaries,
  hasSubjectDefinition,
  hasStakeholderContext,
  hasCareSignals,
  isGibberish,
  isSubstantiveText,
  isTrueAmbiguous,
  isCareDecompressionContext,
} from "./dimensions";
export { analyzeClarity } from "./analyze-clarity";
export { processInputClarityGate, formatClarityConstraintLine } from "./decision-gate";
export { buildStructuredClarificationResponse } from "./clarification-response";
