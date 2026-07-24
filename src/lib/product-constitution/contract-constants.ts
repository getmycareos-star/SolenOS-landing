/**
 * SolenOS Product Constitution — worldview that shapes every engineering decision.
 * Features change. Models change. This does not.
 */

export const PRODUCT_CONSTITUTION_WORLDVIEW =
  "Care should never depend on someone's ability to remember everything.";

export const PRODUCT_CONSTITUTION_MISSION =
  "To preserve the continuity of every person's care journey.";

export const PRODUCT_CATEGORY = "Living Care Record" as const;

export const PRODUCT_CATEGORY_DEFINITION =
  "A continuously evolving understanding of one person's care journey — not a document, timeline, or notebook.";

export const PRODUCT_CONSTITUTION_IDENTITY =
  "SolenOS is the reasoning layer between fragmented healthcare outputs and the caregiver's next decision — not an EHR, portal, document repo, reminder app, or chatbot.";

export const PRODUCT_JTBD =
  "When caregivers open SolenOS, they hire it to reduce uncertainty — increased confidence that nothing important is being missed.";

export const PRODUCT_ULTIMATE_METRIC =
  "Did the caregiver leave SolenOS more certain than when they entered?";

export const BRAND_PROMISE =
  "The care journey will never have to begin from memory again.";

export const INTERNAL_MOTTO = "Preserve continuity. Build trust. Reduce burden.";

export const EXTERNAL_TAGLINE = "The care journey, remembered.";

export const PRIMARY_FEELING = "Relief";

export const PRIMARY_FEELING_STATEMENT =
  "For the first time, I don't have to carry every detail by myself.";

export const TRUST_STATEMENT =
  "Trust is not a feature. Trust is the product. We are asking caregivers to trust us with the story of someone they love.";

export const LEGACY_OVER_VIRALITY =
  "Will this still feel trustworthy in ten years? — not merely will this get more clicks next month.";

export const COMPLEMENT_HEALTHCARE =
  "Healthcare systems serve clinical care, legal requirements, and operational workflows. Family caregivers have a different job. SolenOS bridges that gap — it does not fight healthcare.";

/** Wake-up questions caregivers hire SolenOS to answer. */
export const CAREGIVER_WAKE_UP_QUESTIONS = [
  "Is my parent okay?",
  "Did anything important change?",
  "Am I missing something?",
  "What needs my attention today?",
] as const;

/** Confidence outcomes the product must produce. */
export const CONFIDENCE_OUTCOMES = [
  "I understand what is happening.",
  "I know what matters.",
  "I know what needs attention.",
  "I know what I do not know.",
] as const;

/** Engineering decision filter — all must lean yes. */
export const CONSTITUTION_DECISION_FILTER = [
  "Does this improve understanding of the person's current care state?",
  "Does this reduce caregiver uncertainty?",
  "Does this identify important changes?",
  "Does this expose blind spots?",
  "Does this reduce mental burden?",
  "Would a caregiver feel lighter after using it?",
  "Does this preserve continuity?",
  "Does this strengthen the Living Care Record?",
  "Does this build trust?",
  "Would this still matter five years from now?",
] as const;

export const MVP_PRIORITY_ORDER = [
  "care_state_engine",
  "current_state_view",
  "change_detection",
  "risk_and_attention_layer",
  "missing_information",
] as const;

/** Internal state model spine — build this before UI. */
export const CARE_RECORD_SPINE = [
  "person_profile",
  "events",
  "observations",
  "medications",
  "decisions",
  "outcomes",
  "tasks",
  "risks",
  "unknowns",
  "confidence_scores",
] as const;

export const CONSTITUTION_ELIMINATES = [
  "generic_chatbot",
  "ai_companion_personality",
  "social_feed",
  "caregiver_forum",
  "complex_dashboards",
  "productivity_tools",
  "endless_notifications",
  "manual_tracking_workflows",
  "document_app_primary_identity",
  "ehr_replacement",
  "fighting_healthcare_narrative",
  "engagement_over_usefulness",
  "false_certainty",
  "clinical_diagnosis_claims",
] as const;

export const CONSTITUTION_OPTIMIZES = [
  "understanding_of_care_state",
  "change_visibility",
  "attention_by_risk_and_uncertainty",
  "blind_spot_exposure",
  "cognitive_relief",
  "permission_to_stop_worrying_when_safe",
  "subtraction_over_addition",
] as const;

export const CONSTITUTION_RULES = [
  "documents_are_one_input_source_only",
  "care_state_is_the_product",
  "start_with_internal_state_model_not_ui",
  "never_optimize_for_more_information",
  "always_optimize_for_reducing_cognitive_load",
  "understand_before_action",
  "memory_is_not_diagnosis",
  "preserve_caregiver_voice",
  "every_insight_needs_evidence_chain",
  "complement_healthcare_do_not_fight_it",
  "legacy_trust_over_virality",
  "restraint_is_a_competitive_advantage",
  "messy_input_system_organizes",
] as const;

export const PRODUCT_CONSTITUTION_DEFINING_PRINCIPLE =
  "From documents to decisions. From information to confidence. From cognitive overload to cognitive relief.";

/** Product moments (experience constitution). */
export const PRODUCT_MOMENTS = [
  "recognition",
  "relief",
  "confidence",
  "trust",
  "journey_reflection",
] as const;

export const CRITICAL_FAILURE_MODE =
  "Creating another app caregivers have to maintain. If they think 'another thing I have to update' — we failed.";

export const TEN_MINUTE_TOP_THREE =
  "If I only have 10 minutes today, what are the three most important things I should do for my parent?";
