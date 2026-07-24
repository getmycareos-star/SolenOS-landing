import type {
  CONFIDENCE_LEVELS,
  RECONSTRUCTION_TYPES,
  TREND_VALUES,
} from "./contract-constants";
import type { JourneyEventType } from "../care-journey-graph/types";

export type ReconstructionType = (typeof RECONSTRUCTION_TYPES)[number];
export type MemoryTrend = (typeof TREND_VALUES)[number];
export type MemoryConfidence = (typeof CONFIDENCE_LEVELS)[number];

export type MemoryConcept = {
  id: string;
  label: string;
  keywords: string[];
  event_types: JourneyEventType[];
};

export type ParsedMemoryQuery = {
  raw_query: string;
  reconstruction_type: ReconstructionType;
  concepts: MemoryConcept[];
  temporal_hint: "first" | "recent" | "change" | "cause" | "compare" | null;
};

export type ReconstructedMemoryEntry = {
  event: string;
  timestamp: string;
  supporting_events: string[];
  trend: MemoryTrend;
};

export type MemoryReconstructionResult = {
  query: string;
  reconstructed_memory: ReconstructedMemoryEntry[];
  timeline_summary: string[];
  continuity_insight: string;
  confidence: MemoryConfidence;
  reconstruction_type: ReconstructionType;
  events_analyzed: number;
  causal_chain: string[];
  continuity_gaps: string[];
  correlated_events: string[];
  current_state: string | null;
};

export type ReconstructMemoryParams = {
  query: string;
  caregiver_id?: string;
  case_id?: string | null;
};

export type MemoryReconstructionLayerPayload = {
  identity: string;
  boundary: string;
  result: MemoryReconstructionResult;
};
