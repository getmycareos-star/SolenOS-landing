import type {
  CARE_TIMELINE_RULES,
  FACT_STATUSES,
  MEDICAL_FACT_TYPES,
  SOURCE_CHANNELS,
  TIMELINE_EVENT_TYPES,
} from "./contract-constants";

export type TimelineEventType = (typeof TIMELINE_EVENT_TYPES)[number];
export type MedicalFactType = (typeof MEDICAL_FACT_TYPES)[number];
export type FactStatus = (typeof FACT_STATUSES)[number];
export type SourceChannel = (typeof SOURCE_CHANNELS)[number];

export type TimelineEvent = {
  id: string;
  type: TimelineEventType;
  timestamp: string;
  source: {
    channel: SourceChannel;
    raw_text: string;
    source_event_id: string;
  };
  extracted_entities: Record<string, string | string[] | null>;
  confidence: number;
  /** Abstract label — no caregiver attribution in shared view */
  abstract_label: string;
};

export type MedicalFact = {
  id: string;
  type: MedicalFactType;
  name: string;
  state: {
    value?: string;
    status: FactStatus;
  };
  provenance: string[];
  last_updated: string;
};

export type TimelineConflict = {
  conflict_id: string;
  type: "contradiction";
  field: string;
  related_events: string[];
  status: "unresolved" | "resolved";
  shared_message: string;
};

export type CareTimeline = {
  patient_id: string;
  events: TimelineEvent[];
  facts: MedicalFact[];
  conflicts: TimelineConflict[];
  evidence_graph: Record<string, string[]>;
  last_updated: string;
};

export type PatientState = {
  active_medications: MedicalFact[];
  active_conditions: MedicalFact[];
  active_symptoms: MedicalFact[];
  recent_events: TimelineEvent[];
  open_issues: TimelineConflict[];
  last_updated: string;
};

/** Primary system object — CareRecord = CareTimeline + derived PatientState */
export type CareRecord = CareTimeline & {
  patient_state: PatientState;
};

export type CareTruth = {
  current_state: PatientState;
  timeline: TimelineEvent[];
  facts: MedicalFact[];
  conflicts: TimelineConflict[];
  evidence_graph: Record<string, string[]>;
};

export type CareTimelineEngineResult = {
  active: boolean;
  care_record: CareRecord;
  care_truth: CareTruth;
  events_processed: number;
  facts_deduplicated: number;
  conflicts_detected: number;
  rules_upheld: readonly (typeof CARE_TIMELINE_RULES)[number][];
  defining_principle: string;
};

export type ProcessCareTimelineEngineInput = {
  caregiver_id: string;
  care_recipient_id: string;
  events: import("../situation-entry/types").CanonicalCareEvent[];
  events_created: import("../situation-entry/types").CanonicalCareEvent[];
  multi_caregiver?: import("../multi-caregiver-context-model/types").MultiCaregiverContextResult;
  as_of?: string;
};

export type RawEvent = {
  id: string;
  source_type: SourceChannel;
  raw_content: string;
  timestamp: string;
  canonical_event_id: string;
};
