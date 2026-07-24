import type {
  CARE_CONTEXT_DIFF_DESIGN_RULES,
  CARE_CONTEXT_DIFF_SECTIONS,
  CHANGE_CATEGORIES,
} from "./contract-constants";

export type CareContextDiffSectionKey = (typeof CARE_CONTEXT_DIFF_SECTIONS)[number];
export type ChangeCategory = (typeof CHANGE_CATEGORIES)[number];

export type CareContextDiffSections = Record<CareContextDiffSectionKey, string[]>;

export type CareContextDiff = {
  timestamp: string;
  care_recipient_id: string;
  time_frame: string;
  relative_to: string;
  sections: CareContextDiffSections;
  /** Weighted headline — safety-critical changes first */
  primary_change: string;
};

export type CareContextDiffResult = {
  active: boolean;
  diff: CareContextDiff;
  has_meaningful_change: boolean;
  rules_upheld: readonly (typeof CARE_CONTEXT_DIFF_DESIGN_RULES)[number][];
  defining_principle: string;
};

export type ProcessCareContextDiffInput = {
  caregiver_id: string;
  prior_context: import("../situation-entry/types").CareContextRoot | null;
  context: import("../situation-entry/types").CareContextRoot;
  events_created: import("../situation-entry/types").CanonicalCareEvent[];
  state_diff: import("../continuous-execution-loop/types").StateDiff;
  what_changed: string[];
  behavior: import("../behavior-interpretation-engine/types").BehaviorInterpretationResult;
  continuity_decay: import("../continuity-decay-engine/types").ContinuityDecayResult;
  multi_caregiver?: import("../multi-caregiver-context-model/types").MultiCaregiverContextResult;
  state_of_care?: import("../state-of-care-summary-engine/types").StateOfCareSummary;
  attention_event_ids: string[];
  as_of?: string;
};
