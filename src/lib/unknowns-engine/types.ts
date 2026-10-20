/**
 * Explicit Unknowns — disease-agnostic schema.
 * Dementia is the first clinical profile, not the engine architecture.
 */

export const UNKNOWN_PRIORITIES = ["critical", "high", "medium", "low"] as const;
export type UnknownPriority = (typeof UNKNOWN_PRIORITIES)[number];

export const UNKNOWN_STATUSES = ["unresolved", "partially_resolved", "resolved"] as const;
export type UnknownStatus = (typeof UNKNOWN_STATUSES)[number];

export const UNKNOWN_DERIVATIONS = [
  "missing_field",
  "incomplete_timeline",
  "conflict",
  "clinical_gap",
  "pattern_requirement",
] as const;

export type UnknownDerivation = (typeof UNKNOWN_DERIVATIONS)[number];

/** Full Unknown object — core reasoning primitive. */
export type ExplicitUnknown = {
  unknown_id: string;
  category: string;
  /** @deprecated use missing_information — kept for Care State compat */
  field_name: string;
  missing_information: string;
  reason_it_matters: string;
  /** alias for Care State / older callers */
  why_it_matters: string;
  clinical_or_operational_impact: string;
  impact_if_known: string;
  priority: UnknownPriority;
  confidence_impact: "blocks_recommendation" | "material" | "improves_confidence" | "informational";
  related_care_events: string[];
  related_entities: string[];
  status: UnknownStatus;
  derived_from: UnknownDerivation;
  clarification_question?: string;
};

export type ExplicitUnknownsProjection = {
  known: string[];
  inferred: string[];
  explicit_unknowns: ExplicitUnknown[];
  clinical_profile_id: string;
};

/** Profile-defined gap rule — engine applies generically. */
export type UnknownProfileRule = {
  category: string;
  missing_information: string;
  /** Trigger: observation signals present in corpus */
  trigger_pattern: RegExp;
  /** If this also matches, treat as already known / not an unknown */
  resolved_pattern?: RegExp;
  reason_it_matters: string;
  clinical_or_operational_impact: string;
  priority: UnknownPriority;
  confidence_impact: ExplicitUnknown["confidence_impact"];
  clarification_question: string;
};

export type ClinicalUnknownsProfile = {
  profile_id: string;
  label: string;
  /** Condition label for docs — engines never hardcode this string. */
  condition_label: string;
  rules: readonly UnknownProfileRule[];
  important_observation_signals: readonly string[];
};
