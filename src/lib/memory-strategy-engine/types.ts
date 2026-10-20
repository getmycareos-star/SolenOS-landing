import type { MEMORY_TIERS } from "./contract-constants";

export type MemoryTier = (typeof MEMORY_TIERS)[number];

export type MemoryRecord = {
  id: string;
  source_event_id: string;
  label: string;
  tier: MemoryTier;
  confidence_pct: number;
  created_at: string;
  last_confirmed_at: string | null;
  expires_at: string | null;
  status: "active" | "archived" | "expired" | "promoted" | "demoted";
  evidence_event_ids: string[];
  why_remembered: string;
  what_would_invalidate: string;
  promotion_eligible: boolean;
};

export type MemoryTransition = {
  transition_id: string;
  memory_id: string;
  from_state: string;
  to_state: string;
  reason: string;
  source_event_id: string;
  recorded_at: string;
};

export type MemoryConflict = {
  conflict_id: string;
  existing_memory_id: string;
  new_event_id: string;
  description: string;
  resolution: "preserve_history" | "transition_recorded" | "clarification_needed";
};

export type CompressedTrend = {
  trend_id: string;
  label: string;
  event_count: number;
  source_event_ids: string[];
  narrative: string;
};

export type PersonalMemoryHint = {
  hint_id: string;
  category: "communication" | "routine" | "trigger" | "calming" | "preference" | "location";
  label: string;
  confidence_pct: number;
};

export type MemoryStrategyResult = {
  active: boolean;
  records_classified: MemoryRecord[];
  transitions: MemoryTransition[];
  conflicts: MemoryConflict[];
  promotions: string[];
  demotions: string[];
  expirations: string[];
  reinforcements: string[];
  compressed_trends: CompressedTrend[];
  current_status_summary: string[];
  personal_memory_hints: PersonalMemoryHint[];
  retrieval_priority: Array<{ memory_id: string; score: number; reason: string }>;
  explainable_facts: Array<{
    label: string;
    tier: MemoryTier;
    confidence_pct: number;
    why_remembered: string;
    last_confirmed_at: string | null;
    source_event_ids: string[];
  }>;
  tier_counts: Record<MemoryTier, number>;
  principles_upheld: readonly string[];
  defining_principle: string;
};

export type ProcessMemoryStrategyInput = {
  caregiver_id: string;
  events_created: import("../situation-entry/types").CanonicalCareEvent[];
  all_events: import("../situation-entry/types").CanonicalCareEvent[];
  as_of?: string;
};
