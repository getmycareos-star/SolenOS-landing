/** Care Journey Graph — core continuity object for SolenOS. */

export const CARE_JOURNEY_GRAPH_IDENTITY =
  "Care Continuity Engine — structured events and relationships, not isolated notes.";

export const CARE_JOURNEY_GRAPH_BOUNDARY =
  "Nothing exists outside the Care Journey. AI reasons over structured events and their relationships.";

export const JOURNEY_EVENT_TYPES = [
  "diagnosis",
  "medication_started",
  "medication_stopped",
  "symptom",
  "behaviour_change",
  "appointment",
  "doctor_recommendation",
  "lab_result",
  "hospital_visit",
  "fall",
  "emergency_visit",
  "caregiver_observation",
  "question",
  "decision",
  "legal_document",
  "care_goal",
  "family_conversation",
  "insurance_update",
  "administrative",
  "other",
] as const;

export type JourneyEventType = (typeof JOURNEY_EVENT_TYPES)[number];

export const RELATIONSHIP_TYPES = [
  "caused",
  "resulted_in",
  "followed_by",
  "related_to",
  "continued_from",
  "changed_due_to",
  "recommended",
] as const;

export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

export const RESOLVED_STATUSES = ["open", "resolved", "partially_resolved", "unknown"] as const;
export type ResolvedStatus = (typeof RESOLVED_STATUSES)[number];

export const CLINICAL_IMPORTANCE_LEVELS = ["high", "moderate", "low", "informational"] as const;
export type ClinicalImportance = (typeof CLINICAL_IMPORTANCE_LEVELS)[number];

export type JourneyEvidence = {
  source: string;
  reference?: string;
  document_ids?: string[];
};

export type JourneyGraphEvent = {
  id: string;
  journey_id: string;
  caregiver_id: string;
  case_id: string | null;
  event_type: JourneyEventType;
  timestamp: string;
  description: string;
  people_involved: string[];
  location: string | null;
  evidence: JourneyEvidence;
  related_event_ids: string[];
  clinical_importance: ClinicalImportance;
  open_questions: string[];
  resolved_status: ResolvedStatus;
  source: string;
  category: string;
  title: string;
  attachments: { id: string; name: string; mime_type?: string }[];
  metadata: Record<string, unknown>;
  created_at: string;
};

export type JourneyRelationship = {
  id: string;
  journey_id: string;
  from_event_id: string;
  to_event_id: string;
  relationship_type: RelationshipType;
  note: string;
  created_at: string;
};

export type CareJourneyGraph = {
  journey_id: string;
  caregiver_id: string;
  case_id: string | null;
  events: JourneyGraphEvent[];
  relationships: JourneyRelationship[];
  updated_at: string;
};

export type ContinuityPattern = {
  pattern_note: string;
  event_ids: string[];
  confidence: "evidence_backed" | "needs_confirmation";
};

export type ContinuityAssessment = {
  what_changed_since_last: string[];
  patterns_detected: ContinuityPattern[];
  open_questions: string[];
  unresolved_items: string[];
  continuity_notes: string[];
  linked_to_existing: boolean;
  suggested_connection_questions: string[];
};

export type CareJourneyPipelineResult = {
  graph: CareJourneyGraph;
  event: JourneyGraphEvent;
  new_relationships: JourneyRelationship[];
  continuity: ContinuityAssessment;
  completeness_status: "COMPLETE" | "PARTIALLY_COMPLETE" | "INSUFFICIENT";
  facts_only_summary: string;
  reasoning_ready: boolean;
};

export type IngestJourneyInputParams = {
  description: string;
  caregiver_id?: string;
  case_id?: string | null;
  source?: string;
  timestamp?: string;
  attachments?: { id: string; name: string; mime_type?: string }[];
  metadata?: Record<string, unknown>;
};

/** Layer payload for analyze pipeline and UI — continuity context, not chat. */
export type CareJourneyGraphLayerPayload = {
  identity: string;
  boundary: string;
  journey_id: string;
  event_id: string;
  event_type: JourneyEventType;
  completeness_status: CareJourneyPipelineResult["completeness_status"];
  facts_only_summary: string;
  reasoning_ready: boolean;
  new_relationships: JourneyRelationship[];
  continuity: ContinuityAssessment;
  recent_event_count: number;
};
