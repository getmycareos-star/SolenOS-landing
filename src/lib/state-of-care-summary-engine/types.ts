import type { STATE_OF_CARE_DESIGN_RULES, STATE_OF_CARE_SECTIONS } from "./contract-constants";

export type StateOfCareSectionKey = (typeof STATE_OF_CARE_SECTIONS)[number];

export type StateOfCareSections = Record<StateOfCareSectionKey, string[]>;

export type StateOfCareSummary = {
  timestamp: string;
  care_recipient_id: string;
  snapshot_version: number;
  sections: StateOfCareSections;
  /** Mandatory prioritization — what matters most right now */
  what_matters_most: string;
};

export type StateOfCareSummaryResult = {
  active: boolean;
  summary: StateOfCareSummary;
  rules_upheld: readonly (typeof STATE_OF_CARE_DESIGN_RULES)[number][];
  defining_principle: string;
  derived_from: string[];
};

export type ProcessStateOfCareSummaryInput = {
  caregiver_id: string;
  context: import("../situation-entry/types").CareContextRoot;
  events_created: import("../situation-entry/types").CanonicalCareEvent[];
  what_changed: string[];
  what_is_uncertain: string[];
  what_needs_clarification: string[];
  behavior: import("../behavior-interpretation-engine/types").BehaviorInterpretationResult;
  continuity_decay: import("../continuity-decay-engine/types").ContinuityDecayResult;
  trust_layer?: import("../trust-layer-engine/types").TrustLayerEngineResult;
  multi_caregiver?: import("../multi-caregiver-context-model/types").MultiCaregiverContextResult;
  crisis_mode?: import("../crisis-mode-interaction-layer/types").CrisisModeInteractionResult;
  attention_event_ids: string[];
  as_of?: string;
};
