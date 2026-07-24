/**
 * Care Reality Intelligence — category composition (not a product rename).
 * SolenOS maintains an evolving understanding of a person's changing care reality.
 */

/** Category phrase only — company/product name remains SolenOS. */
export const CARE_REALITY_INTELLIGENCE_CATEGORY = "Care Reality Intelligence" as const;

export const CARE_REALITY_INTELLIGENCE_IDENTITY =
  "An evolving intelligence layer that maintains an understanding of a person's changing care reality — not notes, tasks, chat, or document storage.";

export const CARE_REALITY_INTELLIGENCE_THESIS =
  "Documents are the doorway. The Living Care Record is the product. SolenOS is the evolving intelligence layer that helps families recognize change, understand context, coordinate responsibility, preserve knowledge, and make decisions with confidence.";

export const CARE_REALITY_INTELLIGENCE_DEFINING_PRINCIPLE =
  "Information → Observation → Personal Baseline → Change Detection → Context → Meaning → Confidence → Actionable Understanding";

/** Core intelligence chain — engine spine before UI. */
export const INTELLIGENCE_CHAIN_STAGES = [
  "events",
  "changes",
  "decisions",
  "outcomes",
  "context",
  "confidence",
] as const;

/** Six capabilities — composition targets, not separate products. */
export const CORE_CAPABILITIES = [
  "living_care_record",
  "care_state_understanding",
  "moment_of_need_guidance",
  "person_specific_understanding",
  "decision_memory",
  "human_context",
] as const;

/** Comparison engine — person history over generic condition knowledge. */
export const COMPARISON_ENGINE_QUESTION =
  "Is this different for this person compared with what we know about them?";

export const COMPARISON_ENGINE_REJECTS =
  "Is this common in dementia? / What happens in dementia? / Generic symptom encyclopedia answers.";

/** Information progression every feature must support. */
export const INFORMATION_PROGRESSION = [
  "raw_information",
  "care_event",
  "care_state_change",
  "context",
  "meaning",
  "confidence",
  "actionable_understanding",
] as const;

/** Trust & reliability engineering — evidence engine, not guessing engine. */
export const TRUST_ENGINEERING_RULES = [
  "conservative_understanding_over_confident_guessing",
  "evidence_before_interpretation",
  "context_before_classification",
  "never_escalate_beyond_evidence",
  "every_fact_has_lifecycle",
  "immediate_feedback_on_capture",
  "reliability_before_intelligence",
  "preserve_original_evidence",
  "trust_through_transparency",
  "privacy_by_design",
  "source_provenance_foundational",
  "reliability_over_sophistication",
] as const;

/** Build personal baseline + history — not generic health AI. */
export const BUILD_SURFACE = [
  "personal_baseline",
  "care_history",
  "change_detection",
  "context_reconstruction",
  "decision_memory",
  "uncertainty_awareness",
  "evidence_preservation",
  "care_transition_signals",
] as const;

/** Architecture-level do-not-build (complements forbidden-build-zone). */
export const DO_NOT_BUILD = [
  "symptom_checker",
  "dementia_faq_assistant",
  "generic_health_chatbot",
  "medical_recommendation_engine",
  "document_vault_primary",
  "task_manager_primary",
  "reminder_app_primary",
  "family_coordination_chat_primary",
  "healthcare_portal_replacement",
  "generic_family_health_platform",
  "dashboard_first_ui",
  "answer_engine_optimization",
  "generic_communication_assistant",
  "gamified_care_scores",
] as const;

/** Care transition gap — signal types (FUTURE: Care Transition Mode). */
export const CARE_TRANSITION_SIGNAL_TYPES = [
  "hospital_discharge",
  "new_diagnosis",
  "medication_change",
  "new_symptom",
  "caregiver_handoff",
  "emergency_recovery",
  "home_care_transition",
] as const;

export const CARE_REALITY_INTELLIGENCE_STATUS = {
  facade: "IMPLEMENTED",
  care_loop_outcomes: "SCHEMA-ONLY",
  care_transition_mode: "FUTURE",
  care_communication_translation: "FUTURE",
} as const;
