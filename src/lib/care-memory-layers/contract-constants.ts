/** Graph scale & memory strategy — organize history, never discard it. */

export const MEMORY_LAYERS_IDENTITY =
  "SolenOS becomes simpler by organizing history — raw CareEvents remain permanent source of truth.";

export const MEMORY_LAYER_IDS = [
  "raw_event",
  "structured_continuity",
  "episode",
  "long_term_continuity",
] as const;

export const EPISODE_KINDS = [
  "hospital_stay",
  "insurance_appeal",
  "home_care_transition",
  "medication_adjustment",
  "legal_planning",
  "family_care_planning",
  "rehabilitation",
  "equipment_acquisition",
  "general_care",
] as const;

export const EPISODE_STATUS = ["active", "completed", "monitoring"] as const;

export const CONTINUITY_SUMMARY_KINDS = [
  "care_transition",
  "unresolved_issue",
  "responsibility_change",
  "life_event",
  "historical_pattern",
  "care_milestone",
] as const;

/** Episode clustering window — events within this span may group. */
export const EPISODE_CLUSTER_DAYS = 21;

/** Events newer than this are "recent" in retrieval. */
export const RECENT_EVENT_DAYS = 30;

/** Episodes older than this roll into long-term summaries. */
export const LONG_TERM_EPISODE_AGE_DAYS = 90;

export const DEFAULT_PAGE_SIZE = 20;

export const RETRIEVAL_PRIORITY_ORDER = [
  "active_episode",
  "recent_events",
  "open_follow_ups",
  "unresolved_questions",
  "historical_episodes",
  "long_term_summaries",
  "raw_events_on_demand",
] as const;

export const CONTEXT_WINDOW_PRIORITY = [
  "current_situation",
  "active_episode",
  "related_unresolved",
  "relevant_historical_events",
  "supporting_evidence",
] as const;
