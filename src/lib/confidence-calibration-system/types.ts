import type {
  CONFIDENCE_CALIBRATION_RULES,
  SourceTypeWeight,
} from "./contract-constants";

export type ConfidenceFactors = {
  observation_weight: number;
  inference_weight: number;
  recency_factor: number;
  contradiction_factor: number;
  confirmation_factor: number;
  completeness_factor: number;
  source_base: number;
};

export type CalibratedConfidence = {
  score: number;
  factors: ConfidenceFactors;
  reason: string;
  is_observation: boolean;
  source_type: SourceTypeWeight;
};

export type ConfidenceCalibrationResult = {
  active: boolean;
  event_confidences: Array<{
    event_id: string;
    confidence: CalibratedConfidence;
  }>;
  aggregate_confidence: number;
  aggregate_reason: string;
  rules_upheld: readonly (typeof CONFIDENCE_CALIBRATION_RULES)[number][];
  defining_principle: string;
};

export type CareEventConfidenceInput = {
  event_id: string;
  source_type: SourceTypeWeight;
  is_observation: boolean;
  age_ms: number;
  high_risk_context: boolean;
  contradicted: boolean;
  confirmation_count: number;
  missing_critical_fields: number;
};

export type ProcessConfidenceCalibrationInput = {
  events: CareEventConfidenceInput[];
  as_of?: string;
};
