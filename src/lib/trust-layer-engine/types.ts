export type TrustKnownItem = {
  statement: string;
  source: string;
  source_type: "care_event" | "caregiver_input" | "document" | "care_context";
  source_event_id?: string;
};

export type TrustAssumedItem = {
  statement: string;
  reasoning_basis: string;
  source_engine: string;
};

export type TrustUnknownItem = {
  statement: string;
  drives_clarification: boolean;
};

export type TrustRecency = {
  last_updated_at: string | null;
  freshness_score: number;
  interpretation: string;
};

/** Required trust block on every caregiver-facing output. */
export type TrustLayerBlock = {
  known: TrustKnownItem[];
  assumed: TrustAssumedItem[];
  unknown: TrustUnknownItem[];
  recency: TrustRecency;
  confidence: number;
};

export type TrustLayerEngineResult = {
  active: boolean;
  trust_layer: TrustLayerBlock;
  valid: boolean;
  validation_errors: string[];
  clarification_triggered: boolean;
  rules_upheld: readonly string[];
  defining_principle: string;
};

export type ProcessTrustLayerEngineInput = {
  caregiver_id: string;
  events_created: import("../situation-entry/types").CanonicalCareEvent[];
  all_events: import("../situation-entry/types").CanonicalCareEvent[];
  what_is_uncertain: string[];
  what_needs_clarification: string[];
  trust_provenance: import("../trust-provenance/types").TrustProvenanceResult;
  behavior: import("../behavior-interpretation-engine/types").BehaviorInterpretationResult;
  continuity_decay: import("../continuity-decay-engine/types").ContinuityDecayResult;
  memory_strategy: import("../memory-strategy-engine/types").MemoryStrategyResult | undefined;
  clarification: import("../clarification-engine/types").ClarificationEngineResult | undefined;
  attention_event_ids: string[];
  as_of?: string;
};
