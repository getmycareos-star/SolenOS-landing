/** Unified CareEvent — input-method agnostic caregiver knowledge record. */

export const CARE_EVENT_SOURCE_TYPES = [
  "voice",
  "text",
  "document",
  "photo",
  "message",
] as const;

export type CareEventSourceType = (typeof CARE_EVENT_SOURCE_TYPES)[number];

export const CARE_EVENT_TYPES = [
  "observation",
  "fall",
  "medication_change",
  "symptom",
  "appointment",
  "behavior",
  "task",
  "unknown",
] as const;

export type CareEventType = (typeof CARE_EVENT_TYPES)[number];

export const UNCERTAINTY_LEVELS = ["low", "medium", "high"] as const;

export type UncertaintyLevel = (typeof UNCERTAINTY_LEVELS)[number];

/** How evidence was collected — attribution only; never branches reasoning. */
export type InputEntryMethod =
  | "scan"
  | "snap"
  | "upload"
  | "share"
  | "text"
  | "voice";

/** Input provenance from the capture UI — flows into CareEvent + event_sources. */
export type InputProvenance = {
  input_type: "voice" | "text" | "document";
  /** Input Entry Contract method. Stored for evidence; must not change SRE/understanding. */
  entry_method?: InputEntryMethod;
  captured_at?: string;
  recognition_confidence?: number | null;
  transcript_uncertain?: boolean;
};

export type EventSourceRecord = {
  id: string;
  care_event_id: string;
  source_type: CareEventSourceType;
  captured_at: string;
  recognition_confidence: number | null;
  transcript_uncertain: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type CareEventRecord = {
  id: string;
  care_record_id: string | null;
  event_type: CareEventType;
  content: string;
  occurred_at: string | null;
  created_at: string;
  source_type: CareEventSourceType;
  confidence: number | null;
  uncertainty_level: UncertaintyLevel | null;
  created_by: string | null;
  metadata: Record<string, unknown>;
  source?: EventSourceRecord;
};

export type CreateCareEventInput = {
  content: string;
  care_record_id?: string | null;
  event_type?: CareEventType;
  occurred_at?: string | null;
  created_by?: string | null;
  provenance: InputProvenance;
  metadata?: Record<string, unknown>;
};

export type CreateCareEventResult = {
  care_event: CareEventRecord;
};
