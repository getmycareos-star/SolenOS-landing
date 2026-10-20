/** Care State Engine — Care Reality model (narrow MVP). Documents are inputs only. */

export const CARE_STATE_ENGINE_IDENTITY =
  "The primary object is Care State — an evolving understanding of a person's care reality, not documents or chat.";

export const CARE_STATE_ENGINE_DEFINING_PRINCIPLE =
  "Input → Care Event → Care State Update → Change Detection → Current Understanding. Documents are the doorway; Care Reality is the product.";

export const CARE_STATE_SECTIONS = [
  "person_context",
  "current_conditions",
  "events",
  "observations",
  "medications",
  "decisions",
  "tasks",
  "risks",
  "unknowns",
  "explicit_unknowns",
  "known_facts",
  "inferred_interpretations",
  "confidence_scores",
  "recent_changes",
  "needs_attention",
  "what_is_stable",
] as const;

export const CARE_STATE_RULES = [
  "documents_are_inputs_only",
  "care_state_is_primary_object",
  "store_unknowns_explicitly",
  "detect_before_after_change",
  "no_diagnosis_no_prescribe",
  "calming_intelligence_not_anxiety",
  "architecture_compatible_with_future_roles",
  "spine_before_ui",
  "change_matters_more_than_event",
  "attention_by_risk_and_uncertainty_not_tasks",
] as const;

export const CARE_STATE_FUTURE_COMPATIBLE = [
  "decision_memory",
  "care_loop_outcomes",
  "plan_drift_detection",
  "permission_roles",
  "evidence_relationships",
  "care_transition_mode",
] as const;

export const CARE_STATE_NOT_IN_MVP = [
  "full_permission_matrix",
  "evidence_graph_ui",
  "emotional_diagnosis",
  "family_coordination_screens",
  "professional_portal",
] as const;
