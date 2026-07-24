import type {
  CONTINUITY_SUMMARY_KINDS,
  EPISODE_KINDS,
  EPISODE_STATUS,
  MEMORY_LAYER_IDS,
  RETRIEVAL_PRIORITY_ORDER,
} from "./contract-constants";

export type MemoryLayerId = (typeof MEMORY_LAYER_IDS)[number];
export type EpisodeKind = (typeof EPISODE_KINDS)[number];
export type EpisodeStatus = (typeof EPISODE_STATUS)[number];
export type ContinuitySummaryKind = (typeof CONTINUITY_SUMMARY_KINDS)[number];
export type RetrievalPriority = (typeof RETRIEVAL_PRIORITY_ORDER)[number];

/** Layer 1 — permanent raw event reference (never deleted). */
export type RawEventRef = {
  layer: "raw_event";
  event_id: string;
  timestamp: string;
  ingestion_time: string;
  extracted_type: string;
  status: string;
  source: string;
  document_id: string | null;
  preserved: true;
};

/** Layer 2 — structured relationship in working context. */
export type ContinuityLink = {
  id: string;
  from_event_id: string;
  to_event_id: string;
  link_type:
    | "follow_up"
    | "decision_chain"
    | "responsibility"
    | "document"
    | "recurring_issue"
    | "monitoring_topic"
    | "related";
  note: string;
  created_at: string;
};

export type StructuredContinuityLayer = {
  layer: "structured_continuity";
  caregiver_id: string;
  links: ContinuityLink[];
  root_event_id: string | null;
  updated_at: string;
};

/** Layer 3 — episode grouping over raw events. */
export type CareEpisode = {
  id: string;
  layer: "episode";
  caregiver_id: string;
  title: string;
  kind: EpisodeKind;
  status: EpisodeStatus;
  event_ids: string[];
  started_at: string;
  ended_at: string | null;
  summary: string;
  /** Always traceable back to Layer 1 */
  source_event_ids: string[];
  created_at: string;
  updated_at: string;
};

/** Layer 4 — derived long-term continuity (never replaces raw data). */
export type LongTermContinuitySummary = {
  id: string;
  layer: "long_term_continuity";
  caregiver_id: string;
  kind: ContinuitySummaryKind;
  title: string;
  narrative: string;
  episode_ids: string[];
  event_ids: string[];
  derived_at: string;
  reversible: true;
};

/** Hierarchical graph view for UI — episodes contain events. */
export type HierarchicalMemoryGraph = {
  caregiver_id: string;
  episodes: Array<{
    episode: CareEpisode;
    events: RawEventRef[];
  }>;
  ungrouped_recent: RawEventRef[];
  long_term_summaries: LongTermContinuitySummary[];
  total_raw_events: number;
};

export type MemoryLayerStore = {
  caregiver_id: string;
  raw_event_refs: RawEventRef[];
  structured: StructuredContinuityLayer;
  episodes: CareEpisode[];
  long_term_summaries: LongTermContinuitySummary[];
  active_episode_id: string | null;
  updated_at: string;
};

export type RetrievalBundle = {
  active_episode: CareEpisode | null;
  recent_events: RawEventRef[];
  open_follow_ups: RawEventRef[];
  unresolved_questions: string[];
  historical_episodes: CareEpisode[];
  long_term_summaries: LongTermContinuitySummary[];
  /** Included only when explicitly requested */
  raw_events_on_demand: RawEventRef[] | null;
  retrieval_order: RetrievalPriority[];
};

export type ContextWindowBundle = {
  current_situation: string | null;
  active_episode_summary: string | null;
  related_unresolved: string[];
  relevant_historical_events: RawEventRef[];
  supporting_evidence: RawEventRef[];
  /** Full lifetime history is NEVER included by default */
  includes_full_history: false;
};

export type PaginatedResult<T> = {
  items: T[];
  total: number;
  offset: number;
  limit: number;
  has_more: boolean;
};
