/** Anti-patterns that increase caregiver cognitive/emotional load. */

export type CaregiverPressureReductionViolationCode =
  | "planning_system_language"
  | "workflow_creation"
  | "multi_step_strategy"
  | "interpretation_expansion"
  | "self_blame_amplification"
  | "education_depth"
  | "optimization_language"
  | "emotional_framing_in_structure"
  | "decision_surface_expansion";

export const CAREGIVER_PRESSURE_REDUCTION_VIOLATION_CODES: readonly CaregiverPressureReductionViolationCode[] =
  [
    "planning_system_language",
    "workflow_creation",
    "multi_step_strategy",
    "interpretation_expansion",
    "self_blame_amplification",
    "education_depth",
    "optimization_language",
    "emotional_framing_in_structure",
    "decision_surface_expansion",
  ] as const;

export const PLANNING_SYSTEM_PATTERNS = [
  /\baction plan\b/i,
  /\bcare plan\b/i,
  /\bcreate a plan\b/i,
  /\bdevelop a strategy\b/i,
  /\blong[- ]term plan\b/i,
  /\borganize your care\b/i,
  /\btrack progress\b/i,
  /\bmanage your tasks\b/i,
  /\bcare management\b/i,
] as const;

export const WORKFLOW_PATTERNS = [
  /\bworkflow\b/i,
  /\bchecklist\b/i,
  /\btask list\b/i,
  /\bto[- ]do list\b/i,
  /\bonboarding\b/i,
  /\bdashboard\b/i,
  /\bset up a routine\b/i,
  /\bbuild a habit\b/i,
  /\btask planner\b/i,
] as const;

export const MULTI_STEP_STRATEGY_PATTERNS = [
  /\bstep 1\b/i,
  /\bfirst,? .{0,40} second,? .{0,40} third\b/i,
  /\bfollow these steps\b/i,
  /\bmulti[- ]step\b/i,
  /\bphase 1\b/i,
] as const;

export const INTERPRETATION_EXPANSION_PATTERNS = [
  /\blikely indicates\b/i,
  /\bthis could mean\b/i,
  /\bthis suggests that\b/i,
  /\bmay be developing\b/i,
  /\bprobably due to\b/i,
  /\bunderlying cause\b/i,
  /\broot cause\b/i,
] as const;

export const SELF_BLAME_PATTERNS = [
  /\byou failed\b/i,
  /\byour fault\b/i,
  /\byou should have\b/i,
  /\bdoing this wrong\b/i,
  /\byou're not doing enough\b/i,
  /\bblame yourself\b/i,
  /\bnot doing enough\b/i,
] as const;

export const EDUCATION_DEPTH_PATTERNS = [
  /\bit's important to understand\b/i,
  /\bcaregivers should know\b/i,
  /\blet me explain\b/i,
  /\bhere's how .{0,30} works\b/i,
  /\beducational purposes\b/i,
] as const;

export const OPTIMIZATION_PATTERNS = [
  /\boptimize\b/i,
  /\bbest practice\b/i,
  /\bmaximize efficiency\b/i,
  /\bproductivity\b/i,
  /\bstreamline your care\b/i,
] as const;

export const EMOTIONAL_FRAMING_IN_STRUCTURE_PATTERNS = [
  /\bit's understandable that you feel\b/i,
  /\bdon't blame yourself\b/i,
  /\byou're doing your best\b/i,
  /\bthis must be hard for you\b/i,
  /\bi understand this feels overwhelming\b/i,
  /\byou're not alone\b/i,
  /\beverything will be okay\b/i,
] as const;

export const DECISION_SURFACE_PATTERNS = [
  /\bconsider (?:whether|if) you should\b/i,
  /\bdecide between\b/i,
  /\bweigh the options\b/i,
  /\bevaluate all (?:the )?possibilities\b/i,
  /\bchoose between\b/i,
] as const;

export interface CaregiverPressureReductionResult {
  valid: boolean;
  violations: CaregiverPressureReductionViolationCode[];
}

/** @deprecated Use CaregiverPressureReductionViolationCode */
export type PressureReductionViolationCode = CaregiverPressureReductionViolationCode;

/** @deprecated Use CAREGIVER_PRESSURE_REDUCTION_VIOLATION_CODES */
export const PRESSURE_REDUCTION_VIOLATION_CODES = CAREGIVER_PRESSURE_REDUCTION_VIOLATION_CODES;

/** @deprecated Use CaregiverPressureReductionResult */
export type PressureReductionResult = CaregiverPressureReductionResult;
