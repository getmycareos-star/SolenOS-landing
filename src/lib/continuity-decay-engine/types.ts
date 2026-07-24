import type { FRESHNESS_TIERS } from "./contract-constants";



export type FreshnessTier = (typeof FRESHNESS_TIERS)[number];



export type ObjectConfidence = {

  object_id: string;

  label: string;

  tier: FreshnessTier;

  confidence_pct: number;

  age_days: number;

  freshness_window_days: number;

  last_confirmed_at: string;

};



export type ExpectedFollowUp = {

  source_event_id: string;

  label: string;

  check_after_days: number;

  due_at: string;

  confirmed: boolean;

  overdue_days: number | null;

};



export type ContinuityGap = {

  gap_id: string;

  label: string;

  reason: string;

  source_event_ids: string[];

  confidence_pct: number;

  importance: "high" | "medium" | "low";

};



export type StaleContinuityItem = {

  object_id: string;

  label: string;

  tier: FreshnessTier;

  confidence_pct: number;

  stale_reason: string;

};



export type FamilyRhythm = {

  typical_cadence_days: number;

  update_count: number;

  meaningful_gap: boolean;

  days_since_last_update: number;

};



export type RefreshSession = {

  welcome_message: string;

  days_since_last_update: number;

  questions: string[];

  decision_trace_reasons: string[];

};



export type ContinuityDecayResult = {

  triggered: boolean;

  trigger_reasons: string[];

  continuity_confidence_pct: number;

  object_confidence: ObjectConfidence[];

  stale_items: StaleContinuityItem[];

  continuity_gaps: ContinuityGap[];

  expected_follow_ups: ExpectedFollowUp[];

  at_risk_event_ids: string[];

  recheck_prompts: string[];

  refresh_session: RefreshSession | null;

  family_rhythm: FamilyRhythm;

  confidence_recovery_applied: string[];

  decision_trace_reasons: string[];

  prohibited_avoided: readonly string[];

  reasoning_stages_completed: readonly string[];

};



export type ProcessContinuityDecayInput = {

  caregiver_id: string;

  all_events: import("../situation-entry/types").CanonicalCareEvent[];

  events_created: import("../situation-entry/types").CanonicalCareEvent[];

  what_needs_clarification: string[];

  what_is_uncertain: string[];

  attention_event_ids: string[];

  what_changed: string[];

  as_of?: string;

  trigger?: "entry" | "idle_refresh" | "background";

};


