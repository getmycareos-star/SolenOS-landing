/** Trust Layer Engine — epistemic safety contract for every caregiver-facing output. */

export const TRUST_LAYER_ENGINE_IDENTITY =
  "No recommendation is valid unless the user can see how SolenOS knows it.";

export const TRUST_LAYER_DEFINING_PRINCIPLE =
  "Every output must show what is known, what is assumed, and what is missing.";

export const TRUST_BEHAVIOR_RULES = [
  "no_hidden_reasoning",
  "no_silent_uncertainty_collapse",
  "no_overconfidence_masking",
  "trust_drives_prioritization",
  "trust_layer_updates_over_time",
] as const;

export const TRUST_DESIGN_PRINCIPLES = [
  "known_must_be_sourced",
  "assumed_must_be_labeled",
  "unknown_must_be_surfaced",
  "recency_never_treats_stale_as_current",
  "confidence_never_hidden",
  "never_output_full_confidence_without_verification",
  "low_confidence_allowed_and_expected",
  "trust_exposes_epistemic_state_not_replace_engines",
] as const;

/** Freshness interpretation bands (0.0–1.0). */
export const FRESHNESS_BANDS = {
  fresh: { min: 0.85, label: "fresh (<24h typical)" },
  moderate: { min: 0.5, label: "moderately stale (2–7 days)" },
  stale: { min: 0, label: "potentially outdated (>7–14 days)" },
} as const;

export const CLARIFICATION_CONFIDENCE_THRESHOLD = 0.45;
