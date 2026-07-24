import type {
  HEALTH_ALERT_SEVERITIES,
  SYSTEM_HEALTH_BAND_LABELS,
  SYSTEM_HEALTH_WEIGHTS,
} from "./contract-constants";

export type HealthBand = (typeof SYSTEM_HEALTH_BAND_LABELS)[number];

export type HealthAlertSeverity = (typeof HEALTH_ALERT_SEVERITIES)[number];

export type SystemHealthWeights = typeof SYSTEM_HEALTH_WEIGHTS;

export type ContextHealth = {
  missingCriticalInformation: number;
  unresolvedQuestions: number;
  staleContextItems: number;
};

export type MemoryHealth = {
  outdatedMemoryCount: number;
  correctedMemoryCount: number;
  conflictingMemoryCount: number;
};

export type SituationHealth = {
  activeSituations: number;
  blockedSituations: number;
  unresolvedSituations: number;
};

export type ContradictionHealth = {
  contradictionsDetected: number;
  unresolvedContradictions: number;
};

export type DocumentHealth = {
  staleDocuments: number;
  unreadDocuments: number;
  lowConfidenceExtractions: number;
  /** Subset of unreadDocuments marked critical (insurance/medical/benefits). */
  unreadCriticalDocuments: number;
};

export type DecisionHealth = {
  acceptedRecommendations: number;
  rejectedRecommendations: number;
  overriddenRecommendations: number;
};

export type AssumptionHealth = {
  activeAssumptions: number;
  expiredAssumptions: number;
  invalidatedAssumptions: number;
  staleAssumptions: number;
};

export type MissingInformationHealth = {
  openItems: number;
  highPriorityItems: number;
  resolvedItems: number;
};

/** Core readiness model — not confidence, not infrastructure. */
export type SystemHealth = {
  overallHealthScore: number;
  contextQuality: ContextHealth;
  memoryQuality: MemoryHealth;
  situationCoverage: SituationHealth;
  contradictionHealth: ContradictionHealth;
  documentHealth: DocumentHealth;
  decisionHealth: DecisionHealth;
  assumptionQuality: AssumptionHealth;
  missingInformationQuality: MissingInformationHealth;
};

export type HealthAlert = {
  severity: HealthAlertSeverity;
  title: string;
  explanation: string;
  recommendedAction: string;
};

export type DimensionScores = {
  contextQuality: number;
  memoryQuality: number;
  situationCoverage: number;
  contradictionHealth: number;
  documentHealth: number;
  decisionHealth: number;
};

export type PreRecommendationGate = {
  /** True when band is Degraded or Unreliable. */
  constrainAutonomy: boolean;
  /** True when band is Degraded or Unreliable. */
  boostUncertainty: boolean;
  /** True when band is Degraded or Unreliable, or guarantee signals require clarification. */
  requestClarification: boolean;
  /** Reduced autonomy target when constraining. */
  autonomyLevel: "LOW" | "MEDIUM" | "HIGH";
  reasons: readonly string[];
};

export type SystemHealthGuaranteeResult = {
  ok: boolean;
  violations: string[];
  /** Signals that were checked before recommendation. */
  checked: {
    context: boolean;
    memory: boolean;
    contradictions: boolean;
    criticalDocuments: boolean;
  };
};

export type SystemHealthLayerResult = {
  health: SystemHealth;
  band: HealthBand;
  dimensionScores: DimensionScores;
  alerts: readonly HealthAlert[];
  gate: PreRecommendationGate;
  guarantee: SystemHealthGuaranteeResult;
  /** User-facing summary lines — not a dashboard. */
  userFacingSummary: string;
  issueBullets: readonly string[];
};

export type SystemHealthLayerPayload = {
  overallHealthScore: number;
  band: HealthBand;
  alerts: readonly HealthAlert[];
  issueBullets: readonly string[];
  userFacingSummary: string;
  gate: {
    constrainAutonomy: boolean;
    boostUncertainty: boolean;
    requestClarification: boolean;
    autonomyLevel: "LOW" | "MEDIUM" | "HIGH";
  };
  dimensionScores: DimensionScores;
  health: SystemHealth;
};

/** Optional external decision feedback counters (UI / telemetry). */
export type DecisionFeedbackSignals = {
  acceptedRecommendations?: number;
  rejectedRecommendations?: number;
  overriddenRecommendations?: number;
};

/** Optional UI / identity situation snapshots — READ only. */
export type SituationSnapshotSignals = {
  activeSituations?: number;
  blockedSituations?: number;
  unresolvedSituations?: number;
  titles?: readonly string[];
  /** Optional systemic risk exposure from Situation Risk Register (0–100). */
  totalRiskExposure?: number;
};
