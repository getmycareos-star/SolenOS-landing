import type {
  CARE_REALITY_PROFILE_RULES,
  MEMORY_EVOLUTION_STAGES,
  PROFILE_SECTIONS,
} from "./contract-constants";

export type ProfileSectionKey = (typeof PROFILE_SECTIONS)[number];
export type MemoryEvolutionStage = (typeof MEMORY_EVOLUTION_STAGES)[number];

export type ProfileEntry = {
  label: string;
  source_event_ids: string[];
  observed_at: string;
  confidence: "low" | "medium" | "high";
  evolution_stage: MemoryEvolutionStage;
};

export type CareRealityProfile = {
  care_recipient_id: string;
  computed_at: string;
  sections: Record<ProfileSectionKey, ProfileEntry[]>;
  relationship_insights: string[];
  person_specific_summary: string;
};

export type CareRealityProfileResult = {
  active: boolean;
  profile: CareRealityProfile;
  rules_upheld: readonly (typeof CARE_REALITY_PROFILE_RULES)[number][];
  defining_principle: string;
};

export type ProcessCareRealityProfileInput = {
  care_recipient_id: string;
  all_events: import("../situation-entry/types").CanonicalCareEvent[];
  baseline?: import("../baseline-intelligence-engine/types").BaselineIntelligenceResult;
  behavior?: import("../behavior-interpretation-engine/types").BehaviorInterpretationResult;
  memory_strategy?: import("../memory-strategy-engine/types").MemoryStrategyResult;
  what_is_uncertain: string[];
  what_needs_clarification: string[];
  as_of?: string;
};
