import {
  LOAD_SIGNAL_CATEGORY_HIT,
  LOAD_SIGNAL_PATTERNS,
} from "./contract-constants";
import type { DetectedLoadSignals, LoadSignalCategory } from "./types";

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, Math.round(n * 1000) / 1000));
}

function scorePatternCategory(
  input: string,
  patterns: readonly RegExp[],
  baseWeight: number,
): number {
  let hits = 0;
  for (const pattern of patterns) {
    if (pattern.test(input)) hits += 1;
  }
  if (hits === 0) return 0;
  return clamp01(Math.min(1, baseWeight + (hits - 1) * 0.15));
}

/**
 * Heuristic load signal detection on raw caregiver input — NOT LLM classification.
 */
export function detectLoadSignals(rawInput: string): DetectedLoadSignals {
  const text = rawInput.trim();
  if (!text) {
    return {
      emotionalLoad: 0,
      sleepRisk: 0,
      uncertaintyIndex: 0,
      cognitiveLoad: 0,
      burnoutProbability: 0,
      matchedCategories: [],
    };
  }

  const emotionalLoad = scorePatternCategory(
    text,
    LOAD_SIGNAL_PATTERNS.emotionalLoad,
    0.55,
  );
  const sleepRisk = scorePatternCategory(text, LOAD_SIGNAL_PATTERNS.sleepRisk, 0.5);
  const uncertaintyIndex = scorePatternCategory(
    text,
    LOAD_SIGNAL_PATTERNS.uncertaintyIndex,
    0.48,
  );
  const cognitiveLoad = scorePatternCategory(
    text,
    LOAD_SIGNAL_PATTERNS.cognitiveLoad,
    0.45,
  );
  const burnoutProbability = scorePatternCategory(
    text,
    LOAD_SIGNAL_PATTERNS.burnoutProbability,
    0.52,
  );

  const scores: Record<LoadSignalCategory, number> = {
    emotionalLoad,
    sleepRisk,
    uncertaintyIndex,
    cognitiveLoad,
    burnoutProbability,
  };

  const matchedCategories = (Object.keys(scores) as LoadSignalCategory[]).filter(
    (key) => scores[key] >= LOAD_SIGNAL_CATEGORY_HIT,
  );

  return {
    emotionalLoad,
    sleepRisk,
    uncertaintyIndex,
    cognitiveLoad,
    burnoutProbability,
    matchedCategories,
  };
}
