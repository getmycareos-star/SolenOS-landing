import type {
  DEFAULT_PRIORITY_WEIGHTS,
  HARD_CONSTRAINT_KINDS,
  PRIORITY_DOMAINS,
} from "./contract-constants";

export type PriorityDomain = (typeof PRIORITY_DOMAINS)[number];

export type HardConstraintKind = (typeof HARD_CONSTRAINT_KINDS)[number];

export type PriorityWeights = {
  Wt: number;
  We: number;
  Wm: number;
  Wd: number;
  Wr: number;
};

export type PriorityVectorComponents = {
  temporalWeight: number;
  emotionalWeight: number;
  memoryWeight: number;
  dependencyWeight: number;
  riskWeight: number;
};

/** Core output model — ordered weighted decision vector only. */
export type PriorityVector = {
  actionId: string;
  totalScore: number;
  components: PriorityVectorComponents;
  confidence: number;
  uncertainty: number;
};

/** Upstream component inputs before fusion (already raw; engine normalizes). */
export type PriorityScoreInputs = {
  temporalUrgency: number;
  emotionalLoad: number;
  memoryReinforcement: number;
  dependencyWeight: number;
  riskPenalty: number;
};

export type EmotionalAmplificationInput = {
  emotionalLoad: number;
  vulnerabilityFactor: number;
  burnout: boolean;
  grief: boolean;
};

export type MemoryReinforcementInput = {
  frequency: number;
  recency: number;
  importanceDecay: number;
};

export type RiskPenaltyInput = {
  medicalRisk: number;
  financialRisk: number;
  uncertaintyRisk: number;
};

export type DependencyGraphInput = {
  dependents: readonly string[];
  sharedCareWith?: readonly string[];
  externalCaregivers?: readonly string[];
  /** Severity multiplier from role / workload / conditions. */
  dependencySeverityMultiplier: number;
};

/**
 * Scoreable candidate — structured action slot from upstream signals.
 * Priority Engine does NOT invent natural-language actions.
 */
export type PriorityActionCandidate = {
  actionId: string;
  domain: PriorityDomain;
  /** Distinct urgency class for conflict detection (from Care Context / Time). */
  urgencyClass: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "UNSCHEDULED";
  temporalUrgency: number;
  emotional: EmotionalAmplificationInput;
  memory: MemoryReinforcementInput;
  dependency: DependencyGraphInput;
  risk: RiskPenaltyInput;
  /** Missing upstream signal flags feed uncertainty. */
  missingSignals: {
    missingTime: boolean;
    missingMemory: boolean;
    conflictingSignals: boolean;
    lowDependencyClarity: boolean;
    /** High-priority open knowledge gaps from Missing Information Queue. */
    highPriorityGaps?: boolean;
  };
};

export type PriorityConflictFlag = {
  actionIdA: string;
  actionIdB: string;
  scoreA: number;
  scoreB: number;
  domainA: PriorityDomain;
  domainB: PriorityDomain;
  urgencyA: PriorityActionCandidate["urgencyClass"];
  urgencyB: PriorityActionCandidate["urgencyClass"];
  detail: string;
  /** Always true — Priority Engine flags only; Conflict Resolver owns resolution. */
  unresolved: true;
};

export type AppliedHardConstraint = {
  kind: HardConstraintKind;
  actionId: string;
  detail: string;
  /** Score after suppression (never forced to 0 solely by risk). */
  suppressedScore: number;
};

export type PriorityEngineGuaranteeResult = {
  ok: boolean;
  violations: string[];
};

export type PriorityEngineWeightEnvelope = {
  topScore: number;
  meanConfidence: number;
  conflictCount: number;
  passedCount: number;
  riskPenaltyApplied: boolean;
};

/** Explainable situation ranking from PriorityContract (canonical). */
export type SituationPriorityContractSnapshot = {
  rankedSituationIds: readonly string[];
  topSituationId?: string;
  overrideApplied: boolean;
  scores: readonly {
    situationId: string;
    priorityScore: number;
    safetyOverride: boolean;
    reasons: readonly string[];
  }[];
};

export type PriorityEngineLayerResult = {
  weights: PriorityWeights;
  candidates: readonly PriorityActionCandidate[];
  vectors: readonly PriorityVector[];
  /** Top-N after hard constraint filter — for Action Generator. */
  rankedForActionGenerator: readonly PriorityVector[];
  conflicts: readonly PriorityConflictFlag[];
  appliedConstraints: readonly AppliedHardConstraint[];
  envelope: PriorityEngineWeightEnvelope;
  guarantee: PriorityEngineGuaranteeResult;
  /**
   * Situation ranking via Situation Priority Contract (authoritative).
   * Present when trackedSituations were supplied to the process layer.
   */
  situationContract?: SituationPriorityContractSnapshot;
};

export type PriorityEngineLayerPayload = {
  vectorCount: number;
  topN: number;
  topScore: number;
  conflictCount: number;
  meanConfidence: number;
  weights: PriorityWeights;
  rankedActionIds: readonly string[];
  conflictActionIds: readonly string[];
  envelope: PriorityEngineWeightEnvelope;
  /** Situation Priority Contract ranking ids (when available). */
  rankedSituationIds?: readonly string[];
  priorityOverrideApplied?: boolean;
};

export type DefaultPriorityWeights = typeof DEFAULT_PRIORITY_WEIGHTS;
