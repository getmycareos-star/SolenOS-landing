/**
 * Privacy + Institutional readiness — architectural contracts on CareEvents.
 * Families first. Institutions = future projections of the SAME CareContext.
 * DO NOT fork CareContext for institutions.
 */

export const ACTOR_ROLES = [
  "primary_caregiver",
  "secondary_caregiver",
  "professional_caregiver",
  "clinician",
  "institutional_observer",
] as const;

export type ActorRole = (typeof ACTOR_ROLES)[number];

export const SENSITIVITY_LEVELS = ["low", "medium", "high"] as const;
export type SensitivityLevel = (typeof SENSITIVITY_LEVELS)[number];

/** Attached to CareEvents — access/presentation metadata, never CareContext structure. */
export type CareEventPrivacyMeta = {
  visibility_roles: ActorRole[];
  ownership_scope: string;
  sensitivity_level: SensitivityLevel;
  purpose_tags: string[];
  consent_present: boolean;
};

export const PRIVACY_ARCHITECTURE_RULES = [
  "data_minimization_for_care_context_only",
  "no_engine_bypass_of_privacy_gateway",
  "raw_input_highest_restriction",
  "roles_do_not_change_care_facts",
  "care_context_never_forked_for_institutions",
  "encryption_baseline_assumption",
  "export_and_erasure_user_controlled",
  "no_cross_family_raw_data",
  "hipaa_not_claimed_without_legal_technical_met",
] as const;

export const INSTITUTIONAL_READINESS_RULES = [
  "single_core_care_event_model",
  "institutions_are_projection_layers_only",
  "roles_are_metadata_not_structure",
  "events_must_be_exportable_and_self_contained",
  "no_hospital_mode_fork",
  "no_parallel_ingestion_pipelines",
] as const;

export function defaultPrivacyMeta(input: {
  ownership_scope: string;
  is_document?: boolean;
  consent_present?: boolean;
}): CareEventPrivacyMeta {
  return {
    visibility_roles: ["primary_caregiver", "secondary_caregiver"],
    ownership_scope: input.ownership_scope,
    sensitivity_level: input.is_document ? "high" : "medium",
    purpose_tags: ["care_continuity"],
    consent_present: input.consent_present ?? true,
  };
}

/** FUTURE: filter events for role — does not mutate underlying store. */
export function filterEventsForRole<T extends { privacy?: CareEventPrivacyMeta }>(
  events: T[],
  role: ActorRole,
): T[] {
  return events.filter((e) => {
    if (!e.privacy) return role === "primary_caregiver";
    return e.privacy.visibility_roles.includes(role);
  });
}
