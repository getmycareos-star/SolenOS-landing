import type {
  DECISION_CONFIDENCE_LEVELS,
  FAIL_SAFE_TRIGGER_KINDS,
} from "./contract-constants";

/**
 * Decision confidence attached to every Fail-Safe evaluation.
 * When Fail-Safe is engaged, level MUST NOT be HIGH.
 */
export type DecisionConfidence = {
  level: (typeof DECISION_CONFIDENCE_LEVELS)[number];
  reason: string;
};

export type FailSafeTriggerKind = (typeof FAIL_SAFE_TRIGGER_KINDS)[number];

export type FailSafeTriggerHit = {
  kind: FailSafeTriggerKind;
  reason: string;
};

/** Clarification posture — known / missing / must-clarify; never “Do this next”. */
export type ClarificationModeOutput = {
  mode: "clarification";
  known: readonly string[];
  missing: readonly string[];
  mustClarifyBeforeAction: readonly string[];
  /** Hard flag: recommendation surface is suppressed. */
  suppressedRecommendation: true;
};

export type FailSafeGuaranteeResult = {
  ok: boolean;
  violations: string[];
};

/**
 * Inputs derived from STATE + BELIEF + conflicts + responsibility + priority —
 * Fail-Safe does not invent fields not already knowable from the decision graph.
 */
export type FailSafeModeInput = {
  chosenActionId: string;
  chosenActionLabel: string;
  rejectedAlternatives?: readonly { id: string; label: string }[];
  /** Known facts / situation summaries already established. */
  knownFacts?: readonly string[];
  /** Open missing-information questions (any importance). */
  missingInfoQuestions?: readonly string[];
  /** HIGH missing info already blocked irreversible posture. */
  highMissingInfoBlocked?: boolean;
  highPriorityMissingInfoCount?: number;
  /** Open / unresolved conflict signals. */
  openConflictCount?: number;
  criticalDecisionRestricted?: boolean;
  reEvaluationRequired?: boolean;
  conflictClarificationQuestion?: string | null;
  /** Responsibility graph health / ownership gaps. */
  responsibilityEscalate?: boolean;
  responsibilityHealthState?: "healthy" | "at_risk" | "critical";
  criticalUnassignedCount?: number;
  unassignedCount?: number;
  ownershipConflictCount?: number;
  /** Risk / time pressure for HIGH RISK + LOW CONFIDENCE. */
  outputRiskLevel?: string;
  priorityOverrideApplied?: boolean;
  careContextUrgency?: string;
  medicalOrTimeSensitive?: boolean;
  /** Soft confidence signals — not strong when capped / penalized / unreliable. */
  confidenceCap?: number;
  conflictConfidencePenalty?: number;
  priorityMeanConfidence?: number;
  systemHealthBand?: "Strong" | "Stable" | "Degraded" | "Unreliable";
  systemHealthRequestClarification?: boolean;
  systemHealthBoostUncertainty?: boolean;
  /** Optional situation scope for escalation. */
  situationId?: string | null;
  userId?: string | null;
};

export type FailSafeModeResult = {
  engaged: boolean;
  triggers: readonly FailSafeTriggerHit[];
  decisionConfidence: DecisionConfidence;
  clarification: ClarificationModeOutput | null;
  /** Action id to feed Human Trust / history — clarify when engaged. */
  effectiveActionId: string;
  effectiveActionLabel: string;
  /** HIGH knowledge-gap questions escalated (or reaffirmed) while engaged. */
  escalatedMissingInfoQuestions: readonly string[];
  posture: "allow" | "clarify";
  guarantee: FailSafeGuaranteeResult;
};

export type FailSafeModeLayerPayload = {
  engaged: boolean;
  posture: "allow" | "clarify";
  triggers: readonly FailSafeTriggerHit[];
  decisionConfidence: DecisionConfidence;
  clarification: ClarificationModeOutput | null;
  effectiveActionId: string;
  effectiveActionLabel: string;
  escalatedMissingInfoQuestions: readonly string[];
  guaranteeOk: boolean;
};
