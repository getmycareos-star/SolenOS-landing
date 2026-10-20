import {
  FEATURE_ACCEPTANCE_QUESTIONS,
  MIN_FEATURE_ACCEPTANCE_YES,
} from "./contract-constants";
import type { FeatureAcceptanceResult } from "./types";

export function evaluateFeatureAcceptance(
  featureName: string,
  answers: boolean[],
): FeatureAcceptanceResult {
  const questions = FEATURE_ACCEPTANCE_QUESTIONS.map((q, i) => ({
    question: q,
    answer: answers[i] ?? false,
  }));

  const yes_count = questions.filter((q) => q.answer).length;

  return {
    feature_name: featureName,
    questions,
    accepted: yes_count >= MIN_FEATURE_ACCEPTANCE_YES,
    yes_count,
    required_yes: MIN_FEATURE_ACCEPTANCE_YES,
  };
}

export function createFeatureAcceptanceTemplate(
  featureName = "New feature",
): FeatureAcceptanceResult {
  return evaluateFeatureAcceptance(
    featureName,
    FEATURE_ACCEPTANCE_QUESTIONS.map(() => false),
  );
}
