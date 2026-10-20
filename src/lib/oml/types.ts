/** Trend direction for outcome metrics over time. */
export type OutcomeTrend = "improving" | "worsening" | "stable";

/** The seven MVP core outcome metrics. */
export type OutcomeMetricId =
  | "cognitive_load_reduction"
  | "time_to_understanding"
  | "change_recognition_latency"
  | "clarification_load"
  | "timeline_reconstruction_accuracy"
  | "caregiver_cognitive_load_score"
  | "decision_support_impact";

export interface CognitiveLoadReductionMetric {
  id: "cognitive_load_reduction";
  /** Questions asked this session — lower is better. */
  questionsPerSession: number;
  whatChangedQueries: number;
  repeatedInputs: number;
  /** Seconds spent reviewing CareContext — lower over time is better. */
  reviewTimeSeconds: number;
  confusionSignals: number;
  /** Composite 0–100 — lower is better. */
  score: number;
}

export interface TimeToUnderstandingMetric {
  id: "time_to_understanding";
  /** Median seconds from open to clarity — lower is better. */
  medianSecondsToClarity: number | null;
  interactionsBeforeClarity: number | null;
  sessionsMeasured: number;
}

export interface ChangeRecognitionLatencyMetric {
  id: "change_recognition_latency";
  /** Median ms from event recorded to surfaced as important — lower is better. */
  medianLatencyMs: number | null;
  eventsMeasured: number;
  /** Events not yet surfaced within acceptable window. */
  pendingRecognition: number;
}

export interface ClarificationLoadMetric {
  id: "clarification_load";
  questionsPerCareEvent: number;
  unresolvedClarificationRatio: number;
  repeatedClarificationRequests: number;
  /** Composite 0–100 — lower is better. */
  score: number;
}

export interface TimelineReconstructionAccuracyMetric {
  id: "timeline_reconstruction_accuracy";
  /** 0–100 — higher is better. */
  accuracyScore: number;
  caregiverCorrections: number;
  eventReorderingFeedback: number;
  contradictionResolutions: number;
}

export interface CaregiverCognitiveLoadScoreMetric {
  id: "caregiver_cognitive_load_score";
  /** Composite 0–100 — lower is better. High = system failing. */
  score: number;
  level: "low" | "moderate" | "high" | "critical";
  components: {
    uncertaintyDensity: number;
    openLoops: number;
    unresolvedCareEvents: number;
    contradictionFrequency: number;
    clarificationBurden: number;
  };
}

export interface DecisionSupportImpactMetric {
  id: "decision_support_impact";
  escalationFollowed: number;
  unnecessaryDecisionDelayed: number;
  noActionConfirmed: number;
  totalDecisionSignals: number;
  /** 0–100 impact score — higher is better. */
  impactScore: number;
}

export interface OutcomeMetricsSnapshot {
  cognitiveLoadReduction: CognitiveLoadReductionMetric;
  timeToUnderstanding: TimeToUnderstandingMetric;
  changeRecognitionLatency: ChangeRecognitionLatencyMetric;
  clarificationLoad: ClarificationLoadMetric;
  timelineReconstructionAccuracy: TimelineReconstructionAccuracyMetric;
  caregiverCognitiveLoadScore: CaregiverCognitiveLoadScoreMetric;
  decisionSupportImpact: DecisionSupportImpactMetric;
  assessedAt: string;
}

export interface OutcomeMetricDelta {
  metricId: OutcomeMetricId;
  previousValue: number;
  currentValue: number;
  change: number;
  /** Negative change is good for load/latency metrics; positive for accuracy/impact. */
  direction: "better" | "worse" | "unchanged";
}

export interface OutcomeMeasurementResult {
  snapshot: OutcomeMetricsSnapshot;
  deltas: OutcomeMetricDelta[];
  trend: OutcomeTrend;
  /** System-level verdict: is SolenOS working? */
  systemWorking: boolean;
  summary: string;
}

/** Runtime session data for TTU and cognitive load proxies. */
export interface OMLSession {
  sessionId: string;
  openedAt: string;
  closedAt?: string;
  questionsAsked: string[];
  whatChangedQueries: number;
  repeatedInputs: number;
  reviewTimeSeconds: number;
  interactions: number;
  clarityAchievedAt?: string;
  confusionSignals: number;
}

/** Longitudinal OML state tied to a care journey. */
export interface OMLState {
  sessions: OMLSession[];
  snapshots: OutcomeMetricsSnapshot[];
  /** Caregiver corrections for timeline accuracy. */
  timelineCorrections: TimelineCorrection[];
  /** Clarification request/response history. */
  clarifications: ClarificationRecord[];
  /** Decision support signals observed. */
  decisionSignals: DecisionSignal[];
  /** Caregiver feedback responses. */
  feedback: CaregiverFeedbackResponse[];
}

export interface TimelineCorrection {
  eventId: string;
  correctionType: "reorder" | "date_fix" | "description_fix";
  notedAt: string;
}

export interface ClarificationRecord {
  question: string;
  askedAt: string;
  resolved: boolean;
  careEventId?: string;
  repeated: boolean;
}

export interface DecisionSignal {
  type: "escalation_followed" | "decision_delayed" | "no_action_confirmed";
  notedAt: string;
  context: string;
}

export type FeedbackHelpfulness = "helpful" | "partially" | "not_helpful";
export type FeedbackConfusionReduction = "yes" | "somewhat" | "no";

export interface CaregiverFeedbackPrompt {
  outputType: "state_of_care" | "diff" | "opening_surface" | "care_snapshot" | "guidance";
  questions: [
    "Was this helpful in understanding what's going on?",
    "Did this reduce confusion?",
    "Is anything missing or incorrect?",
  ];
}

export interface CaregiverFeedbackResponse {
  outputType: CaregiverFeedbackPrompt["outputType"];
  helpfulness: FeedbackHelpfulness;
  reducedConfusion: FeedbackConfusionReduction;
  missingOrIncorrect?: string;
  submittedAt: string;
}

export interface FeedbackCalibrationResult {
  confidenceAdjustment: number;
  patternWeightAdjustment: number;
  failureFlags: string[];
  metricAdjustments: Partial<Record<OutcomeMetricId, number>>;
}

export interface EngineMetricDeclaration {
  engine: string;
  improvesMetrics: OutcomeMetricId[];
  module: string;
}

export const OML_PRINCIPLE =
  "You are not building features. You are building measurable reduction of caregiver uncertainty over time.";
