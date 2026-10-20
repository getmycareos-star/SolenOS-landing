/** Audit Trail System — immutable versioned reality recorder. */

export const AUDIT_TRAIL_IDENTITY =
  "SolenOS does not just store the current state of care. It stores the entire history of how that state evolved.";

export const AUDIT_TRAIL_DEFINING_PRINCIPLE =
  "No state change is valid unless it is explainable, attributable, and historically recoverable.";

export const AUDIT_ACTORS = ["caregiver", "system", "ai_engine", "clinician"] as const;

export const AUDIT_ACTION_TYPES = [
  "create",
  "update",
  "delete",
  "merge",
  "infer",
  "correct",
] as const;

export const AUDIT_REASONS = [
  "explicit_user_input",
  "system_inference",
  "clarification_response",
  "pattern_update",
  "contradiction_resolution",
  "external_clinical_record",
  "carecontext_recompute",
] as const;

export const CONFLICT_RELATIONSHIPS = ["correction", "contradiction", "refinement"] as const;

export const AUDIT_IMMUTABILITY_RULES = [
  "append_only",
  "never_delete",
  "never_overwrite",
  "corrections_are_new_entries",
  "audit_integrity_wins_over_performance",
] as const;
