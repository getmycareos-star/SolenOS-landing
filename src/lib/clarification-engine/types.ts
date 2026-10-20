import type { CLARIFICATION_CATEGORIES, MISSING_DIMENSIONS, UNCERTAINTY_LEVELS } from "./contract-constants";

export type ClarificationCategory = (typeof CLARIFICATION_CATEGORIES)[number];

export type MissingDimension = (typeof MISSING_DIMENSIONS)[number];

export type UncertaintyLevel = (typeof UNCERTAINTY_LEVELS)[number];

export type ClarificationQuestion = {
  id: string;
  question: string;
  category: ClarificationCategory;
  dimension: MissingDimension;
  rationale: string;
  priority_rank: number;
  uncertainty_reduction_score: number;
};

export type ClarificationEngineResult = {
  triggered: boolean;
  uncertainty_level: UncertaintyLevel;
  confidence_before_pct: number;
  confidence_after_estimated_pct: number;
  uncertainty_reduced_estimate_pct: number;
  missing_dimensions: MissingDimension[];
  questions: ClarificationQuestion[];
  budget_max: number;
  budget_used: number;
  explain_why: string[];
  adaptive_hints: string[];
  abandonment_risk: "low" | "medium" | "high";
  success_metric: string;
  defining_principle: string;
};

export type ProcessClarificationEngineInput = {
  caregiver_id: string;
  raw_input: string;
  events_created: import("../situation-entry/types").CanonicalCareEvent[];
  what_is_uncertain: string[];
  dare_disambiguation?: string[];
  prior_clarification_count?: number;
  /** Clinical Unknowns profile — defaults to dementia MVP; engine stays disease-agnostic. */
  clinical_profile_id?: string;
};
