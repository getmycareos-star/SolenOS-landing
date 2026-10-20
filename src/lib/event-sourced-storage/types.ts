import type {
  EVENT_SOURCED_STORAGE_RULES,
  STORAGE_LAYERS,
} from "./contract-constants";

export type StorageLayer = (typeof STORAGE_LAYERS)[number];

export type StoredCareEventRecord = {
  event_id: string;
  care_recipient_id: string;
  caregiver_id: string;
  raw_observation: string;
  normalized_type: string;
  source_id: string;
  confidence: number;
  timestamp: string;
  linked_entities: string[];
  append_seq: number;
};

export type CareContextProjection = {
  projection_id: string;
  care_recipient_id: string;
  rebuilt_from_event_count: number;
  rebuilt_at: string;
  current_state_summary: string[];
  active_issues: string[];
  unresolved_contradictions: number;
  confidence_summary: number;
  event_ids: string[];
};

export type SessionStoreRecord = {
  caregiver_id: string;
  last_visit_at: string | null;
  event_count_at_visit: number;
  engagement_state: "new" | "return" | "inactive" | "active";
  last_projection_id: string | null;
  visit_count: number;
};

export type DerivedTableRecord = {
  table_key: string;
  rebuilt_at: string;
  disposable: true;
  payload: Record<string, unknown>;
};

export type EventSourcedStorageResult = {
  active: boolean;
  layers_present: StorageLayer[];
  event_count: number;
  projection: CareContextProjection | null;
  session: SessionStoreRecord | null;
  can_rebuild_projection: boolean;
  mutation_blocked: true;
  rules_upheld: readonly (typeof EVENT_SOURCED_STORAGE_RULES)[number][];
  defining_principle: string;
};

export type ProcessEventSourcedStorageInput = {
  care_recipient_id: string;
  caregiver_id: string;
  events: Array<{
    id: string;
    raw_input: string;
    extracted_type: string;
    ingestion_time: string;
    entities: Array<{ label: string }>;
    uncertainty: string[];
  }>;
  as_of?: string;
};
