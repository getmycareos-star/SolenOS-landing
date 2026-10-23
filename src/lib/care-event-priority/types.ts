import type { ATTENTION_STATUSES, PRIORITY_TIERS } from "./contract-constants";

export type PriorityTier = (typeof PRIORITY_TIERS)[number];
export type AttentionStatus = (typeof ATTENTION_STATUSES)[number];

/** Required scoring inputs — defaults applied when missing. */
export type CareEventPriorityInput = {
  id: string;
  timestamp: string;
  event_time: string | null;
  uncertainty: number;
  urgency: number;
  dependency_count: number;
  recency_days: number;
  attention_status: AttentionStatus;
};

export type CareEventPriority = {
  urgency: number | null;
  uncertainty: number | null;
  dependency_count: number | null;
  recency_days: number | null;
  priority_score: number | null;
  tier: PriorityTier | null;
  attention_status: AttentionStatus;
};

export type ScoredCareEvent<T extends { id: string; priority: CareEventPriority }> = T;

export type PriorityQueryResult<T> = {
  top_events: T[];
  attention_events: T[];
  all_ranked: T[];
  hidden_count: number;
};
