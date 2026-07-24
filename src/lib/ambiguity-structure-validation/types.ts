export const CLARITY_LEVELS = ["CLEAR", "PARTIAL", "AMBIGUOUS"] as const;
export type ClarityLevel = (typeof CLARITY_LEVELS)[number];

export const MISSING_DIMENSIONS = [
  "TIMEFRAME",
  "SUCCESS_CRITERIA",
  "SCOPE_BOUNDARIES",
  "SUBJECT_DEFINITION",
  "STAKEHOLDER_CONTEXT",
] as const;
export type MissingDimension = (typeof MISSING_DIMENSIONS)[number];

export type InputClarity = {
  clarityLevel: ClarityLevel;
  missingDimensions: MissingDimension[];
  /** Forbidden — classifier must never populate (anti-hallucination). */
  inferredIntent?: never;
};

export const CLARITY_GATE_ACTIONS = ["BLOCK", "PARTIAL", "PASS"] as const;
export type ClarityGateAction = (typeof CLARITY_GATE_ACTIONS)[number];

export type ClarificationGateResult = {
  action: ClarityGateAction;
  clarity: InputClarity;
  constraintLine?: string;
};
