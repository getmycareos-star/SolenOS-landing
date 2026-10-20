import {
  INTERACTION_LOAD_PATTERNS,
  INTERACTION_PATTERN_HIT,
} from "./contract-constants";
import type {
  DetectedInteractionLoadSignals,
  InteractionLoadPatternCategory,
} from "./types";

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
  return clamp01(Math.min(1, baseWeight + (hits - 1) * 0.12));
}

/**
 * Heuristic interaction load detection — NOT medical symptom classification.
 */
export function detectInteractionLoadSignals(rawInput: string): DetectedInteractionLoadSignals {
  const text = rawInput.trim();
  if (!text) {
    return {
      repetitiveQuestioning: 0,
      redirectFailure: 0,
      nighttimeInterruption: 0,
      emotionalExhaustion: 0,
      alwaysOnCall: 0,
      matchedCategories: [],
    };
  }

  const repetitiveQuestioning = scorePatternCategory(
    text,
    INTERACTION_LOAD_PATTERNS.repetitiveQuestioning,
    0.52,
  );
  const redirectFailure = scorePatternCategory(
    text,
    INTERACTION_LOAD_PATTERNS.redirectFailure,
    0.5,
  );
  const nighttimeInterruption = scorePatternCategory(
    text,
    INTERACTION_LOAD_PATTERNS.nighttimeInterruption,
    0.55,
  );
  const emotionalExhaustion = scorePatternCategory(
    text,
    INTERACTION_LOAD_PATTERNS.emotionalExhaustion,
    0.48,
  );
  const alwaysOnCall = scorePatternCategory(
    text,
    INTERACTION_LOAD_PATTERNS.alwaysOnCall,
    0.5,
  );

  const scores: Record<InteractionLoadPatternCategory, number> = {
    repetitiveQuestioning,
    redirectFailure,
    nighttimeInterruption,
    emotionalExhaustion,
    alwaysOnCall,
  };

  const matchedCategories = (Object.keys(scores) as InteractionLoadPatternCategory[]).filter(
    (key) => scores[key] >= INTERACTION_PATTERN_HIT,
  );

  return {
    repetitiveQuestioning,
    redirectFailure,
    nighttimeInterruption,
    emotionalExhaustion,
    alwaysOnCall,
    matchedCategories,
  };
}
