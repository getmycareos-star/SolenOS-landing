import type {
  CareContext,
  ConfidenceLevel,
  PrioritizedAction,
  TrustExplanation,
} from "../types";
import { assessCaregiverLoad } from "./caregiver-load-engine";

/**
 * Trust Layer — every recommendation must explain why, what evidence supports it,
 * what is missing, how recent the information is, and how confidence was determined.
 */
export function buildTrustExplanation(
  action: Omit<PrioritizedAction, "trust">,
  context: CareContext,
): TrustExplanation {
  const load = context.caregiverLoad ?? assessCaregiverLoad(context);
  const eventCount = context.timeline.length;
  const latestEvent = context.timeline[context.timeline.length - 1];
  const recency = latestEvent
    ? `Most recent event: ${latestEvent.dateLabel} (recorded ${latestEvent.recordedAt.slice(0, 10)})`
    : "No events recorded";

  const supportingEvidence: string[] = [action.reason];
  const missingInformation: string[] = [...context.uncertainties];

  if (eventCount < 5) {
    missingInformation.push(
      "Limited event history — confidence improves with more documented observations.",
    );
  }

  let confidenceLevel: ConfidenceLevel;
  let confidenceReason: string;

  if (eventCount >= 8 && context.uncertainties.length <= 1 && load.level !== "critical") {
    confidenceLevel = "appropriate";
    confidenceReason =
      "Sufficient timeline depth and manageable uncertainty support this guidance.";
  } else if (eventCount >= 3 && missingInformation.length <= 2) {
    confidenceLevel = "moderate";
    confidenceReason =
      "Some evidence exists but gaps remain — guidance should be treated as directional, not definitive.";
  } else {
    confidenceLevel = "low";
    confidenceReason =
      "Insufficient context for high-confidence guidance — clarifications recommended before acting.";
  }

  if (load.level === "critical") {
    supportingEvidence.push(
      `Caregiver load assessed as ${load.level} (score: ${load.score})`,
    );
  }

  return {
    whyThisRecommendation: action.reason,
    supportingEvidence,
    missingInformation,
    informationRecency: recency,
    confidenceLevel,
    confidenceReason,
  };
}

export function attachTrustToActions(
  actions: PrioritizedAction[],
  context: CareContext,
): PrioritizedAction[] {
  return actions.map((action) => ({
    ...action,
    trust: buildTrustExplanation(action, context),
  }));
}

export function formatTrustExplanation(trust: TrustExplanation): string {
  return [
    `Why: ${trust.whyThisRecommendation}`,
    `Confidence: ${trust.confidenceLevel} — ${trust.confidenceReason}`,
    `Recency: ${trust.informationRecency}`,
    `Evidence: ${trust.supportingEvidence.join("; ")}`,
    trust.missingInformation.length > 0
      ? `Missing: ${trust.missingInformation.join("; ")}`
      : "Missing: None identified",
  ].join("\n");
}
