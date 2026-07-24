import type {
  CANONICAL_CONFIDENCE_LEVELS,
  CANONICAL_RISK_LEVELS,
} from "./contract-constants";
import type { CareTransparencyPanel } from "../care-transparency-layer/types";

export type CanonicalRiskLevel = (typeof CANONICAL_RISK_LEVELS)[number];
export type CanonicalConfidenceLevel = (typeof CANONICAL_CONFIDENCE_LEVELS)[number];

export type DecisionTrace = {
  events: string[];
  assumptions: string[];
  unknowns: string[];
  evidence_sources: string[];
};

export type ConfidenceState = {
  overall_confidence: CanonicalConfidenceLevel;
  completeness: number;
  reasoning_limits: string[];
};

export type TrustLayerOutput = {
  known: Array<{
    statement: string;
    source: string;
    source_type: "care_event" | "caregiver_input" | "document" | "care_context";
    source_event_id?: string;
  }>;
  assumed: Array<{
    statement: string;
    reasoning_basis: string;
    source_engine: string;
  }>;
  unknown: Array<{
    statement: string;
    drives_clarification: boolean;
  }>;
  recency: {
    last_updated_at: string | null;
    freshness_score: number;
    interpretation: string;
  };
  confidence: number;
};

/** The one and only allowed output structure of SolenOS. */
export type FinalOutputContract = {
  what_is_happening: string;
  what_matters_now: string;
  what_to_ask_next: string;
  risk_level: CanonicalRiskLevel;
  what_can_wait: string;
  follow_up_items: string[];
  decision_trace: DecisionTrace;
  confidence_state: ConfidenceState;
  trust_layer: TrustLayerOutput;
  /** Care Transparency Panel — required on every output */
  transparency_panel: CareTransparencyPanel;
};

export type FinalOutputValidationError = {
  type: "INVALID_FINAL_OUTPUT";
  message: string;
  raw_output: unknown;
};
