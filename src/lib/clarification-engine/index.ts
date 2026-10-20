export {
  CLARIFICATION_ENGINE_IDENTITY,
  CLARIFICATION_DEFINING_PRINCIPLE,
  CLARIFICATION_CATEGORIES,
  UNCERTAINTY_LEVELS,
  CLARIFICATION_BUDGET,
  MISSING_DIMENSIONS,
  CLARIFICATION_TEMPLATES,
  VAGUE_INPUT_PATTERNS,
} from "./contract-constants";

export type {
  ClarificationCategory,
  MissingDimension,
  UncertaintyLevel,
  ClarificationQuestion,
  ClarificationEngineResult,
  ProcessClarificationEngineInput,
} from "./types";

export {
  isVagueInput,
  detectMissingDimensions,
  estimateUncertaintyLevel,
} from "./detect-missing";
export { prioritizeClarificationQuestions } from "./prioritize-questions";
export { applyClarificationBudget, estimateConfidenceShift } from "./budget";
export { processClarificationEngine } from "./pipeline";
export { resetClarificationStore, getAdaptiveHints } from "./store";
