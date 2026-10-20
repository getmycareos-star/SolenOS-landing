import type { ARCHITECTURAL_RULES } from "./contract-constants";

export type ArchitecturalRule = (typeof ARCHITECTURAL_RULES)[number];

export type BoundaryViolation = {
  rule: ArchitecturalRule;
  field: string;
  matched_text: string;
  severity: "critical" | "high" | "medium";
  remediation: string;
};

export type ArchitecturalBoundariesResult = {
  enforced: boolean;
  rules_checked: ArchitecturalRule[];
  rules_satisfied: ArchitecturalRule[];
  violations_detected: BoundaryViolation[];
  violations_remediated: BoundaryViolation[];
  decision_framework_passed: boolean;
  defining_principle: string;
  prohibited_avoided: readonly string[];
};

export type EnforceBoundariesInput = {
  /** Text surfaces to scan */
  text_surfaces: Record<string, string | string[]>;
  has_decision_trace: boolean;
  has_evidence_links: boolean;
  has_explicit_uncertainty: boolean;
  preserves_history: boolean;
  confidence_proportional: boolean;
};

export type BoundaryGateInput = {
  feature_name: string;
  preserves_truth: boolean;
  reduces_uncertainty_without_concealing: boolean;
  strengthens_continuity: boolean;
  explainable: boolean;
  confidence_proportional: boolean;
  reduces_burden_without_clinical_replacement: boolean;
  may_diagnose: boolean;
  may_invent_facts: boolean;
  may_hide_uncertainty: boolean;
  may_overwrite_history: boolean;
  optimizes_engagement: boolean;
};

export type BoundaryGateResult = {
  passes: boolean;
  framework_questions: readonly string[];
  failed_questions: string[];
  violated_rules: ArchitecturalRule[];
  recommendation: "build" | "redesign" | "reject";
};
