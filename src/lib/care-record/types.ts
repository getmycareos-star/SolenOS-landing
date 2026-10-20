/**
 * Continuous Care Record — structured event types.
 * Foundation object: every meaningful occurrence becomes a structured care event.
 */

export const CONTINUOUS_CARE_EVENT_TYPES = [
  "observation",
  "appointment",
  "specialist_visit",
  "hospital_admission",
  "hospital_discharge",
  "medication_change",
  "symptom",
  "fall",
  "emergency_visit",
  "therapy_session",
  "insurance_call",
  "family_decision",
  "caregiver_note",
  "behavior",
  "task",
  "unknown",
] as const;

export type ContinuousCareEventType = (typeof CONTINUOUS_CARE_EVENT_TYPES)[number];

export const OUTCOME_STATUSES = ["pending", "resolved", "worsened", "unchanged"] as const;
export type OutcomeStatus = (typeof OUTCOME_STATUSES)[number];

export type CareDocumentRef = {
  id: string;
  name: string;
  mime_type?: string;
  extracted_preview?: string;
};

export type CareEventOutcome = {
  status: OutcomeStatus;
  summary: string;
  recorded_at: string;
};

/** Structured fields extracted from messy caregiver input or documents. */
export type StructuredCareEvent = {
  event_type: ContinuousCareEventType;
  date: string;
  people_involved: string[];
  summary: string;
  decisions_made: string[];
  actions_required: string[];
  follow_up_date: string | null;
  symptoms_mentioned: string[];
  documents_attached: CareDocumentRef[];
  watch_for: string[];
  outcome: CareEventOutcome | null;
  /** Event → Decision → Outcome linkage */
  parent_event_id: string | null;
  related_event_ids: string[];
};

export type CareRecordTimelineEntry = {
  id: string;
  event_type: ContinuousCareEventType;
  date: string;
  created_at: string;
  content: string;
  source_type: string;
  structured: StructuredCareEvent;
};

export type CareRecordSearchResult = {
  query: string;
  matches: CareRecordTimelineEntry[];
  total_in_record: number;
};

export type HistoricalContextMatch = {
  event_id: string;
  event_type: ContinuousCareEventType;
  date: string;
  summary: string;
  relevance_note: string;
  structured: StructuredCareEvent;
};

export type HistoricalContextResult = {
  query: string;
  matches: HistoricalContextMatch[];
  evidence_backed: true;
};

export type RecordOutcomeInput = {
  event_id: string;
  status: OutcomeStatus;
  summary: string;
  caregiver_id?: string;
};
