/**
 * Condition Modules — calibration layer on top of the SolenOS core engine.
 *
 * A condition module configures vocabulary, attention weights, and evaluation
 * cases for a specific care context (e.g., dementia). It does NOT replace
 * DARE, normalization, or priority computation. It influences them.
 */

export type ConditionModuleId = "general" | "dementia" | "future_condition";

export type VocabularyRule = {
  id: string;
  /** Patterns that map to this rule */
  patterns: readonly RegExp[];
  /** Target atomic event type or domain tag */
  target_type: string;
  /** Optional domain classification */
  domain?: "cognition" | "behavior" | "safety" | "function" | "care_system" | "medication" | "appointment" | "observation";
  /** If true, this is a low-specificity observation — do not auto-infer diagnosis */
  low_specificity?: boolean;
  /** If true, preserve ambiguity — do not auto-resolve to a specific entity */
  preserve_ambiguity?: boolean;
  /** Safety relevance score 0-1 */
  safety_relevance?: number;
  /** Attention weight multiplier 0-2 */
  attention_weight?: number;
  /** Forbidden clinical inferences for this pattern */
  forbidden_inferences?: readonly string[];
};

export type AttentionWeightRule = {
  domain: string;
  /** Base urgency modifier */
  urgency_delta: number;
  /** Base uncertainty modifier */
  uncertainty_delta: number;
  /** Attention weight multiplier */
  attention_multiplier: number;
  /** When true, elevated weighting applies */
  condition?: "new" | "escalating" | "materially_different" | "safety_associated";
};

export type EvaluationCase = {
  id: string;
  input: string;
  expected_domain: string;
  expected_atomic_type: string;
  expected_entity_type: string;
  expected_confidence_tag: "confirmed" | "reported" | "inferred" | "unknown";
  expected_source_pointer: boolean;
  expected_clinical_boundary_compliant: boolean;
  notes?: string;
};

export type ConditionModule = {
  id: ConditionModuleId;
  label: string;
  vocabulary: readonly VocabularyRule[];
  attention_weights: readonly AttentionWeightRule[];
  evaluation_cases: readonly EvaluationCase[];
  forbidden_clinical_inferences: readonly string[];
  /** When true, the module requires explicit caregiver confirmation before escalating to clinical interpretation */
  requires_clinical_confirmation: boolean;
};

export type AttentionWeightInput = {
  urgency_delta: number;
  uncertainty_delta: number;
  attention_multiplier: number;
};

export type ConditionModuleContext = {
  care_context: ConditionModuleId;
  /** Active vocabulary rules for this session */
  active_vocabulary: readonly VocabularyRule[];
  /** Active attention weights for this session */
  active_attention_weights: readonly AttentionWeightRule[];
  /** Baseline events for change detection */
  baseline_events: unknown[];
};
