import type {
  BUILD_SURFACE,
  CARE_TRANSITION_SIGNAL_TYPES,
  CORE_CAPABILITIES,
  INTELLIGENCE_CHAIN_STAGES,
  TRUST_ENGINEERING_RULES,
} from "./contract-constants";

export type IntelligenceChainStage = (typeof INTELLIGENCE_CHAIN_STAGES)[number];
export type CoreCapability = (typeof CORE_CAPABILITIES)[number];
export type TrustEngineeringRule = (typeof TRUST_ENGINEERING_RULES)[number];
export type CareTransitionSignalType = (typeof CARE_TRANSITION_SIGNAL_TYPES)[number];
export type BuildSurface = (typeof BUILD_SURFACE)[number];

export type IntelligenceChainLink = {
  stage: IntelligenceChainStage;
  summary: string;
  evidence_event_ids: string[];
  confidence: "low" | "medium" | "high";
  uncertainty_note?: string;
};

/** Decision memory + care-loop outcome (spine extension — not UI). */
export type CareLoopOutcome = {
  id: string;
  decision_summary: string;
  intervention: string;
  outcome: "helped" | "did_not_help" | "unknown" | "mixed";
  evidence_event_ids: string[];
  recorded_at: string;
  confidence: "low" | "medium" | "high";
  source: "profile_inference" | "caregiver_confirmed" | "system_inferred";
};

export type CareTransitionSignal = {
  type: CareTransitionSignalType;
  detected_at: string;
  source_event_ids: string[];
  summary: string;
  /** FUTURE: temporary Care Transition Mode brief */
  mode: "signal_only" | "transition_mode";
  uncertainties: string[];
};

export type CareRealityIntelligenceSnapshot = {
  care_recipient_id: string;
  computed_at: string;
  category: string;
  comparison_question: string;
  intelligence_chain: IntelligenceChainLink[];
  capabilities_active: CoreCapability[];
  care_loop_outcomes: CareLoopOutcome[];
  care_transition_signals: CareTransitionSignal[];
  person_specific_summary: string;
  trust_rules_upheld: readonly TrustEngineeringRule[];
  build_surfaces_active: readonly BuildSurface[];
};

export type CareRealityIntelligenceResult = {
  active: boolean;
  snapshot: CareRealityIntelligenceSnapshot;
  defining_principle: string;
  status: {
    facade: string;
    care_loop_outcomes: string;
    care_transition_mode: string;
  };
};

export type ProcessCareRealityIntelligenceInput = {
  care_recipient_id: string;
  all_events: import("../situation-entry/types").CanonicalCareEvent[];
  events_created: import("../situation-entry/types").CanonicalCareEvent[];
  what_changed?: string[];
  what_is_happening?: string;
  what_needs_attention?: string[];
  what_is_uncertain?: string[];
  baseline?: import("../baseline-intelligence-engine/types").BaselineIntelligenceResult;
  care_reality_profile?: import("../care-reality-profile-engine/types").CareRealityProfileResult;
  care_state?: import("../care-state-engine/types").CareStateSnapshot;
  continuity_properties?: import("../continuity-properties/types").ContinuityPropertiesResult;
  moment_of_need?: import("../moment-of-need-engine/types").MomentOfNeedResult;
  as_of?: string;
};
