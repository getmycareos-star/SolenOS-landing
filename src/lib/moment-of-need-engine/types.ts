import type {
  CHANGE_TYPE_LABELS,
  MOMENT_OF_NEED_RULES,
  MOMENT_OF_NEED_SECTIONS,
} from "./contract-constants";

export type MomentOfNeedSectionKey = (typeof MOMENT_OF_NEED_SECTIONS)[number];
export type ChangeType = keyof typeof CHANGE_TYPE_LABELS;

export type MomentOfNeedSections = Record<MomentOfNeedSectionKey, string[]>;

export type HumanSupportSignal = {
  kind: "clarity" | "uncertainty" | "support_resources" | "human_help";
  message: string;
};

export type MomentOfNeedResult = {
  active: boolean;
  triggered: boolean;
  trigger_reasons: string[];
  sections: MomentOfNeedSections;
  change_type: ChangeType | null;
  helplessness_reduction_goal: string;
  human_support: HumanSupportSignal[];
  confidence: "low" | "medium" | "high";
  data_freshness: string;
  rules_upheld: readonly (typeof MOMENT_OF_NEED_RULES)[number][];
  defining_principle: string;
};

export type ProcessMomentOfNeedInput = {
  raw_input: string;
  events_created: import("../situation-entry/types").CanonicalCareEvent[];
  all_events: import("../situation-entry/types").CanonicalCareEvent[];
  baseline?: import("../baseline-intelligence-engine/types").BaselineIntelligenceResult;
  care_reality_profile?: import("../care-reality-profile-engine/types").CareRealityProfileResult;
  care_context_diff?: import("../care-context-diff-engine/types").CareContextDiffResult;
  behavior?: import("../behavior-interpretation-engine/types").BehaviorInterpretationResult;
  what_is_uncertain: string[];
  as_of?: string;
};
