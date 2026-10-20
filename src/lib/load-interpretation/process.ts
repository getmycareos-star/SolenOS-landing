import {
  LOAD_FIRST_BURNOUT_THRESHOLD,
  LOAD_FIRST_EMOTIONAL_SCORE_THRESHOLD,
  LOAD_FIRST_MIN_SIGNAL_CATEGORIES,
  LOAD_SIGNAL_CATEGORY_HIT,
} from "./contract-constants";
import {
  buildBurdenSummary,
  buildPrimaryContributors,
  computeEmotionalLoadScore,
} from "./build-burden";
import { detectLoadSignals } from "./detect";
import type {
  LoadInterpretation,
  LoadInterpretationLayerPayload,
} from "./types";

function evaluateLoadFirstMode(
  signals: ReturnType<typeof detectLoadSignals>,
  emotionalLoadScore: number,
  burnoutProbability: number,
): boolean {
  const categoryHits = signals.matchedCategories.length;
  if (categoryHits >= LOAD_FIRST_MIN_SIGNAL_CATEGORIES) return true;
  if (emotionalLoadScore >= LOAD_FIRST_EMOTIONAL_SCORE_THRESHOLD) return true;
  if (burnoutProbability >= LOAD_FIRST_BURNOUT_THRESHOLD) return true;
  if (
    signals.emotionalLoad >= LOAD_SIGNAL_CATEGORY_HIT &&
    (signals.sleepRisk >= LOAD_SIGNAL_CATEGORY_HIT ||
      signals.uncertaintyIndex >= LOAD_SIGNAL_CATEGORY_HIT)
  ) {
    return true;
  }
  return false;
}

export type ProcessLoadInterpretationParams = {
  rawInput: string;
};

/**
 * Early pipeline pass — after input classification / care context, before heavy LLM care advice shaping.
 */
export function processLoadInterpretation(
  params: ProcessLoadInterpretationParams,
): LoadInterpretation {
  const signals = detectLoadSignals(params.rawInput);
  const emotionalLoadScore = computeEmotionalLoadScore(signals);
  const burnoutProbability = Math.max(
    signals.burnoutProbability,
    emotionalLoadScore >= 55 ? 0.55 : 0,
  );
  const primaryContributors = buildPrimaryContributors(signals);
  const burdenSummary = buildBurdenSummary(signals, emotionalLoadScore);
  const loadFirstMode = evaluateLoadFirstMode(
    signals,
    emotionalLoadScore,
    burnoutProbability,
  );

  return {
    emotionalLoadScore,
    sleepRisk: signals.sleepRisk,
    burnoutProbability,
    uncertaintyIndex: signals.uncertaintyIndex,
    primaryContributors,
    burdenSummary,
    loadFirstMode,
  };
}

export function toLoadInterpretationLayerPayload(
  interpretation: LoadInterpretation,
): LoadInterpretationLayerPayload {
  return {
    emotionalLoadScore: interpretation.emotionalLoadScore,
    sleepRisk: interpretation.sleepRisk,
    burnoutProbability: interpretation.burnoutProbability,
    uncertaintyIndex: interpretation.uncertaintyIndex,
    loadFirstMode: interpretation.loadFirstMode,
    primaryContributors: [...interpretation.primaryContributors],
    burdenSummary: interpretation.burdenSummary,
    matchedCategoryCount: interpretation.primaryContributors.length,
  };
}

export function formatLoadInterpretationObservation(
  interpretation: LoadInterpretation,
): string {
  return `OBSERVATION: LOAD_INTERPRETATION score=${interpretation.emotionalLoadScore} loadFirst=${interpretation.loadFirstMode} sleep=${interpretation.sleepRisk.toFixed(2)} uncertainty=${interpretation.uncertaintyIndex.toFixed(2)} burnout=${interpretation.burnoutProbability.toFixed(2)}`;
}
