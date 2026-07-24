import {
  BOUNDARY_VIOLATION_STRESS_THRESHOLD,
  INTERACTION_LOAD_METRIC_BOOST,
  INTERACTION_LOAD_MIN_CATEGORIES,
  INTERACTION_PATTERN_HIT,
  REPETITION_FATIGUE_THRESHOLD,
} from "./contract-constants";
import type {
  DetectedInteractionLoadSignals,
  InteractionLoadFlag,
  InteractionLoadFlagEntry,
  InteractionLoadMetricDeltas,
  SleepDisruptionRiskLevel,
  SleepProtectionMode,
} from "./types";

export function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n * 100) / 100));
}

/**
 * Boundary Violation Index (0–100) — redirect failure, persistent re-engagement, entrapment loops.
 */
export function computeBoundaryViolationIndex(
  signals: DetectedInteractionLoadSignals,
): number {
  const redirect = signals.redirectFailure * 45;
  const repetition = signals.repetitiveQuestioning * 25;
  const alwaysOn = signals.alwaysOnCall * 20;
  const exhaustion = signals.emotionalExhaustion * 10;
  let score = redirect + repetition + alwaysOn + exhaustion;
  if (
    signals.redirectFailure >= INTERACTION_PATTERN_HIT &&
    signals.repetitiveQuestioning >= INTERACTION_PATTERN_HIT
  ) {
    score += 12;
  }
  if (
    signals.nighttimeInterruption >= INTERACTION_PATTERN_HIT &&
    signals.alwaysOnCall >= INTERACTION_PATTERN_HIT
  ) {
    score += 8;
  }
  return clampScore(score);
}

export function classifySleepDisruptionRisk(
  signals: DetectedInteractionLoadSignals,
): SleepDisruptionRiskLevel {
  const night = signals.nighttimeInterruption;
  const alwaysOn = signals.alwaysOnCall;
  if (night >= 0.55 || (night >= INTERACTION_PATTERN_HIT && alwaysOn >= INTERACTION_PATTERN_HIT)) {
    return "CRITICAL";
  }
  if (night >= INTERACTION_PATTERN_HIT || alwaysOn >= 0.45) {
    return "ELEVATED";
  }
  return "LOW";
}

export function computeInteractionLoadMetricDeltas(
  signals: DetectedInteractionLoadSignals,
): InteractionLoadMetricDeltas {
  const categoryCount = signals.matchedCategories.length;
  const boundaryViolationIndex = computeBoundaryViolationIndex(signals);
  const sleepDisruptionRisk = classifySleepDisruptionRisk(signals);

  const perPattern =
    categoryCount > 0 ? categoryCount : signals.matchedCategories.length;
  const emotionalLoadBoost = clampScore(
    perPattern * INTERACTION_LOAD_METRIC_BOOST.emotionalLoadPerPattern +
      signals.emotionalExhaustion * 30 +
      signals.repetitiveQuestioning * 20,
  );
  const cognitiveLoadBoost = clampScore(
    perPattern * INTERACTION_LOAD_METRIC_BOOST.cognitiveLoadPerPattern +
      signals.repetitiveQuestioning * 35,
  );
  const conflictLoadBoost = clampScore(
    boundaryViolationIndex * 0.35 +
      (sleepDisruptionRisk === "CRITICAL" ? 15 : sleepDisruptionRisk === "ELEVATED" ? 8 : 0),
  );
  const coordinationLoadBoost = clampScore(
    signals.repetitiveQuestioning * INTERACTION_LOAD_METRIC_BOOST.coordinationLoadPerRepetition +
      signals.alwaysOnCall * 12,
  );

  return {
    emotionalLoadBoost,
    cognitiveLoadBoost,
    sleepDisruptionRisk,
    boundaryViolationIndex,
    conflictLoadBoost,
    coordinationLoadBoost,
  };
}

export function evaluateInteractionLoadFlags(
  signals: DetectedInteractionLoadSignals,
  metrics: InteractionLoadMetricDeltas,
): InteractionLoadFlagEntry[] {
  const flags: InteractionLoadFlagEntry[] = [];

  const repetitionFatigue =
    signals.repetitiveQuestioning >= REPETITION_FATIGUE_THRESHOLD &&
    (signals.redirectFailure >= INTERACTION_PATTERN_HIT ||
      signals.alwaysOnCall >= INTERACTION_PATTERN_HIT ||
      signals.emotionalExhaustion >= INTERACTION_PATTERN_HIT);

  if (repetitionFatigue) {
    flags.push({
      code: "repetition_fatigue",
      description: "high recurrence interaction detected",
    });
  }

  const boundaryStress =
    signals.redirectFailure >= INTERACTION_PATTERN_HIT ||
    metrics.boundaryViolationIndex >= BOUNDARY_VIOLATION_STRESS_THRESHOLD;

  if (boundaryStress) {
    flags.push({
      code: "boundary_stress",
      description: "user unable to redirect or disengage",
    });
  }

  return flags;
}

export function isInteractionLoadDetected(
  signals: DetectedInteractionLoadSignals,
  flags: readonly InteractionLoadFlagEntry[],
): boolean {
  if (flags.length > 0) return true;
  if (signals.matchedCategories.length >= INTERACTION_LOAD_MIN_CATEGORIES) return true;
  return (
    signals.repetitiveQuestioning >= REPETITION_FATIGUE_THRESHOLD &&
    signals.emotionalExhaustion >= INTERACTION_PATTERN_HIT
  );
}

export function evaluateSleepProtectionMode(
  signals: DetectedInteractionLoadSignals,
  metrics: InteractionLoadMetricDeltas,
  detected: boolean,
): SleepProtectionMode {
  const criticalSleep = metrics.sleepDisruptionRisk === "CRITICAL";
  const elevatedWithLoad =
    metrics.sleepDisruptionRisk === "ELEVATED" && detected && signals.alwaysOnCall >= INTERACTION_PATTERN_HIT;

  const engaged = criticalSleep || elevatedWithLoad;

  let rationale = "Sleep protection not engaged.";
  if (criticalSleep) {
    rationale =
      "Nighttime interruptions or always-on expectation detected — suppress task-heavy output and protect rest boundaries.";
  } else if (elevatedWithLoad) {
    rationale =
      "Elevated sleep disruption with always-on interaction load — limit cognitive demand and prioritize containment.";
  }

  return {
    engaged,
    rationale,
    maxActions: engaged ? 2 : 4,
    suppressTaskHeavySuggestions: engaged,
    prioritizeCalmingOutput: engaged || detected,
  };
}

export function hasFlag(
  flags: readonly InteractionLoadFlagEntry[],
  code: InteractionLoadFlag,
): boolean {
  return flags.some((f) => f.code === code);
}
