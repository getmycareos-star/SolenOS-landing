/** Final output contract — the one and only allowed output structure. */

export const FINAL_OUTPUT_CONTRACT_IDENTITY =
  "SolenOS has exactly one canonical output schema — no alternative response formats.";

export const CANONICAL_RISK_LEVELS = ["low", "medium", "high"] as const;

export const CANONICAL_CONFIDENCE_LEVELS = ["low", "medium", "high"] as const;

export const REQUIRED_OUTPUT_FIELDS = [
  "what_is_happening",
  "what_matters_now",
  "what_to_ask_next",
  "risk_level",
  "what_can_wait",
  "follow_up_items",
  "decision_trace",
  "confidence_state",
  "trust_layer",
  "transparency_panel",
] as const;

export const DECISION_TRACE_FIELDS = [
  "events",
  "assumptions",
  "unknowns",
  "evidence_sources",
] as const;

export const CONFIDENCE_STATE_FIELDS = [
  "overall_confidence",
  "completeness",
  "reasoning_limits",
] as const;

export const MAX_HIGH_IMPACT_QUESTIONS = 3;
export const MAX_FOLLOW_UP_ITEMS = 8;

/** LLM / Gemini envelope — the only allowed JSON output target. */
export const LLM_OUTPUT_SCHEMA_JSON =
  '{ what_is_happening: string, what_matters_now: string, what_to_ask_next: string, risk_level: "low" | "medium" | "high" | "critical", what_can_wait: string, follow_up_items: string[], decision_trace: { events: string[], assumptions: string[], unknowns: string[], evidence_sources: string[] }, confidence_state: { overall_confidence: "low" | "medium" | "high", completeness: number, reasoning_limits: string[] }, trust_layer: { known: object[], assumed: object[], unknown: object[], recency: { last_updated_at: string | null, freshness_score: number, interpretation: string }, confidence: number }, transparency_panel: { data_used: { care_events: string[], timeline_segments: string[], caregiver_inputs: string[] }, data_ignored: { conflicting: string[], low_confidence: string[], stale_or_decayed: string[] }, reason_for_output: string, evidence_breakdown: object[], confidence_scores: { overall_pct: number, tier: "low" | "medium" | "high" }, recency: { last_update_at: string | null, critical_event_ages: string[], decay_status: "fresh" | "aging" | "stale" }, observed: string[], inferred: string[] } }';
