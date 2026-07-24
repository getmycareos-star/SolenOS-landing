import type {
  CARE_EVENT_STATUSES,
  CONFIDENCE_LEVELS,
  INTEGRITY_CORRECTION_TYPES,
  TRUTH_SOURCE_PRIORITY,
} from "./contract-constants";

export type CareEventLifecycleStatus = (typeof CARE_EVENT_STATUSES)[number];
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];
export type TruthSource = (typeof TRUTH_SOURCE_PRIORITY)[number];
export type IntegrityCorrectionType = (typeof INTEGRITY_CORRECTION_TYPES)[number];

export type FieldConfidence = {
  extraction: ConfidenceLevel;
  user_confirmed: boolean;
};

export type EventAuditEntry = {
  id: string;
  event_id: string;
  caregiver_id: string;
  action: IntegrityCorrectionType | "retime" | "confirm" | "create_provisional" | "create_unparsed";
  previous_snapshot: Record<string, unknown> | null;
  updated_snapshot: Record<string, unknown> | null;
  reason: string | null;
  user_source: string;
  created_at: string;
};

export type CareEventIntegrity = {
  field_confidence: {
    extracted_fact: FieldConfidence;
    event_time: FieldConfidence;
  };
  sources: TruthSource[];
  superseded_by_id: string | null;
  supersedes_id: string | null;
  original_extraction: string | null;
  correction_count: number;
  audit_trail_ids: string[];
};
