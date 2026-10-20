import type { Demand } from "../demand-engine/types";
import type {
  EmotionalLoadSignal,
  RecommendationLoadMetadata,
} from "./types";

function levelFromScore(score: number): "LOW" | "MEDIUM" | "HIGH" {
  if (score >= 66) return "HIGH";
  if (score >= 33) return "MEDIUM";
  return "LOW";
}

/**
 * Attach cognitiveLoadRequired / emotionalImpact / burnoutContribution to a recommendation.
 */
export function computeRecommendationLoadMetadata(params: {
  signal: EmotionalLoadSignal;
  chosenActionId: string;
  chosenDemand?: Demand | null;
  isMultiStep?: boolean;
}): RecommendationLoadMetadata {
  const { signal, chosenDemand, isMultiStep } = params;
  const demand = chosenDemand;

  const baseCognitive =
    (demand?.effort ?? 30) * 0.3 +
    (demand?.uncertainty ?? 20) * 0.25 +
    (isMultiStep ? 25 : 10) +
    (signal.cognitiveFatigue.level === "CRITICAL"
      ? 20
      : signal.cognitiveFatigue.level === "HIGH"
        ? 12
        : 0);

  const baseEmotional =
    (demand?.emotionalLoad ?? 20) * 0.4 +
    signal.stressIndicators.composite * 0.35 +
    signal.burnoutProbability.value * 100 * 0.25;

  const burnoutContribution = Math.min(
    1,
    signal.burnoutProbability.value * 0.6 +
      (demand?.emotionalLoad ?? 0) / 100 * 0.25 +
      (signal.cognitiveFatigue.level === "CRITICAL" ? 0.15 : 0),
  );

  return {
    cognitiveLoadRequired: levelFromScore(baseCognitive),
    emotionalImpact: levelFromScore(baseEmotional),
    burnoutContribution: Math.round(burnoutContribution * 1000) / 1000,
  };
}

/**
 * Apply load-aware temporal reduction to priority vector scores when deferring non-critical.
 */
export function applyLoadAwareTemporalReduction(
  totalScore: number,
  temporalComponent: number,
  reduction: number,
  deferNonCritical: boolean,
  isCriticalAction: boolean,
): number {
  if (!deferNonCritical || isCriticalAction || reduction <= 0) return totalScore;
  return Math.max(0, totalScore - temporalComponent * reduction);
}
