import type { TIMELINE_RECONSTRUCTION_RULES } from "./contract-constants";

export type ReconstructedTimelineNode = {
  node_id: string;
  observation: string;
  normalized_timestamp: string;
  temporal_confidence: number;
  ordering_confidence: number;
  ordering_label: "exact" | "approximate" | "conflict";
  source_event_id: string | null;
  source_channel: "caregiver_recall" | "direct_observation" | "inferred_correction";
  linked_temporal_nodes: string[];
  event_type: string;
};

export type OrderingConflict = {
  conflict_id: string;
  node_ids: string[];
  interpretations: string[];
  confidence: number;
};

export type TimelineReconstructionResult = {
  active: boolean;
  nodes: ReconstructedTimelineNode[];
  ordering_conflicts: OrderingConflict[];
  correction_segments_detected: number;
  uncertainty_flags: string[];
  clarification_triggers: string[];
  multi_hypothesis: boolean;
  rules_upheld: readonly (typeof TIMELINE_RECONSTRUCTION_RULES)[number][];
  defining_principle: string;
};

export type ProcessTimelineReconstructionInput = {
  caregiver_id: string;
  raw_input: string;
  events: import("../situation-entry/types").CanonicalCareEvent[];
  events_created: import("../situation-entry/types").CanonicalCareEvent[];
  as_of?: string;
};
