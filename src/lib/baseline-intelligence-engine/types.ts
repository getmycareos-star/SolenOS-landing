import type {
  BASELINE_DOMAINS,
  BASELINE_INTELLIGENCE_RULES,
} from "./contract-constants";

export type BaselineDomain = (typeof BASELINE_DOMAINS)[number];

export type BaselineFact = {
  domain: BaselineDomain;
  label: string;
  source_event_ids: string[];
  first_observed_at: string;
  last_observed_at: string;
  observation_count: number;
  confidence: "low" | "medium" | "high";
  /** Per-domain trajectory across observations. */
  trajectory?: "stable" | "worsening" | "improving" | "unknown";
  /** Weight based on how recent this baseline is (0-1). */
  recency_weight?: number;
};

export type BaselineDeviation = {
  domain: BaselineDomain;
  observation: string;
  deviation_type: "new" | "escalation" | "return" | "pattern_shift" | "improvement";
  compared_to_baseline: string;
  source_event_id: string;
  is_unusual_for_person: boolean;
  confidence: "low" | "medium" | "high";
  /** Whether the deviation is an escalation, improvement, or unknown. */
  deviation_direction?: "escalation" | "improvement" | "unknown";
};

export type BaselineIntelligenceResult = {
  active: boolean;
  baseline_established: boolean;
  baseline_facts: BaselineFact[];
  deviations: BaselineDeviation[];
  comparison_question: string;
  rules_upheld: readonly (typeof BASELINE_INTELLIGENCE_RULES)[number][];
  defining_principle: string;
};

export type ProcessBaselineIntelligenceInput = {
  caregiver_id: string;
  care_recipient_id: string;
  events_created: import("../situation-entry/types").CanonicalCareEvent[];
  all_events: import("../situation-entry/types").CanonicalCareEvent[];
  raw_input: string;
  as_of?: string;
};
