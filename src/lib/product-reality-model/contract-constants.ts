/** Product Reality Model — operating assumptions for fragmented, contradictory care environments. */

export const PRODUCT_REALITY_MODEL_IDENTITY =
  "SolenOS is a contradiction-tolerant, event-driven coordination system for fragmented caregiver environments.";

export const PRODUCT_REALITY_DEFINING_PRINCIPLE =
  "Build for exhaustion, randomness, contradiction, and incomplete information as default conditions.";

export const OPERATING_ASSUMPTIONS = [
  "users_are_exhausted",
  "input_is_random",
  "contradiction_is_normal",
  "state_is_incomplete",
] as const;

export const WRONG_MODEL_PROHIBITIONS = [
  "clean_user_profiles_as_primary",
  "structured_onboarding_required",
  "complete_datasets_expected",
  "deterministic_healthcare_records",
  "manual_state_authoring",
  "silent_conflict_overwrite",
] as const;

export const CORRECT_MODEL_RULES = [
  "event_first_not_form_first",
  "state_is_derived",
  "conflict_is_first_class",
  "missing_data_explicit",
  "probabilistic_care_state",
] as const;

export const REALITY_MODEL_RULES = [
  ...OPERATING_ASSUMPTIONS,
  ...CORRECT_MODEL_RULES,
] as const;

export const FAILURE_MODES = [
  "assumes_clean_input",
  "hides_contradictions",
  "forces_structured_onboarding",
  "over_summarizes_into_false_certainty",
  "deletes_conflicting_data",
] as const;
