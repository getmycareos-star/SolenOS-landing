import type { CHANGE_TYPES, CONTRADICTION_DETECTION_RULES } from "./contract-constants";

export type ChangeType = (typeof CHANGE_TYPES)[number];

export type TransitionEvent = {
  transition_id: string;
  from_state: string;
  to_state: string;
  evidence: string[];
  type: ChangeType;
  confidence: number;
  linked_events: string[];
  contradiction_flag: boolean;
  recorded_at: string;
};

export type OpenContradiction = {
  contradiction_id: string;
  field: string;
  event_ids: string[];
  both_preserved: true;
  shared_message: string;
  affects_safety: boolean;
};

export type ContradictionDetectionResult = {
  active: boolean;
  transitions: TransitionEvent[];
  open_contradictions: OpenContradiction[];
  clarification_triggers: string[];
  change_classifications: { event_id: string; change_type: ChangeType; label: string }[];
  events_preserved_count: number;
  rules_upheld: readonly (typeof CONTRADICTION_DETECTION_RULES)[number][];
  defining_principle: string;
};

export type ProcessContradictionDetectionInput = {
  caregiver_id: string;
  care_recipient_id: string;
  events: import("../situation-entry/types").CanonicalCareEvent[];
  events_created: import("../situation-entry/types").CanonicalCareEvent[];
  care_timeline?: import("../care-timeline-engine/types").CareTimelineEngineResult;
  as_of?: string;
};
