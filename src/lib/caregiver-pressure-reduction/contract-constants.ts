/** Caregiver Pressure Reduction System — canonical product contract (Final Product Spec). */

export const CAREGIVER_PRESSURE_REDUCTION_SYSTEM_REALITY =
  "a cognitive + emotional pressure reduction layer for continuous caregiving uncertainty";

export const CAREGIVER_PRESSURE_REDUCTION_ONE_LINE_TRUTH =
  "SolenOS is a system for helping caregivers think less painfully under continuous responsibility — NOT for helping them do more.";

export const CAREGIVER_PRESSURE_REDUCTION_CORE_PROBLEM =
  "continuous mental load from uncertainty under responsibility — not lack of knowledge or plans";

export const CAREGIVER_PRESSURE_REDUCTION_PRODUCT_PURPOSE =
  "reduce cognitive and emotional load in real-time decision moments";

export const CAREGIVER_PRESSURE_REDUCTION_SUCCESS_METRIC =
  'User feels "clearer", "lighter", and "not doing something wrong" — not informed, educated, or optimized.';

export const CAREGIVER_PRESSURE_REDUCTION_FORBIDDEN_IDENTITY = [
  "caregiving assistant",
  "medical guidance system",
  "workflow planner",
  "task optimizer",
  "care coordination platform",
  "knowledge system",
  "productivity system",
  "care management platform",
  "behavioral tracking system",
  "optimization engine",
] as const;

export const CAREGIVER_PRESSURE_REDUCTION_BEHAVIOR_GUARANTEES = [
  "reduce uncertainty pressure",
  "reduce interpretation burden",
  "reduce self-blame loops",
  "feel lighter after reading",
  "avoid adding mental steps",
  "avoid increasing cognitive load",
] as const;

export const CAREGIVER_PRESSURE_REDUCTION_OUTPUT_RULES_NEVER = [
  "planning systems",
  "workflows",
  "expanded explanation",
  "increased decision surface",
  "multi-step strategies",
] as const;

export const CAREGIVER_PRESSURE_REDUCTION_OUTPUT_RULES_ALWAYS = [
  "collapse complexity",
  "reduce interpretation demand",
  "simplify emotional ambiguity",
  "remove mental branching",
] as const;

export const CAREGIVER_PRESSURE_REDUCTION_SUCCESS_SIGNALS = [
  "this is clearer now",
  "I don't need to overthink this",
  "this feels lighter",
  "I'm not doing something wrong",
] as const;

export const CAREGIVER_PRESSURE_REDUCTION_FAILURE_CONDITIONS = [
  "increases mental effort",
  "adds new decisions",
  "expands interpretation burden",
  "creates planning complexity",
  "feels like a system to manage",
] as const;

export const CAREGIVER_PRESSURE_REDUCTION_FAILURE_MODEL =
  "SolenOS fails when output increases mental effort, adds decisions, expands interpretation, creates planning complexity, or feels like a system to manage — even if accurate.";

/** @deprecated Use CAREGIVER_PRESSURE_REDUCTION_* constants */
export const PRESSURE_REDUCTION_SYSTEM_REALITY = CAREGIVER_PRESSURE_REDUCTION_SYSTEM_REALITY;
export const PRESSURE_REDUCTION_ONE_LINE_TRUTH = CAREGIVER_PRESSURE_REDUCTION_ONE_LINE_TRUTH;
export const PRESSURE_REDUCTION_FORBIDDEN_IDENTITY = CAREGIVER_PRESSURE_REDUCTION_FORBIDDEN_IDENTITY;
export const PRESSURE_REDUCTION_BEHAVIOR_GUARANTEES = CAREGIVER_PRESSURE_REDUCTION_BEHAVIOR_GUARANTEES;
export const PRESSURE_REDUCTION_SUCCESS_SIGNALS = CAREGIVER_PRESSURE_REDUCTION_SUCCESS_SIGNALS;
export const PRESSURE_REDUCTION_FAILURE_CONDITIONS = CAREGIVER_PRESSURE_REDUCTION_FAILURE_CONDITIONS;
export const PRESSURE_REDUCTION_FAILURE_MODEL = CAREGIVER_PRESSURE_REDUCTION_FAILURE_MODEL;
