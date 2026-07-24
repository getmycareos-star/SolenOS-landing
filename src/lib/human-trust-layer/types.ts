import type {
  EMOTIONAL_READABILITY_LOAD_STATES,
  REVERSIBILITY_ACTIONS,
} from "./contract-constants";

/**
 * Required caregiver-facing explanation for every recommendation.
 * Plain language only — no internal system jargon in these strings.
 */
export type RecommendationExplanation = {
  whyThisWasChosen: string;
  whatWasIgnored: string[];
  riskIfIgnored: string;
};

export type ReversibilityAction = (typeof REVERSIBILITY_ACTIONS)[number];

export type AlternativeOption = {
  id: string;
  label: string;
};

/** UI/API affordances so a human can undo, ignore, or pick another option. */
export type ReversibilityAffordance = {
  canUndo: boolean;
  canIgnore: boolean;
  canChooseAlternative: boolean;
  undoLabel: string;
  ignoreLabel: string;
  chooseAlternativeLabel: string;
  alternatives: AlternativeOption[];
  supportedActions: ReversibilityAction[];
};

export type CaregiverLoadStateForTrust =
  | "LOW"
  | "MODERATE"
  | "HIGH"
  | "CRITICAL";

export type EmotionalReadabilityLoadState =
  (typeof EMOTIONAL_READABILITY_LOAD_STATES)[number];

/** Ranked demand / action node used to ground explanations in the decision graph. */
export type DecisionGraphDemand = {
  id: string;
  title: string;
  pressureScore?: number;
};

/**
 * Inputs for deterministic explanation generation.
 * Built only from Decision History factors, Priority Contract breakdown,
 * Demand ranking, Conflict clarifications, and Caregiver Load — never free LLM prose.
 */
export type DecisionExplanationContext = {
  chosenActionId: string;
  chosenActionLabel: string;
  rejectedAlternatives?: readonly AlternativeOption[];
  /** Priority Contract component summary lines (may be technical; stripped/translated). */
  priorityExplanationLines?: readonly string[];
  priorityOverrideApplied?: boolean;
  topSituationId?: string | null;
  demandRanking?: readonly DecisionGraphDemand[];
  conflictClarifications?: readonly string[];
  caregiverLoadState?: CaregiverLoadStateForTrust;
  /** Emotional distress / stress signal from memory or similar soft signals. */
  emotionalStress?: boolean;
  /** Caregiver Protection Mode — human stability over task speed. */
  caregiverProtectionMode?: boolean;
  /** Per-recommendation load metadata from Emotional Load Signal. */
  recommendationLoadMetadata?: {
    cognitiveLoadRequired: "LOW" | "MEDIUM" | "HIGH";
    emotionalImpact: "LOW" | "MEDIUM" | "HIGH";
    burnoutContribution: number;
  };
  highMissingInfoBlocked?: boolean;
  /** Fail-Safe Mode engaged — explain pause / clarification, not a completed next action. */
  failSafeEngaged?: boolean;
  failSafeMustClarify?: readonly string[];
  assumptionsUsed?: readonly string[];
  missingInfoImpact?: readonly string[];
  outputRiskLevel?: string;
  deferredDemandTitles?: readonly string[];
  /** Caregiver Confidence Layer — plain-English reassurance. */
  confidenceExplanation?: string;
  /** Crisis Prevention — subtle predictive warnings (not alarmist). */
  crisisWarnings?: readonly string[];
  /** Delegation — optional suggest-only when load elevated. */
  delegationSuggestions?: readonly {
    task: string;
    recommendedPerson: string;
    reason: string;
    loadReductionEstimate?: number;
  }[];
  /** Retention-critical normalization — EXPLANATION adjunct; does not change decision. */
  emotionalValidation?: {
    message: string;
    triggerReason: string;
    normalizeExperience: boolean;
  } | null;
  /** Containment mode — load reducer posture for explanation shaping. */
  containmentMode?: {
    engaged: boolean;
    whatNotToDoToday: readonly string[];
    emphasizeWhatCanWait: boolean;
  };
  moralInjurySeverity?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  identityDriftLevel?: "STABLE" | "EMERGING" | "SIGNIFICANT" | "FRAGMENTED";
  /** Load-First Interpretation — burden recognition before care advice. */
  loadFirstMode?: boolean;
  burdenSummary?: string;
  primaryContributors?: readonly string[];
  /** Caregiver Load Engine — five-dimension scores. */
  dependencyLoadScore?: number;
  cognitiveLoadScore?: number;
  burnoutTrend?: "stable" | "rising" | "critical";
  /** Interaction Load Signal — repetition fatigue / boundary stress flags. */
  interactionLoadFlags?: readonly {
    code: "repetition_fatigue" | "boundary_stress";
    description: string;
  }[];
  sleepProtectionMode?: boolean;
  outputStrategy?: "normal" | "interaction_survivability";
  boundaryViolationIndex?: number;
  interactionLoadInsight?: string;
};

export type ChallengeComparison = {
  question: string;
  chosenId: string;
  chosenLabel: string;
  alternativeId: string;
  alternativeLabel: string;
  whyChosenInstead: string;
  whatAlternativeWouldTrade: string;
  sharedFacts: string[];
};

export type HumanTrustGuaranteeResult = {
  ok: boolean;
  violations: string[];
};

export type HumanTrustLayerResult = {
  explanation: RecommendationExplanation;
  reversibility: ReversibilityAffordance;
  emotionalReadabilityApplied: boolean;
  /** Stable fingerprint of the decision graph inputs — same graph → same explanation. */
  decisionFingerprint: string;
  challengeModeAvailable: true;
  guarantee: HumanTrustGuaranteeResult;
  recommendationLoadMetadata?: DecisionExplanationContext["recommendationLoadMetadata"];
  caregiverProtectionMode?: boolean;
  confidenceExplanation?: string;
  emotionalValidation?: DecisionExplanationContext["emotionalValidation"];
  containmentModeEngaged?: boolean;
  whatNotToDoToday?: readonly string[];
  loadFirstMode?: boolean;
  burdenSummary?: string;
  primaryContributors?: readonly string[];
  interactionLoadFlags?: DecisionExplanationContext["interactionLoadFlags"];
  sleepProtectionMode?: boolean;
  outputStrategy?: DecisionExplanationContext["outputStrategy"];
  boundaryViolationIndex?: number;
  interactionLoadInsight?: string;
};

export type HumanTrustLayerPayload = {
  whyThisWasChosen: string;
  whatWasIgnored: string[];
  riskIfIgnored: string;
  reversibility: ReversibilityAffordance;
  emotionalReadabilityApplied: boolean;
  decisionFingerprint: string;
  challengeModeAvailable: true;
  guaranteeOk: boolean;
  recommendationLoadMetadata?: {
    cognitiveLoadRequired: "LOW" | "MEDIUM" | "HIGH";
    emotionalImpact: "LOW" | "MEDIUM" | "HIGH";
    burnoutContribution: number;
  };
  caregiverProtectionMode?: boolean;
  /** Plain-English caregiver reassurance from Confidence Layer. */
  confidenceExplanation?: string;
  emotionalValidation?: {
    message: string;
    triggerReason: string;
    normalizeExperience: boolean;
  } | null;
  containmentModeEngaged?: boolean;
  whatNotToDoToday?: readonly string[];
  loadFirstMode?: boolean;
  burdenSummary?: string;
  primaryContributors?: readonly string[];
  interactionLoadFlags?: DecisionExplanationContext["interactionLoadFlags"];
  sleepProtectionMode?: boolean;
  outputStrategy?: DecisionExplanationContext["outputStrategy"];
  boundaryViolationIndex?: number;
  interactionLoadInsight?: string;
};
