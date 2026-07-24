import {
  ACUTE_BURNOUT_GROUNDING_MESSAGE,
  EMOTIONAL_HARM_SIGNALS,
  SLEEP_DISRUPTION_SIGNALS,
  UNCERTAINTY_OVERLOAD_SIGNALS,
} from "./contract-constants";
import type {
  AcuteCaregiverBurnoutRiskState,
  EmotionalLoadScoreLevel,
  HighSignalStressPatternResult,
  SafetyStressEnvironmentFlag,
  SleepDisruptionRisk,
  UncertaintyIndex,
} from "./types";

function matchPatterns(
  text: string,
  patterns: readonly { pattern: RegExp; indicator: string }[],
): string[] {
  const indicators: string[] = [];
  for (const { pattern, indicator } of patterns) {
    if (pattern.test(text) && !indicators.includes(indicator)) {
      indicators.push(indicator);
    }
  }
  return indicators;
}

function classifyEmotionalLoadScore(indicatorCount: number): EmotionalLoadScoreLevel {
  if (indicatorCount >= 2) return "HIGH";
  if (indicatorCount === 1) return "MEDIUM";
  return "LOW";
}

function classifySleepDisruptionRisk(indicators: readonly string[]): SleepDisruptionRisk {
  if (indicators.length === 0) return "LOW";
  const critical =
    indicators.some((i) =>
      /sleepless|no sleep|haven'?t slept|up all night|always.?on|no recovery|no rest/i.test(i),
    ) || indicators.length >= 2;
  if (critical) return "CRITICAL";
  if (indicators.length >= 1) return "HIGH";
  return "MEDIUM";
}

function classifyUncertaintyIndex(indicatorCount: number): UncertaintyIndex {
  if (indicatorCount >= 2) return "HIGH";
  if (indicatorCount === 1) return "MEDIUM";
  return "LOW";
}

function isSafetyStressEnvironment(
  emotionalHarmIndicators: readonly string[],
): SafetyStressEnvironmentFlag {
  const hostile = emotionalHarmIndicators.some((i) =>
    /verbal abuse|yelled|hostile|emotional (?:abuse|harm)|put (?:me )?down|cruel|threaten/i.test(i),
  );
  return hostile;
}

function buildExplanation(
  emotional: readonly string[],
  sleep: readonly string[],
  uncertainty: readonly string[],
  acute: AcuteCaregiverBurnoutRiskState,
): string {
  if (acute) {
    return "Acute Caregiver Burnout Risk State: emotional threat + sleep deprivation + uncertainty overload — cognitive-emotional survivability over task management.";
  }
  const parts: string[] = [];
  if (emotional.length > 0) {
    parts.push(`emotional load (${emotional.slice(0, 2).join(", ")})`);
  }
  if (sleep.length > 0) {
    parts.push(`sleep disruption (${sleep.slice(0, 2).join(", ")})`);
  }
  if (uncertainty.length > 0) {
    parts.push(`uncertainty (${uncertainty.slice(0, 2).join(", ")})`);
  }
  return parts.length > 0
    ? `High-signal stress pattern partial: ${parts.join("; ")}.`
    : "No high-signal caregiver stress pattern detected.";
}

export type DetectHighSignalStressParams = {
  userInput?: string;
};

/**
 * Detect caregiver distress from unstructured text — emotional threat, sleep deprivation,
 * uncertainty overload. NOT a task or medical information problem.
 */
export function detectHighSignalStressPattern(
  params: DetectHighSignalStressParams,
): HighSignalStressPatternResult {
  const input = (params.userInput ?? "").trim();
  const emotionalHarmIndicators = matchPatterns(input, EMOTIONAL_HARM_SIGNALS);
  const sleepIndicators = matchPatterns(input, SLEEP_DISRUPTION_SIGNALS);
  const uncertaintyIndicators = matchPatterns(input, UNCERTAINTY_OVERLOAD_SIGNALS);

  const emotionalLoadScore = classifyEmotionalLoadScore(emotionalHarmIndicators.length);
  const sleepDisruptionRisk = classifySleepDisruptionRisk(sleepIndicators);
  const uncertaintyIndex = classifyUncertaintyIndex(uncertaintyIndicators.length);
  const safetyStressEnvironmentFlag = isSafetyStressEnvironment(emotionalHarmIndicators);

  const hasEmotionalHarm =
    emotionalHarmIndicators.length > 0 || emotionalLoadScore === "HIGH";
  const hasSleepDisruption = sleepIndicators.length > 0;
  const hasUncertaintyOverload = uncertaintyIndicators.length > 0;

  const acuteCaregiverBurnoutRiskState: AcuteCaregiverBurnoutRiskState =
    hasEmotionalHarm && hasSleepDisruption && hasUncertaintyOverload;

  const groundingMessage = acuteCaregiverBurnoutRiskState
    ? ACUTE_BURNOUT_GROUNDING_MESSAGE
    : null;

  return {
    emotionalLoadScore,
    sleepDisruptionRisk,
    uncertaintyIndex,
    safetyStressEnvironmentFlag,
    acuteCaregiverBurnoutRiskState,
    signals: {
      emotionalHarm: {
        detected: hasEmotionalHarm,
        indicators: emotionalHarmIndicators,
      },
      sleepDisruption: {
        detected: hasSleepDisruption,
        indicators: sleepIndicators,
      },
      uncertaintyOverload: {
        detected: hasUncertaintyOverload,
        indicators: uncertaintyIndicators,
      },
    },
    groundingMessage,
    explanation: buildExplanation(
      emotionalHarmIndicators,
      sleepIndicators,
      uncertaintyIndicators,
      acuteCaregiverBurnoutRiskState,
    ),
  };
}

/** Metric boosts for downstream ELS / CLI — derived from high-signal detection. */
export function highSignalStressMetricBoosts(result: HighSignalStressPatternResult): {
  uncertaintyLoadFloor: number;
  depletionFactorFloor: number;
  emotionalBiasFloor: number;
  compositeScoreFloor: number;
  conflictLoadFloor: number;
} {
  let uncertaintyLoadFloor = 0;
  let depletionFactorFloor = 0;
  let emotionalBiasFloor = 0;
  let compositeScoreFloor = 0;
  let conflictLoadFloor = 0;

  if (result.uncertaintyIndex === "HIGH") uncertaintyLoadFloor = 75;
  else if (result.uncertaintyIndex === "MEDIUM") uncertaintyLoadFloor = 50;

  if (result.emotionalLoadScore === "HIGH") {
    depletionFactorFloor = Math.max(depletionFactorFloor, 0.72);
    emotionalBiasFloor = Math.max(emotionalBiasFloor, 0.45);
    compositeScoreFloor = Math.max(compositeScoreFloor, 68);
  } else if (result.emotionalLoadScore === "MEDIUM") {
    depletionFactorFloor = Math.max(depletionFactorFloor, 0.5);
    emotionalBiasFloor = Math.max(emotionalBiasFloor, 0.28);
  }

  if (result.sleepDisruptionRisk === "CRITICAL") {
    depletionFactorFloor = Math.max(depletionFactorFloor, 0.88);
    compositeScoreFloor = Math.max(compositeScoreFloor, 78);
  } else if (result.sleepDisruptionRisk === "HIGH") {
    depletionFactorFloor = Math.max(depletionFactorFloor, 0.65);
    compositeScoreFloor = Math.max(compositeScoreFloor, 58);
  }

  if (result.safetyStressEnvironmentFlag) {
    conflictLoadFloor = Math.max(conflictLoadFloor, 55);
    emotionalBiasFloor = Math.max(emotionalBiasFloor, 0.38);
  }

  if (result.acuteCaregiverBurnoutRiskState) {
    uncertaintyLoadFloor = Math.max(uncertaintyLoadFloor, 80);
    depletionFactorFloor = Math.max(depletionFactorFloor, 0.9);
    compositeScoreFloor = Math.max(compositeScoreFloor, 82);
    conflictLoadFloor = Math.max(conflictLoadFloor, 60);
  }

  return {
    uncertaintyLoadFloor,
    depletionFactorFloor,
    emotionalBiasFloor,
    compositeScoreFloor,
    conflictLoadFloor,
  };
}
