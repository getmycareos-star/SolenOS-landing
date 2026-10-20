/**
 * Learning-first release — research prototype, not polish.
 * SoT: docs/02-product/solenos-learning-first-release.md
 */

export const LEARNING_FIRST_PURPOSE =
  "Stable MVP that generates real caregiver feedback — learning over polish.";

/** Single hypothesis for first external test. */
export const LEARNING_FIRST_HYPOTHESIS =
  "When caregivers share messy care information, does SolenOS help them understand the situation more clearly than before?";

export const RESEARCH_PREVIEW_NOTICE =
  "This is an early research preview of SolenOS. We're learning how caregivers organize complex care situations over time. Your feedback directly helps improve the system.";

export const UNDERSTANDING_FEEDBACK_PROMPT =
  "Did SolenOS help you understand this situation?";

export const UNDERSTANDING_FEEDBACK_NO_PROMPTS = [
  "What did SolenOS miss?",
  "What did you expect it to understand?",
  "Was anything confusing?",
  "Is there something you expected SolenOS to notice?",
] as const;

/** Work that earns remaining credits before deploy. */
export const LEARNING_FIRST_PRIORITY = [
  "fix_crashes",
  "prevent_data_loss",
  "fix_broken_workflows",
  "every_input_reaches_lcr",
  "care_story_timeline_updates",
  "response_contract_compliance",
  "new_and_returning_care_records",
] as const;

/** Do not spend remaining credits here. */
export const LEARNING_FIRST_DEPRIORITIZE = [
  "ui_polish",
  "animations",
  "spacing_tweaks",
  "typography_refinements",
  "cosmetic_redesign",
  "visual_effects",
] as const;

export const LEARNING_FIRST_NON_NEGOTIABLES = [
  "never_fabricate_medical_information",
  "never_lose_user_data",
  "never_present_assumptions_as_facts",
  "never_make_caregivers_feel_unsafe",
] as const;
