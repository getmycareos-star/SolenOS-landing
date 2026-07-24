/** Product North Star — non-negotiable execution constraint. */

export const PRODUCT_NORTH_STAR =
  "A caregiver should never need to reconstruct the care journey from memory.";

export const PRODUCT_NORTH_STAR_IDENTITY =
  "SolenOS is not an assistant. It is the memory system for caregiving reality.";

export const PRODUCT_NORTH_STAR_DEFINING_PRINCIPLE =
  "SolenOS wins when caregivers stop saying 'I need to remember everything' and start saying 'SolenOS already knows what changed.'";

/** Single-line gate for every feature / engine / UI decision. */
export const NORTH_STAR_TEST =
  "Does this reduce the caregiver's need to reconstruct the care journey from memory?";

export const NORTH_STAR_TEST_DEFAULT =
  "If unclear → default to NO (strict constraint)." as const;

export const NORTH_STAR_IMPLICIT_OUTPUT_QUESTIONS = [
  "what_changed",
  "what_matters_now",
  "what_should_i_remember",
  "what_can_i_ignore",
] as const;

export const NORTH_STAR_ELIMINATES = [
  "chat_first_design",
  "conversation_loops",
  "generic_assistant_replies",
  "dashboards_without_continuity",
  "static_reports_requiring_interpretation",
  "feature_bloat_helpful_ai_tools",
  "ask_me_anything_qa",
  "answer_engine_optimization",
] as const;

export const NORTH_STAR_ENABLES = [
  "continuity_system",
  "external_memory_layer",
  "change_detection_system",
  "decision_support_from_longitudinal_evidence",
] as const;

export const NORTH_STAR_ENGINE_JUSTIFICATIONS = {
  care_event_store: "YES — externalizes memory as immutable events",
  care_context: "YES — computed current reality without human recall",
  timeline_reconstruction_engine: "YES — reconstructs fragmented history",
  care_context_diff_engine: "YES — eliminates memory reconstruction of change",
  contradiction_detection_engine: "YES — preserves transitions without overwriting history",
  clarification_engine: "YES — fills missing memory gaps that block understanding",
  state_of_care_summary_engine: "YES — surfaces current understanding without reconstruction",
  retention_engine: "YES — return loop shows what changed while away",
  trust_layer_engine: "YES — evidence, confidence, unknowns without AI decree",
  generic_chat_interface: "NO — reintroduces memory burden and conversation loops",
  search_answer_engine: "NO — optimizes answers instead of eliminating the need to ask",
  dashboard_analytics: "NO — aggregated UI without care-journey continuity",
} as const;

export const PRODUCT_NORTH_STAR_RULES = [
  "north_star_test_mandatory",
  "unclear_defaults_to_reject",
  "not_an_answer_engine",
  "questions_are_continuity_symptoms",
  "optimize_continuity_demand_over_search_demand",
  "output_must_answer_implicit_memory_questions",
  "engines_must_justify_against_north_star",
] as const;

/** Build order aligned with North Star (MVP priority). */
export const NORTH_STAR_BUILD_ORDER = [
  "care_event_store",
  "care_context_projection",
  "timeline_reconstruction",
  "state_of_care_generation",
  "diff_engine",
  "contradiction_detection",
  "trust_evidence_panel",
  "caregiver_feedback_learning_loop",
] as const;
