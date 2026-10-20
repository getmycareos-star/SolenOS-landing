/** Care Transparency Layer — no output is valid unless reasoning is visible. */

export const CARE_TRANSPARENCY_IDENTITY =
  "Solenos does not ask for trust. It earns it through visibility of reasoning.";

export const CARE_TRANSPARENCY_DEFINING_PRINCIPLE =
  "Every output is invalid if it does not include a complete Care Transparency Panel.";

export const EVIDENCE_TYPES = [
  "observation",
  "inference",
  "external_report",
  "system_pattern",
] as const;

export const CONFIDENCE_TIERS = ["high", "medium", "low"] as const;

export const DECAY_STATUSES = ["fresh", "aging", "stale"] as const;

export const TRANSPARENCY_RULES = [
  "data_used_explicit",
  "data_ignored_explicit",
  "observation_inference_split",
  "confidence_on_key_statements",
  "recency_visible",
  "no_hidden_inference",
] as const;
