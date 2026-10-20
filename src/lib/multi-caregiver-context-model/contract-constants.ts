/** Multi-Caregiver Context Model — structural requirement for CareContext design. */

export const MULTI_CAREGIVER_CONTEXT_IDENTITY =
  "SolenOS constructs a single evolving CareContext from multiple private caregiver observations.";

export const MULTI_CAREGIVER_DEFINING_PRINCIPLE =
  "Shared intelligence layer over reality — not a shared communication channel.";

export const CAREGIVER_ROLES = ["family", "professional", "medical", "informal"] as const;

export const SOURCE_TYPES = ["direct_observation", "reported", "inferred"] as const;

export const CONFLICT_RESOLUTION_STATUSES = [
  "open",
  "clarification_requested",
  "preserved_both",
  "resolved",
] as const;

export const MULTI_CAREGIVER_PRIVACY_RULES = [
  "never_expose_raw_inputs_across_users",
  /** No chat feed / no dumping private notes across separate users. Shared Living Care Record may show perspective labels (G16). */
  "never_build_caregiver_chat_feed",
  "never_surface_private_raw_inputs_as_chat",
  "full_internal_auditability",
  "sensor_fusion_not_communication",
] as const;

export const MULTI_CAREGIVER_DESIGN_RULES = [
  "attribution_mandatory",
  "preserve_conflicting_perspectives",
  "never_overwrite_minority_input",
  "conflict_is_data_not_error",
  "source_weighting_future_ready",
  "no_single_user_assumptions",
  "no_anonymous_caregiver_input",
] as const;

export const DEFAULT_CARE_RECIPIENT_ID = "default_care_recipient";

export const CONTRADICTION_PATTERNS = [
  {
    type: "appetite",
    less: /\b(eating less|poor appetite|not eating|decreased appetite|appetite decline)\b/i,
    more: /\b(normal appetite|eating well|good appetite|appetite stable)\b/i,
  },
  {
    type: "mobility",
    decline: /\b(uses walker|wheelchair|fallen|fell|mobility decline)\b/i,
    stable: /\b(walks independently|no falls|mobility stable|ambulat\w* well)\b/i,
  },
] as const;

export const URGENT_INPUT_WINDOW_MINUTES = 30;
export const URGENT_INPUT_THRESHOLD = 2;
