/**
 * Outcome feedback loop — did recommendations work? Model updating.
 *
 * The pipeline is: input → understanding → recommendation. This layer adds
 * the missing loop: did the recommended action actually help? Did the
 * person's condition change as predicted? Was the prioritization correct?
 * Should the model update its understanding based on what happened?
 */

export const OUTCOME_FEEDBACK_VERSION = "1.0.0";

export type RecommendationOutcome = {
  id: string;
  recommendationId: string;
  recommendation: string;
  recommendedAt: string;
  /** What actually happened. */
  whatHappened: string;
  /** Did it help? */
  helped: "yes" | "no" | "partially" | "unknown";
  /** Did the person's condition change as predicted? */
  conditionChangedAsPredicted: "yes" | "no" | "partially" | "unknown";
  /** Was the prioritization correct? */
  prioritizationCorrect: "yes" | "no" | "partially" | "unknown";
  /** What should the model learn from this? */
  modelLearning: string[];
  /** Evidence for the outcome. */
  evidence: string[];
  recordedAt: string;
};

export type OutcomeFeedbackLoop = {
  version: string;
  careRecipientId: string;
  outcomes: RecommendationOutcome[];
  /** Aggregate learning across outcomes. */
  aggregateLearning: {
    totalOutcomes: number;
    helpedCount: number;
    notHelpedCount: number;
    partiallyHelpedCount: number;
    unknownCount: number;
    prioritizationAccuracy: number;
    predictionAccuracy: number;
    topLearnings: string[];
  };
  createdAt: string;
  updatedAt: string;
};

export function createEmptyOutcomeFeedback(careRecipientId: string, createdAt?: string): OutcomeFeedbackLoop {
  const now = createdAt ?? new Date().toISOString();
  return {
    version: OUTCOME_FEEDBACK_VERSION,
    careRecipientId,
    outcomes: [],
    aggregateLearning: {
      totalOutcomes: 0,
      helpedCount: 0,
      notHelpedCount: 0,
      partiallyHelpedCount: 0,
      unknownCount: 0,
      prioritizationAccuracy: 0,
      predictionAccuracy: 0,
      topLearnings: [],
    },
    createdAt: now,
    updatedAt: now,
  };
}

export function recordOutcome(
  loop: OutcomeFeedbackLoop,
  outcome: Omit<RecommendationOutcome, "id">,
): OutcomeFeedbackLoop {
  const now = new Date().toISOString();
  const newOutcome: RecommendationOutcome = {
    ...outcome,
    id: `of_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
  };
  const outcomes = [...loop.outcomes, newOutcome];
  const aggregate = computeAggregate(outcomes);
  return {
    ...loop,
    outcomes,
    aggregateLearning: aggregate,
    updatedAt: now,
  };
}

function computeAggregate(outcomes: RecommendationOutcome[]): OutcomeFeedbackLoop["aggregateLearning"] {
  const total = outcomes.length;
  const helped = outcomes.filter((o) => o.helped === "yes").length;
  const notHelped = outcomes.filter((o) => o.helped === "no").length;
  const partially = outcomes.filter((o) => o.helped === "partially").length;
  const unknown = outcomes.filter((o) => o.helped === "unknown").length;
  const predCorrect = outcomes.filter((o) => o.conditionChangedAsPredicted === "yes").length;
  const predPartial = outcomes.filter((o) => o.conditionChangedAsPredicted === "partially").length;
  const priorityCorrect = outcomes.filter((o) => o.prioritizationCorrect === "yes").length;
  const priorityPartial = outcomes.filter((o) => o.prioritizationCorrect === "partially").length;

  const learnings: string[] = [];
  if (total > 0) {
    if (helped / total < 0.5) learnings.push("Less than half of recommendations helped — review what is being suggested.");
    if (notHelped / total > 0.3) learnings.push("More than 30% of recommendations did not help — investigate why.");
    if (predCorrect + predPartial < total * 0.5) learnings.push("Condition predictions are often wrong — improve trajectory modeling.");
  }

  return {
    totalOutcomes: total,
    helpedCount: helped,
    notHelpedCount: notHelped,
    partiallyHelpedCount: partially,
    unknownCount: unknown,
    prioritizationAccuracy: total > 0 ? (priorityCorrect + priorityPartial * 0.5) / total : 0,
    predictionAccuracy: total > 0 ? (predCorrect + predPartial * 0.5) / total : 0,
    topLearnings: learnings,
  };
}

export function summarizeOutcomeFeedback(loop: OutcomeFeedbackLoop): {
  totalOutcomes: number;
  helpedRate: number;
  notHelpedRate: number;
  prioritizationAccuracy: number;
  predictionAccuracy: number;
  learningCount: number;
} {
  const total = loop.aggregateLearning.totalOutcomes;
  return {
    totalOutcomes: total,
    helpedRate: total > 0 ? loop.aggregateLearning.helpedCount / total : 0,
    notHelpedRate: total > 0 ? loop.aggregateLearning.notHelpedCount / total : 0,
    prioritizationAccuracy: loop.aggregateLearning.prioritizationAccuracy,
    predictionAccuracy: loop.aggregateLearning.predictionAccuracy,
    learningCount: loop.aggregateLearning.topLearnings.length,
  };
}