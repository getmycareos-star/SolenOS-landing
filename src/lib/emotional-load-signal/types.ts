import type {
  COGNITIVE_FATIGUE_LEVELS,
  EMOTIONAL_LOAD_SIGNAL_FORBIDDEN,
} from "./contract-constants";

export type CognitiveFatigueLevel = (typeof COGNITIVE_FATIGUE_LEVELS)[number];

export type StressIndicators = {
  /** Active situation count + unresolved switching pressure. */
  situationSwitching: number;
  /** CRITICAL/HIGH urgency demands clustered together. */
  highUrgencyClustering: number;
  /** Unresolved conflicts + family conflict demands. */
  unresolvedConflicts: number;
  /** High-pressure demand escalation proxy. */
  escalatingNotifications: number;
  /** Active demand count + interruption proxy. */
  interruptionFrequency: number;
  /** Weighted composite 0–100. */
  composite: number;
};

export type BurnoutProbability = {
  /** 0–1 */
  value: number;
  reasoning: string;
};

export type CognitiveFatigue = {
  level: CognitiveFatigueLevel;
  explanation: string;
};

/** Per-situation emotional load contribution — not global-only. */
export type SituationEmotionalLoadContribution = {
  situationId: string;
  /** 0–100 contribution to global emotional load. */
  loadScore: number;
  /** Primary stress driver for this situation. */
  primaryDriver:
    | "switching"
    | "urgency_cluster"
    | "conflict"
    | "notifications"
    | "interruption"
    | "uncertainty";
  demandCount: number;
  unresolvedConflictWeight: number;
};

/** Recovery time modeling stub after situation resolution. */
export type RecoveryTimeEstimate = {
  /** Minutes until emotional load is expected to decay (stub). */
  estimatedMinutes: number;
  level: CognitiveFatigueLevel;
  note: string;
};

export type EmotionalLoadSignal = {
  stressIndicators: StressIndicators;
  burnoutProbability: BurnoutProbability;
  cognitiveFatigue: CognitiveFatigue;
  /** Composite score 0–100 driving fatigue classification. */
  compositeScore: number;
  perSituation: readonly SituationEmotionalLoadContribution[];
  recoveryTimeEstimate: RecoveryTimeEstimate;
  updatedAt: string;
};

export type EmotionalLoadSignalInputs = {
  activeSituationCount: number;
  unresolvedSituationCount: number;
  activeDemandCount: number;
  highPressureDemandCount: number;
  highUrgencyDemandCount: number;
  pendingConflictCount: number;
  /** 0–100 from CLI / beliefs. */
  uncertaintyLoad: number;
  /** 0–100 from CLI / beliefs. */
  conflictLoad: number;
  /** 0–100 operational load score from CLI. */
  operationalLoadScore: number;
  /** Memory emotional bias 0–1. */
  emotionalBias: number;
  /** Depletion state factor 0–1. */
  depletionFactor: number;
  /** Per-situation demand grouping. */
  demandsBySituation?: Readonly<
    Record<string, { demandCount: number; highPressure: number; urgencySum: number }>
  >;
};

export type LoadAwarePriorityAdjustment = {
  /** Adjusted top-N after emotional load balancing. */
  adjustedTopN: number;
  /** Reduce simultaneous high-priority actions. */
  deferNonCritical: boolean;
  /** Simplify multi-step recommendations. */
  simplifyRecommendations: boolean;
  /** Temporal weight reduction applied to priority fusion. */
  temporalWeightReduction: number;
  reasoning: string;
};

export type CaregiverProtectionMode = {
  engaged: boolean;
  reason: string;
  /** Human stability over task completion speed. */
  constraints: {
    maxActions: number;
    allowBranching: boolean;
    deferNonCritical: boolean;
    simplifyOutput: boolean;
  };
};

export type RecommendationLoadMetadata = {
  cognitiveLoadRequired: "LOW" | "MEDIUM" | "HIGH";
  emotionalImpact: "LOW" | "MEDIUM" | "HIGH";
  /** 0–1 contribution to burnout risk if action is taken now. */
  burnoutContribution: number;
};

export type EmotionalLoadGuaranteeResult = {
  ok: boolean;
  violations: string[];
};

export type EmotionalLoadSignalLayerResult = {
  signal: EmotionalLoadSignal;
  priorityAdjustment: LoadAwarePriorityAdjustment;
  protectionMode: CaregiverProtectionMode;
  /** When emotionalControl.emotionalLoadDetection is off, effects are observational only. */
  detectionEnabled: boolean;
  guarantee: EmotionalLoadGuaranteeResult;
};

export type PostDecisionEmotionalLoadResult = {
  protectionMode: CaregiverProtectionMode;
  recommendationMetadata: RecommendationLoadMetadata;
  outputConstraints: {
    maxActions: number;
    allowBranching: boolean;
    simplifyOutput: boolean;
  };
  /** Effective surface limit after post-decision constraints. */
  effectiveSurfaceLimit: number;
  guarantee: EmotionalLoadGuaranteeResult;
};

export type EmotionalLoadSignalLayerPayload = {
  cognitiveFatigueLevel: CognitiveFatigueLevel;
  burnoutProbability: number;
  burnoutReasoning: string;
  stressComposite: number;
  compositeScore: number;
  protectionModeEngaged: boolean;
  adjustedTopN: number;
  deferNonCritical: boolean;
  simplifyRecommendations: boolean;
  perSituationCount: number;
  recoveryMinutesStub: number;
  detectionEnabled: boolean;
  guaranteeOk: boolean;
};

export type EmotionalLoadForbidden = (typeof EMOTIONAL_LOAD_SIGNAL_FORBIDDEN)[number];
