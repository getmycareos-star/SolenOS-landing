/** Behavior Interpretation Engine — domain intelligence on CareEvents, not raw text. */

export const BEHAVIOR_INTERPRETATION_IDENTITY =
  "SolenOS does not understand dementia — it understands care situations that happen in dementia caregiving.";

export const BEHAVIOR_ENGINE_BOUNDARY =
  "Transform observable dementia-related behaviors into structured understanding — never diagnose, stage, or predict disease progression.";

export const BEHAVIOR_PROHIBITED = [
  "infer medical condition severity",
  "label dementia stage from behavior",
  "predict disease progression",
  "give medical advice",
  "interpret symptoms clinically",
  "assume causality from disease worsening",
  "single-explanation conclusions",
  "hidden reasoning",
] as const;

export const CONFIDENCE_LEVELS = ["high", "medium", "low"] as const;

export const BEHAVIOR_TAXONOMY_GROUPS = [
  "personal_care",
  "medication",
  "emotional_distress",
  "orientation",
  "sleep",
  "eating_drinking",
  "withdrawal",
  "communication",
  "safety_incident",
  "coordination",
] as const;

export const INVESTIGATION_DOMAINS = ["physical", "environmental", "emotional"] as const;

export const UNMET_NEED_CANDIDATES = [
  "reassurance",
  "familiarity",
  "dignity",
  "safety",
  "pain_relief",
  "hydration",
  "companionship",
  "stimulation",
  "reduced_stimulation",
  "autonomy",
  "rest",
  "orientation_support",
] as const;

export const REASONING_PIPELINE_STAGES = [
  "observed_behavior",
  "behavior_classification",
  "possible_interpretations",
  "possible_unmet_needs",
  "investigation_checklist",
  "recommended_approach",
  "escalation_assessment",
  "context_update",
  "longitudinal_patterns",
] as const;
