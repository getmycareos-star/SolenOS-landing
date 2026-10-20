export {
  BOUNDARIES_IDENTITY,
  BOUNDARIES_DEFINING_PRINCIPLE,
  ARCHITECTURAL_RULES,
  RULE_DEFINITIONS,
  DECISION_FRAMEWORK_QUESTIONS,
  DIAGNOSIS_VIOLATION_PATTERNS,
  COMPONENTS_UNDER_BOUNDARY,
} from "./contract-constants";

export type {
  ArchitecturalRule,
  BoundaryViolation,
  ArchitecturalBoundariesResult,
  EnforceBoundariesInput,
  BoundaryGateInput,
  BoundaryGateResult,
} from "./types";

export { scanTextForViolations, remediateText, scanAllSurfaces } from "./detect-violations";
export { evaluateAgainstDecisionFramework } from "./boundary-gate";
export {
  enforceArchitecturalBoundaries,
  enforceBoundariesOnFinalOutput,
} from "./pipeline";
export { resetArchitecturalBoundariesStore } from "./store";
