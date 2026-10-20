import {
  buildRecommendationExplanation,
  buildReversibilityAffordance,
  fingerprintDecisionContext,
} from "./build-explanation";
import type {
  DecisionExplanationContext,
  HumanTrustGuaranteeResult,
  HumanTrustLayerPayload,
  HumanTrustLayerResult,
  RecommendationExplanation,
} from "./types";

/**
 * Every successful recommendation must carry a complete explanation.
 */
export function runHumanTrustGuarantee(
  explanation: RecommendationExplanation,
): HumanTrustGuaranteeResult {
  const violations: string[] = [];
  if (!explanation.whyThisWasChosen?.trim()) {
    violations.push("whyThisWasChosen must be a non-empty simple explanation");
  }
  if (!Array.isArray(explanation.whatWasIgnored) || explanation.whatWasIgnored.length === 0) {
    violations.push("whatWasIgnored must list at least one deferred/ignored item");
  } else if (explanation.whatWasIgnored.some((item) => !item?.trim())) {
    violations.push("whatWasIgnored entries must be non-empty");
  }
  if (!explanation.riskIfIgnored?.trim()) {
    violations.push("riskIfIgnored must describe what happens if the recommendation is skipped");
  }
  return { ok: violations.length === 0, violations };
}

/**
 * HUMAN TRUST LAYER entry — EXPLANATION only.
 * Call AFTER Decision Engine assembly and BEFORE Safety Enforcement.
 */
export function buildHumanTrustLayer(
  decisionContext: DecisionExplanationContext,
): HumanTrustLayerResult {
  const explanation = buildRecommendationExplanation(decisionContext);
  const alternatives =
    decisionContext.rejectedAlternatives?.map((a) => ({
      id: a.id,
      label: a.label,
    })) ??
    (decisionContext.demandRanking ?? [])
      .filter((d) => d.id !== decisionContext.chosenActionId)
      .slice(0, 5)
      .map((d) => ({ id: d.id, label: d.title }));

  const reversibility = buildReversibilityAffordance(alternatives);
  const guarantee = runHumanTrustGuarantee(explanation);
  const emotionalReadabilityApplied =
    decisionContext.emotionalStress === true ||
    decisionContext.caregiverLoadState === "HIGH" ||
    decisionContext.caregiverLoadState === "CRITICAL" ||
    decisionContext.caregiverProtectionMode === true ||
    decisionContext.loadFirstMode === true ||
    decisionContext.containmentMode?.engaged === true ||
    decisionContext.emotionalValidation?.normalizeExperience === true ||
    decisionContext.outputStrategy === "interaction_survivability" ||
    decisionContext.sleepProtectionMode === true;

  return {
    explanation,
    reversibility,
    emotionalReadabilityApplied,
    decisionFingerprint: fingerprintDecisionContext(decisionContext),
    challengeModeAvailable: true,
    guarantee,
    recommendationLoadMetadata: decisionContext.recommendationLoadMetadata,
    caregiverProtectionMode: decisionContext.caregiverProtectionMode,
    confidenceExplanation: decisionContext.confidenceExplanation,
    emotionalValidation: decisionContext.emotionalValidation ?? null,
    containmentModeEngaged: decisionContext.containmentMode?.engaged,
    whatNotToDoToday: decisionContext.containmentMode?.whatNotToDoToday,
    loadFirstMode: decisionContext.loadFirstMode,
    burdenSummary: decisionContext.burdenSummary,
    primaryContributors: decisionContext.primaryContributors
      ? [...decisionContext.primaryContributors]
      : undefined,
    interactionLoadFlags: decisionContext.interactionLoadFlags
      ? [...decisionContext.interactionLoadFlags]
      : undefined,
    sleepProtectionMode: decisionContext.sleepProtectionMode,
    outputStrategy: decisionContext.outputStrategy,
    boundaryViolationIndex: decisionContext.boundaryViolationIndex,
    interactionLoadInsight: decisionContext.interactionLoadInsight,
  };
}

export function toHumanTrustLayerPayload(
  result: HumanTrustLayerResult,
): HumanTrustLayerPayload {
  return {
    whyThisWasChosen: result.explanation.whyThisWasChosen,
    whatWasIgnored: [...result.explanation.whatWasIgnored],
    riskIfIgnored: result.explanation.riskIfIgnored,
    reversibility: result.reversibility,
    emotionalReadabilityApplied: result.emotionalReadabilityApplied,
    decisionFingerprint: result.decisionFingerprint,
    challengeModeAvailable: true,
    guaranteeOk: result.guarantee.ok,
    recommendationLoadMetadata: result.recommendationLoadMetadata,
    caregiverProtectionMode: result.caregiverProtectionMode,
    confidenceExplanation: result.confidenceExplanation,
    emotionalValidation: result.emotionalValidation ?? null,
    containmentModeEngaged: result.containmentModeEngaged,
    whatNotToDoToday: result.whatNotToDoToday ? [...result.whatNotToDoToday] : undefined,
    loadFirstMode: result.loadFirstMode,
    burdenSummary: result.burdenSummary,
    primaryContributors: result.primaryContributors
      ? [...result.primaryContributors]
      : undefined,
    interactionLoadFlags: result.interactionLoadFlags
      ? [...result.interactionLoadFlags]
      : undefined,
    sleepProtectionMode: result.sleepProtectionMode,
    outputStrategy: result.outputStrategy,
    boundaryViolationIndex: result.boundaryViolationIndex,
    interactionLoadInsight: result.interactionLoadInsight,
  };
}

/** Alias used by pipeline callers — same as buildHumanTrustLayer. */
export function processHumanTrustLayer(
  decisionContext: DecisionExplanationContext,
): HumanTrustLayerResult {
  return buildHumanTrustLayer(decisionContext);
}
