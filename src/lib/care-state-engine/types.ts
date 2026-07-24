import type { CARE_STATE_RULES, CARE_STATE_SECTIONS } from "./contract-constants";

export type CareStateSectionKey = (typeof CARE_STATE_SECTIONS)[number];

export type CareStateConfidenceEntry = {
  area: string;
  level: "high" | "medium" | "low";
  note: string;
};

export type CareStateSnapshot = {
  care_recipient_id: string;
  computed_at: string;
  person_context: string[];
  current_conditions: string[];
  events: string[];
  observations: string[];
  /** CareRecord spine — medications / decisions / tasks / risks / confidence */
  medications: string[];
  decisions: string[];
  tasks: string[];
  risks: string[];
  unknowns: string[];
  /** Explicit Unknowns Model — structured missing facts (not scalar uncertainty). */
  explicit_unknowns: import("../continuity-properties/explicit-unknowns").ExplicitUnknown[];
  known_facts: string[];
  inferred_interpretations: string[];
  confidence_scores: CareStateConfidenceEntry[];
  recent_changes: string[];
  needs_attention: string[];
  what_is_stable: string[];
  current_understanding: string;
};

export type CareStateEngineResult = {
  active: boolean;
  care_state: CareStateSnapshot;
  change_detected: boolean;
  rules_upheld: readonly (typeof CARE_STATE_RULES)[number][];
  defining_principle: string;
};

export type ProcessCareStateEngineInput = {
  care_recipient_id: string;
  all_events: import("../situation-entry/types").CanonicalCareEvent[];
  events_created: import("../situation-entry/types").CanonicalCareEvent[];
  what_is_uncertain: string[];
  what_needs_clarification: string[];
  care_context_diff?: import("../care-context-diff-engine/types").CareContextDiffResult;
  state_of_care?: import("../state-of-care-summary-engine/types").StateOfCareSummaryResult;
  as_of?: string;
};
