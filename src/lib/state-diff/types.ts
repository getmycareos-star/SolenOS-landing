/**
 * State-Diff Engine — deterministic change detection for care state.
 *
 * Architecture:
 *   Evidence -> ExtractedClaim -> Source Pointer Validation -> Self-Consistency Gate
 *     -> Structured Care State -> CODE-BASED STATE COMPARISON -> ChangeRecord
 *     -> OPTIONAL LLM PHRASING
 *
 * The LLM is never responsible for detecting the change.
 */

import type { ConfidenceTag } from "../claim-consistency/types";

export type StateDomain =
  | "medication"
  | "cognition"
  | "function"
  | "behavior"
  | "safety"
  | "appointments"
  | "providers"
  | "care_setting";

export type StateField = {
  value: string;
  as_of: string;
  confidence_tag: ConfidenceTag;
  source_claim_id: string;
};

export type ChangeType = "new" | "changed" | "backfilled";

export type ChangeRecord = {
  id: string;
  person_id: string;
  domain: StateDomain;
  field: string;
  previous_value: StateField | null;
  new_value: StateField;
  detected_at: string;
  change_type: ChangeType;
};

export type StateHistoryEntry = {
  id: string;
  person_id: string;
  domain: StateDomain;
  field: string;
  value: string;
  confidence_tag: ConfidenceTag;
  source_claim_id: string;
  as_of: string;
  replaced_at: string;
  change_id: string | null;
};

export type StateModel = {
  person_id: string;
  domain: StateDomain;
  field: string;
  value: string;
  confidence_tag: ConfidenceTag;
  source_claim_id: string;
  as_of: string;
  updated_at: string;
};

export type CompareStateInput = {
  person_id: string;
  domain: StateDomain;
  field: string;
  incoming_value: string;
  incoming_event_time: string;
  incoming_confidence: ConfidenceTag;
  incoming_claim_id: string;
};

export type CompareStateResult = {
  change: ChangeRecord | null;
  updated_state: StateModel | null;
  history_entry?: StateHistoryEntry | null;
  reason?: string;
};

export type StateDiffEngineOptions = {
  now?: () => Date;
};
