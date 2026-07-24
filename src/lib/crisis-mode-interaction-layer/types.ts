import type { CRISIS_URGENCY_LEVELS } from "./contract-constants";

export type CrisisUrgencyLevel = (typeof CRISIS_URGENCY_LEVELS)[number];

export type CrisisUiMode = "full" | "condensed" | "checklist" | "single_action";

/** Strict crisis output schema — checklist format only. */
export type CrisisModeOutput = {
  immediate_concerns: string[];
  immediate_actions: string[];
  do_not_do: string[];
  monitor: string[];
  escalation: {
    clinician: string;
    emergency_services: string;
    caregiver_network: string;
  };
};

export type CrisisModeInteractionResult = {
  active: boolean;
  crisis_mode: boolean;
  urgency_level: CrisisUrgencyLevel;
  ui_mode: CrisisUiMode;
  trigger_reasons: string[];
  crisis_output: CrisisModeOutput | null;
  suppressed_engines: readonly string[];
  engines_allowed: readonly string[];
  rules_upheld: readonly string[];
  defining_principle: string;
};

export type ProcessCrisisModeInput = {
  caregiver_id: string;
  raw_input: string;
  events_created: import("../situation-entry/types").CanonicalCareEvent[];
  all_events: import("../situation-entry/types").CanonicalCareEvent[];
  behavior: import("../behavior-interpretation-engine/types").BehaviorInterpretationResult;
  attention_event_ids: string[];
  what_changed: string[];
  as_of?: string;
  is_first_situation?: boolean;
};
