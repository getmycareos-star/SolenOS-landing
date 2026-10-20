import type {
  BELIEF_IMPORTANCE,
  BELIEF_ITEM_STATUSES,
  BELIEF_ITEM_TYPES,
  SOLENOS_LAYER_NAMES,
  SOLENOS_RUNTIME_PIPELINE,
  STATE_ACTION_STATUSES,
  STATE_PRIORITIES,
  STATE_SITUATION_STATUSES,
} from "./contract-constants";

export type SolenosLayerName = (typeof SOLENOS_LAYER_NAMES)[number];

export type SolenosRuntimeStage = (typeof SOLENOS_RUNTIME_PIPELINE)[number];

/** LAYER 1: STATE — objective current reality (single source of truth). */
export type StateSituationStatus = (typeof STATE_SITUATION_STATUSES)[number];
export type StateActionStatus = (typeof STATE_ACTION_STATUSES)[number];
export type StatePriority = (typeof STATE_PRIORITIES)[number];

/**
 * Canonical STATE Situation — minimal, non-duplicated source of truth.
 * NOT ALLOWED: assumptions, reasoning, explanations, inferred intent.
 */
export type StateSituation = {
  id: string;
  status: StateSituationStatus;
  priority: StatePriority;
  summary: string;
  /** Optional internal action state — not reasoning. */
  actionStatus?: StateActionStatus;
  /** Document references — pointers only, never content. */
  documentRefs: readonly string[];
  careSessionId?: string;
  userId?: string;
  createdAt: string;
  updatedAt: string;
};

export type StateStoreSnapshot = {
  situations: readonly StateSituation[];
};

/** LAYER 2: BELIEF — unified uncertainty model. */
export type BeliefItemType = (typeof BELIEF_ITEM_TYPES)[number];
export type BeliefItemStatus = (typeof BELIEF_ITEM_STATUSES)[number];
export type BeliefImportance = (typeof BELIEF_IMPORTANCE)[number];

/**
 * Unified BeliefItem — MERGES Assumption Registry + Missing Information Queue.
 * Beliefs DO NOT execute actions; DO NOT appear as primary UI; ONLY influence interpretation.
 */
export type BeliefItem = {
  id: string;
  situationId: string;
  type: BeliefItemType;
  content: string;
  /** 0–1 */
  confidence: number;
  importance?: BeliefImportance;
  status: BeliefItemStatus;
  createdAt: string;
  updatedAt?: string;
  /** Facade bridge — optional legacy ids for adapters. */
  legacyAssumptionId?: string;
  legacyMissingInfoId?: string;
};

export type BeliefStoreSnapshot = {
  userId: string;
  items: readonly BeliefItem[];
};

/** LAYER 3: EXPLANATION — post-hoc audit + trust ONLY. */
export type ExplanationDecisionRecord = {
  situationId: string;
  decisionId: string;
  chosenAction: string;
  rejectedAlternatives: readonly string[];
  reasoningSummary: string;
  assumptionsUsed: readonly string[];
  missingInfoImpact: readonly string[];
  timestamp: string;
};

export type ExplanationTimelineEvent = {
  id: string;
  situationId: string;
  type: string;
  summary: string;
  timestamp: string;
};

export type ExplanationHealthSummary = {
  band: "Healthy" | "Degraded" | "Unreliable";
  overallScore: number;
  summary: string;
  boostUncertainty: boolean;
  constrainAutonomy: boolean;
  requestClarification: boolean;
  reasons: readonly string[];
};

/** DERIVED — pure function outputs (never persisted as independent systems). */
export type DerivedRiskResult = {
  situationRisks: readonly {
    situationId: string;
    adjustedRisk: number;
    baseLevel: StatePriority;
  }[];
  systemRiskExposure: number;
  overload: boolean;
};

/** Explainable Priority Contract breakdown (derived — never persisted). */
export type DerivedSituationPriorityScore = {
  situationId: string;
  priorityScore: number;
  safetyOverride: boolean;
  riskLevel: StatePriority;
  timeUrgency: "NOW" | "SOON" | "TODAY" | "LATER";
  completion: "RESOLVED" | "PARTIAL" | "ACTIVE";
  components: {
    riskWeight: number;
    severity: number;
    riskContribution: number;
    timeUrgency: number;
    timeDecayFactor: number;
    timeContribution: number;
    uncertaintyWeight: number;
    missingInformationLoad: number;
    uncertaintyContribution: number;
    dependencyWeight: number;
    downstreamImpact: number;
    dependencyContribution: number;
    resolutionProgress: number;
    completionFactor: number;
    completionReduction: number;
  };
  reasons: readonly string[];
};

export type DerivedPriorityResult = {
  rankedActionIds: readonly string[];
  topActionId: string;
  highMissingInfoBlocked: boolean;
  /** CRITICAL open medical conflicts from Conflict Detection. */
  criticalConflictBlocked?: boolean;
  confidenceCap?: number;
  /** When demands drive priority — ranked demand ids by pressure. */
  rankedDemandIds?: readonly string[];
  topDemandId?: string;
  /** Situation ranking via Priority Contract (score DESC + CRITICAL×NOW override). */
  rankedSituationIds?: readonly string[];
  topSituationId?: string;
  /** Per-situation Priority Contract results with explainability metadata. */
  situationScores?: readonly DerivedSituationPriorityScore[];
  /** True when any CRITICAL×NOW safety override was applied. */
  priorityOverrideApplied?: boolean;
  /** Compact WHY lines for Decision Surface / EXPLANATION. */
  explanationLines?: readonly string[];
};

/** DERIVED Caregiver Load — never persisted as independent system. */
export type DerivedCaregiverLoadResult = {
  score: number;
  state: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  surfaceLimit: number;
  activeDemandCount: number;
  highPressureDemandCount: number;
};

/** DERIVED Caregiver Confidence — reassures without replacing priority. */
export type DerivedConfidenceState = {
  confidence: number;
  missingCriticalActions: number;
  unresolvedHighRiskSituations: number;
  explanation: string;
};

/** DERIVED Crisis Prevention — predictive failure probability. */
export type DerivedCrisisRisk = {
  situationId: string;
  probability: number;
  estimatedTimeToFailure: number;
  contributingFactors: readonly string[];
  explanation: string;
  category?: "medical" | "caregiver" | "family" | "financial";
};

/** DERIVED Delegation — suggest-only when load elevated. */
export type DerivedDelegationSuggestion = {
  task: string;
  recommendedPerson: string;
  reason: string;
  loadReductionEstimate?: number;
};

export type LayeredRuntimeResult = {
  state: StateStoreSnapshot;
  beliefs: BeliefStoreSnapshot;
  risk: DerivedRiskResult;
  priority: DerivedPriorityResult;
  health: ExplanationHealthSummary;
  decision?: ExplanationDecisionRecord;
  stagesCompleted: readonly SolenosRuntimeStage[];
};
