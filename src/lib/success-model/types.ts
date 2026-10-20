import type {
  FEATURE_ACCEPTANCE_QUESTIONS,
  LONGITUDINAL_METRICS,
  PRIMARY_SUCCESS_METRICS,
  SYSTEM_QUALITY_METRICS,
  USER_TRUST_METRICS,
} from "./contract-constants";

export type PrimarySuccessMetric = (typeof PRIMARY_SUCCESS_METRICS)[number];
export type SystemQualityMetric = (typeof SYSTEM_QUALITY_METRICS)[number];
export type UserTrustMetric = (typeof USER_TRUST_METRICS)[number];
export type LongitudinalMetric = (typeof LONGITUDINAL_METRICS)[number];

export type MetricScore = {
  metric: string;
  score: number;
  level: "strong" | "moderate" | "weak" | "insufficient";
  signals: string[];
};

export type PrimarySuccessScores = Record<PrimarySuccessMetric, MetricScore>;
export type SystemQualityScores = Record<SystemQualityMetric, MetricScore>;
export type UserTrustScores = Record<UserTrustMetric, MetricScore>;
export type LongitudinalScores = Record<LongitudinalMetric, MetricScore>;

export type RecallProbe = {
  question: string;
  answered: boolean;
  answer: string | null;
  evidence_event_ids: string[];
  from_continuity: boolean;
};

export type FeatureAcceptanceResult = {
  feature_name: string;
  questions: { question: string; answer: boolean }[];
  accepted: boolean;
  yes_count: number;
  required_yes: number;
};

export type SuccessModelResult = {
  primary: PrimarySuccessScores;
  system_quality: SystemQualityScores;
  user_trust: UserTrustScores;
  longitudinal: LongitudinalScores;
  overall_success_score: number;
  overall_level: "strong" | "moderate" | "weak" | "insufficient";
  outcome_summary: string;
  recall_probes: RecallProbe[];
  activity_metrics_excluded: string[];
  feature_acceptance_template: FeatureAcceptanceResult;
};

export type SuccessSnapshot = {
  caregiver_id: string;
  overall_success_score: number;
  primary_scores: Record<string, number>;
  captured_at: string;
};
