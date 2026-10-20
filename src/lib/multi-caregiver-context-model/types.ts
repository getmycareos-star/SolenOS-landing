import type {
  CAREGIVER_ROLES,
  CONFLICT_RESOLUTION_STATUSES,
  SOURCE_TYPES,
} from "./contract-constants";

export type CaregiverRole = (typeof CAREGIVER_ROLES)[number];
export type SourceType = (typeof SOURCE_TYPES)[number];
export type ConflictResolutionStatus = (typeof CONFLICT_RESOLUTION_STATUSES)[number];

export type CaregiverReliabilityProfile = {
  reliability_score: number;
  observation_count: number;
  last_contribution_at: string | null;
};

export type CaregiverProfile = {
  caregiver_id: string;
  name: string | null;
  relationship_to_care_recipient: string | null;
  role: CaregiverRole;
  contact_info: string | null;
  reliability_profile: CaregiverReliabilityProfile;
};

export type CareEventSourceAttribution = {
  caregiver_id: string;
  care_recipient_id: string;
  source_type: SourceType;
  observed_at: string;
  ingestion_context: string | null;
};

export type AttributionMapEntry = {
  event_id: string;
  caregiver_id: string;
  care_recipient_id: string;
  source_type: SourceType;
  recorded_at: string;
};

export type SourceConfidenceProfile = {
  caregiver_id: string;
  domain: string;
  confidence_weight: number;
  basis: string;
};

export type MultiCaregiverConflict = {
  conflict_id: string;
  event_ids: string[];
  /** Internal only — never exposed in shared caregiver UI */
  conflicting_sources: string[];
  contradiction_type: string;
  resolution_status: ConflictResolutionStatus;
  /** Internal audit description with source linkage */
  description: string;
  /** Fused message for shared CareContext — no attribution */
  shared_abstract_message: string;
  recorded_at: string;
};

export type MultiCaregiverCareContext = {
  care_recipient_id: string;
  care_recipient_label: string | null;
  caregivers: CaregiverProfile[];
  attribution_map: AttributionMapEntry[];
  source_confidence_profiles: SourceConfidenceProfile[];
  conflict_log: MultiCaregiverConflict[];
};

export type SharedRealityState = import("./fusion-engine").SharedRealityState;

export type MultiCaregiverContextResult = {
  active: boolean;
  care_recipient_id: string;
  /** Shared fused view — safe for all authorized caregivers */
  shared_reality: SharedRealityState;
  /** Internal attribution — system layers only, never shared UI */
  attribution_internal_only: true;
  caregivers: CaregiverProfile[];
  attribution_map: AttributionMapEntry[];
  source_confidence_profiles: SourceConfidenceProfile[];
  conflict_log: MultiCaregiverConflict[];
  events_attributed: number;
  conflicts_detected: number;
  attribution_enforced: boolean;
  /** Shared-safe clarification prompts — no caregiver attribution */
  clarification_needed: string[];
  rules_upheld: readonly string[];
  defining_principle: string;
};

export type ProcessMultiCaregiverContextInput = {
  caregiver_id: string;
  care_recipient_id?: string;
  caregiver_role?: CaregiverRole;
  caregiver_name?: string | null;
  relationship_to_care_recipient?: string | null;
  events_created: import("../situation-entry/types").CanonicalCareEvent[];
  all_events: import("../situation-entry/types").CanonicalCareEvent[];
  what_changed?: string[];
  as_of?: string;
};
