import type { EventIdentityResolution, EvidenceRelation, EventIdentityFailureLabel } from "./contract-constants";

/** Incoming evidence/item to be classified against existing events. */
export type IncomingEvidence = {
  id: string;
  content: string;
  source_id: string;
  source_type: "caregiver_note" | "document" | "chat_message" | "manual_entry" | "lab_result" | "measurement";
  captured_at: string;
  person_id: string;
  extracted_type?: string;
  entities?: string[];
  attributes?: Record<string, unknown>;
  document_id?: string;
  document_version?: number;
  metadata?: Record<string, unknown>;
};

/** Existing event in the care record. */
export type ExistingEvent = {
  id: string;
  event_type: string;
  label: string;
  content: string;
  occurred_at: string | null;
  created_at: string;
  person_id: string;
  source_id: string;
  source_type: string;
  entities: string[];
  attributes: Record<string, unknown>;
  evidence_ids: string[];
  document_id?: string;
  document_version?: number;
  status: string;
  confidence: number;
  uncertainty?: string[];
  recurrence_count?: number;
  superseded_by?: string;
  supersedes?: string;
};

/** Result of identity resolution for one incoming evidence item. */
export type IdentityResolutionResult = {
  incoming_id: string;
  resolution: EventIdentityResolution;
  confidence: number;
  matched_event_id: string | null;
  evidence_relation: EvidenceRelation | null;
  reasoning: string;
  failure_labels: EventIdentityFailureLabel[];
  requires_clarification: boolean;
  clarification_question?: string;
  /** Provenance: all evidence sources for the resolved event */
  combined_evidence: string[];
  /** If update: what fields were enriched */
  enriched_fields?: string[];
};

/** Batch resolution result. */
export type BatchIdentityResolution = {
  resolutions: IdentityResolutionResult[];
  new_events: IncomingEvidence[];
  updated_events: { event_id: string; enriched_fields: string[] }[];
  merged_events: { kept_id: string; merged_ids: string[] }[];
  ambiguous_items: { incoming_id: string; question: string }[];
  failure_instances: { label: EventIdentityFailureLabel; context: string }[];
  updated_existing_events: ExistingEvent[];
};

/** Event identity context for longitudinal tracking. */
export type EventIdentityContext = {
  person_id: string;
  existing_events: ExistingEvent[];
  recent_evidence: IncomingEvidence[];
  document_versions: Map<string, { versions: number[]; latest_content_hash: string }>;
  caregiver_reports: Map<string, { last_content: string; last_time: string; count: number }>;
};

/** Normalized event attributes for comparison. */
export type NormalizedEventAttributes = {
  person_id: string;
  event_type: string;
  event_subtype?: string;
  location?: string;
  participants?: string[];
  circumstances?: string;
  associated_symptoms?: string[];
  associated_injuries?: string[];
  source_id: string;
  source_type: string;
  document_id?: string;
  document_version?: number;
  measurement_value?: number;
  measurement_unit?: string;
  temporal_markers?: string[];
  causal_markers?: string[];
};

/** Document version tracking. */
export type DocumentVersionRecord = {
  document_id: string;
  version: number;
  content_hash: string;
  captured_at: string;
  extracted_events: string[]; // event IDs extracted from this version
  is_draft: boolean;
  is_correction: boolean;
  supersedes_version?: number;
};