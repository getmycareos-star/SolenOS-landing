export {
  SOLENOS_FIELD_ORDER,
  DECISION_TRACE_FIELD_ORDER,
  DecisionTraceSchema,
  DETERMINISM_FAILURE_TYPES,
} from "./types";
export type {
  DecisionTrace,
  DeterminismFailureType,
  StructureDriftResult,
  StabilityCheckResult,
  ConsistencyCheckResult,
  PriorityStabilityResult,
  InterpretationStabilityResult,
  PromptRegressionCheckResult,
} from "./types";
export {
  canonicalizeOutput,
  canonicalizeDecisionTrace,
  hashNormalizedInput,
  outputsAreIdentical,
  verifyRawFieldOrdering,
} from "./canonicalize";
export { verifyStructureDrift, verifyOutputStability } from "./structure-drift";
export {
  checkRepeatedInputConsistency,
  peekRepeatedInputSnapshots,
  clearRepeatedInputSnapshots,
  recordRepeatedInputSnapshot,
} from "./repeated-input";
export {
  checkPriorityStability,
  fingerprintPriority,
  clearPrioritySnapshots,
  peekPrioritySnapshots,
} from "./priority-stability";
export {
  checkInterpretationStability,
  fingerprintInterpretation,
  clearInterpretationSnapshots,
  peekInterpretationSnapshots,
} from "./interpretation-stability";
export {
  checkPromptRegression,
  PROMPT_REGRESSION_GOLDENS,
  clearPromptRegressionGoldens,
  VERIFY_PROMPT_REGRESSION_GOLDENS,
  checkPromptRegressionWithGoldens,
} from "./prompt-regression";
export { runDeterminismGate, type DeterminismGateResult } from "./gate";
import { clearRepeatedInputSnapshots } from "./repeated-input";
import { clearPrioritySnapshots } from "./priority-stability";
import { clearInterpretationSnapshots } from "./interpretation-stability";

/** Clear all deterministic snapshot stores (verify/tests). */
export function clearAllDeterminismSnapshots(): void {
  clearRepeatedInputSnapshots();
  clearPrioritySnapshots();
  clearInterpretationSnapshots();
}
