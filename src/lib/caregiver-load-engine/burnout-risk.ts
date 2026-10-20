import { classifyBurnoutTier } from "../attention-engine/burnout-tier";
import {
  BURNOUT_ACUTE_FLOOR,
  BURNOUT_CRITICAL_THRESHOLD,
  BURNOUT_FORMULA_WEIGHTS,
  BURNOUT_RISING_THRESHOLD,
  LOAD_FIRST_BURNOUT_THRESHOLD,
} from "./contract-constants";
import type { BurnoutModel, BurnoutTrend, LoadScores } from "./types";

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, Math.round(n * 1000) / 1000));
}

export type ComputeBurnoutParams = {
  scores: LoadScores;
  burnoutLanguageSignal: number;
  acuteBurnoutTriggered?: boolean;
  /** Optional downstream ELS burnout for late binding. */
  emotionalBurnoutProbability?: number;
};

function classifyTrend(probability: number, acute: boolean): BurnoutTrend {
  if (acute || probability >= BURNOUT_CRITICAL_THRESHOLD) return "critical";
  if (probability >= BURNOUT_RISING_THRESHOLD) return "rising";
  return "stable";
}

function buildReasoning(
  probability: number,
  scores: LoadScores,
  acute: boolean,
): string {
  if (acute) {
    return "Acute burnout risk: emotional harm + sleep disruption + uncertainty overload detected together.";
  }
  const contributors: string[] = [];
  if (scores.emotionalLoadScore >= 55) contributors.push("high emotional load");
  if (scores.cognitiveLoadScore >= 50) contributors.push("cognitive fatigue");
  if (scores.sleepRiskScore >= 45) contributors.push("sleep disruption");
  if (scores.uncertaintyIndex >= 0.45) contributors.push("rising uncertainty");
  if (scores.dependencyLoadScore >= 45) contributors.push("increasing dependency");
  if (contributors.length === 0) {
    return `Burnout probability ${(probability * 100).toFixed(0)}% — load within manageable range.`;
  }
  return `Burnout probability ${(probability * 100).toFixed(0)}% driven by ${contributors.slice(0, 3).join(", ")}.`;
}

/**
 * Unified burnout from load combination + acute triad + optional ELS signal.
 */
export function computeBurnoutRisk(params: ComputeBurnoutParams): BurnoutModel {
  const w = BURNOUT_FORMULA_WEIGHTS;
  const composite = clamp01(
    (params.scores.emotionalLoadScore / 100) * w.emotional +
      (params.scores.cognitiveLoadScore / 100) * w.cognitive +
      (params.scores.sleepRiskScore / 100) * w.sleep +
      params.scores.uncertaintyIndex * w.uncertainty +
      (params.scores.dependencyLoadScore / 100) * w.dependency +
      params.burnoutLanguageSignal * 0.12,
  );

  let probability = composite;
  if (params.burnoutLanguageSignal >= 0.35) {
    probability = Math.max(probability, 0.38 + params.burnoutLanguageSignal * 0.15);
  }
  if (params.scores.emotionalLoadScore >= 55) {
    probability = Math.max(probability, 0.55);
  }
  if (params.acuteBurnoutTriggered) {
    probability = Math.max(probability, BURNOUT_ACUTE_FLOOR);
  }
  if (params.emotionalBurnoutProbability !== undefined) {
    probability = Math.max(probability, params.emotionalBurnoutProbability);
  }

  const acuteTriggered = params.acuteBurnoutTriggered === true;
  const trend = classifyTrend(probability, acuteTriggered);

  return {
    probability,
    trend,
    tier: classifyBurnoutTier(probability, acuteTriggered),
    acuteTriggered,
    reasoning: buildReasoning(probability, params.scores, acuteTriggered),
  };
}

export function isLoadFirstBurnout(probability: number): boolean {
  return probability >= LOAD_FIRST_BURNOUT_THRESHOLD;
}
