import type {
  CONFIDENCE_TIERS,
  DECAY_STATUSES,
  EVIDENCE_TYPES,
  TRANSPARENCY_RULES,
} from "./contract-constants";

export type EvidenceType = (typeof EVIDENCE_TYPES)[number];
export type ConfidenceTier = (typeof CONFIDENCE_TIERS)[number];
export type DecayStatus = (typeof DECAY_STATUSES)[number];

export type CareTransparencyPanel = {
  data_used: {
    care_events: string[];
    timeline_segments: string[];
    caregiver_inputs: string[];
  };
  data_ignored: {
    conflicting: string[];
    low_confidence: string[];
    stale_or_decayed: string[];
  };
  reason_for_output: string;
  evidence_breakdown: {
    conclusion: string;
    evidence_type: EvidenceType;
    confidence_pct: number;
  }[];
  confidence_scores: {
    overall_pct: number;
    tier: ConfidenceTier;
  };
  recency: {
    last_update_at: string | null;
    critical_event_ages: string[];
    decay_status: DecayStatus;
  };
  observed: string[];
  inferred: string[];
};

export type CareTransparencyResult = {
  active: boolean;
  panel: CareTransparencyPanel;
  valid: boolean;
  validation_errors: string[];
  rules_upheld: readonly (typeof TRANSPARENCY_RULES)[number][];
  defining_principle: string;
};

export type BuildCareTransparencyInput = {
  response: Omit<import("../situation-entry/types").SituationResponse, "final_output">;
  final_output_draft?: import("../final-output-contract/types").FinalOutputContract;
};
