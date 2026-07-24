import { detectLoadSignals } from "../load-interpretation/detect";
import { detectInteractionLoadSignals } from "../interaction-load-signal/detect";
import { DEPENDENCY_LOAD_PATTERNS, LOAD_DIMENSION_HIT } from "./contract-constants";
import type { DetectedLoadSignalFamilies, LoadSignalFamily } from "./types";

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
 * Language → signal families across cognitive, emotional, sleep, uncertainty, dependency.
 */
export function detectLoadSignalFamilies(rawInput: string): DetectedLoadSignalFamilies {
  const text = rawInput.trim();
  if (!text) {
    return {
      repetition: 0,
      sleep: 0,
      emotionalDistress: 0,
      uncertainty: 0,
      supervision: 0,
      assistance: 0,
      vigilance: 0,
      burnoutLanguage: 0,
      matchedFamilies: [],
    };
  }

  const loadSignals = detectLoadSignals(text);
  const interactionSignals = detectInteractionLoadSignals(text);

  const repetition = clamp01(
    Math.max(interactionSignals.repetitiveQuestioning, interactionSignals.redirectFailure * 0.85),
  );
  const sleep = clamp01(
    Math.max(loadSignals.sleepRisk, interactionSignals.nighttimeInterruption),
  );
  const emotionalDistress = clamp01(
    Math.max(loadSignals.emotionalLoad, interactionSignals.emotionalExhaustion),
  );
  const uncertainty = loadSignals.uncertaintyIndex;
  const supervision = clamp01(
    Math.max(
      scorePatternCategory(text, DEPENDENCY_LOAD_PATTERNS.supervision, 0.5),
      interactionSignals.alwaysOnCall * 0.9,
      loadSignals.cognitiveLoad * 0.85,
    ),
  );
  const assistance = clamp01(
    Math.max(
      scorePatternCategory(text, DEPENDENCY_LOAD_PATTERNS.assistance, 0.48),
      scorePatternCategory(text, DEPENDENCY_LOAD_PATTERNS.increasingDependency, 0.45),
    ),
  );
  const vigilance = loadSignals.cognitiveLoad;
  const burnoutLanguage = clamp01(
    Math.max(loadSignals.burnoutProbability, interactionSignals.emotionalExhaustion * 0.85),
  );

  const scores: Record<LoadSignalFamily, number> = {
    repetition,
    sleep,
    emotionalDistress,
    uncertainty,
    supervision,
    assistance,
    vigilance,
    burnoutLanguage,
  };

  const matchedFamilies = (Object.keys(scores) as LoadSignalFamily[]).filter(
    (key) => scores[key] >= LOAD_DIMENSION_HIT,
  );

  return {
    repetition,
    sleep,
    emotionalDistress,
    uncertainty,
    supervision,
    assistance,
    vigilance,
    burnoutLanguage,
    matchedFamilies,
  };
}
