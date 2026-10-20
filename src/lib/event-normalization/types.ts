import type { ATOMIC_EVENT_TYPES } from "./contract-constants";
import type { EventTime } from "../time-model/types";

export type AtomicEventType = (typeof ATOMIC_EVENT_TYPES)[number];

export type ConfidenceTier = "auto_commit" | "needs_review" | "quarantine";

export type EventStatus =
  | "committed"
  | "needs_user_confirmation"
  | "needs_review"
  | "quarantined"
  | "merged"
  | "updated"
  | "attached";

export type UncertaintyRecord = {
  field: string;
  created_at: string;
  resolved: boolean;
  resolved_at: string | null;
  resolution_source: "user_input" | "new_document" | "inferred_confirmation" | null;
};

export type NormalizedAtomicEvent = {
  id: string;
  atomic_type: AtomicEventType;
  label: string;
  source_text: string;
  confidence: number;
  confidence_tier: ConfidenceTier;
  status: EventStatus;
  entities: string[];
  attributes: Record<string, unknown>;
  uncertainty: UncertaintyRecord[];
  attached_fragments: string[];
  merged_from_ids: string[];
  updated_event_id: string | null;
  raw_input_id: string;
  candidate_id: string | null;
  /** Temporal sort key — derived from event_time */
  timestamp: string;
  event_time: EventTime;
  /** Immutable — when system received this input */
  ingestion_time: string;
  needs_review: boolean;
};

export type NormalizationAction = {
  action: "split" | "merge" | "attach" | "update" | "quarantine" | "commit";
  description: string;
  event_ids: string[];
};

export type NormalizationResult = {
  committed: NormalizedAtomicEvent[];
  quarantined: NormalizedAtomicEvent[];
  needs_review: NormalizedAtomicEvent[];
  unprocessed: NormalizedAtomicEvent[];
  actions: NormalizationAction[];
  clarification_question: string | null;
  could_not_process: boolean;
};

export type PreNormalizedText = {
  original: string;
  normalized: string;
  fixes_applied: string[];
};
