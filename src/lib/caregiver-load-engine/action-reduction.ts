import {
  ACTION_REDUCTION_LIMITS,
  LOAD_FIRST_EMOTIONAL_SCORE_THRESHOLD,
  LOAD_FIRST_MIN_SIGNAL_CATEGORIES,
  LOAD_FIRST_MINIMAL_ACTION,
  LOAD_FIRST_SAFE_TO_IGNORE,
} from "./contract-constants";
import type { ActionReductionStrategy, CaregiverState, LoadScores } from "./types";

export type DeriveActionReductionParams = {
  scores: LoadScores;
  loadFirstMode: boolean;
  burnoutProbability: number;
  acuteBurnoutTriggered: boolean;
  interactionLoadDetected?: boolean;
  sleepProtectionEngaged?: boolean;
  containmentEngaged?: boolean;
};

function resolveMaxActions(params: DeriveActionReductionParams): number {
  if (params.containmentEngaged || params.acuteBurnoutTriggered) {
    return ACTION_REDUCTION_LIMITS.acuteBurnout;
  }
  if (params.loadFirstMode) return ACTION_REDUCTION_LIMITS.loadFirst;
  if (params.sleepProtectionEngaged) return ACTION_REDUCTION_LIMITS.sleepProtection;
  if (params.interactionLoadDetected) return ACTION_REDUCTION_LIMITS.interactionLoad;
  if (params.scores.emotionalLoadScore >= 55 || params.burnoutProbability >= 0.55) {
    return ACTION_REDUCTION_LIMITS.moderate;
  }
  return ACTION_REDUCTION_LIMITS.normal;
}

/**
 * Maps load state → action layer strategy (surface/hide, max actions).
 */
export function deriveActionReduction(params: DeriveActionReductionParams): ActionReductionStrategy {
  const maxActions = resolveMaxActions(params);
  const suppressEducation =
    params.loadFirstMode ||
    params.acuteBurnoutTriggered ||
    params.scores.emotionalLoadScore >= LOAD_FIRST_EMOTIONAL_SCORE_THRESHOLD;

  const surfaceToday: string[] = [];
  const hideUntilReady: string[] = [LOAD_FIRST_SAFE_TO_IGNORE];

  if (params.scores.cognitiveLoadScore >= 40) {
    surfaceToday.push("One priority that matters today");
    hideUntilReady.push("Non-urgent care technique research");
  }
  if (params.scores.emotionalLoadScore >= 40) {
    surfaceToday.push("Acknowledgment of what you are carrying");
  }
  if (params.scores.sleepRiskScore >= 40) {
    surfaceToday.push("Sleep protection tonight");
    hideUntilReady.push("Late-night care tasks that can wait");
  }
  if (params.scores.uncertaintyIndex >= 0.35) {
    surfaceToday.push("Situation framing — what is known vs unknown");
    hideUntilReady.push("Complex planning until load settles");
  }
  if (params.scores.dependencyLoadScore >= 35) {
    surfaceToday.push("Supervision essentials only");
  }

  if (surfaceToday.length === 0) {
    surfaceToday.push("Current situation clarity");
  }

  return {
    maxActions,
    loadFirstMode: params.loadFirstMode,
    suppressEducation,
    prioritizeSleepProtection: params.sleepProtectionEngaged === true || params.scores.sleepRiskScore >= 55,
    surfaceToday,
    hideUntilReady,
    acknowledgment: params.loadFirstMode ? LOAD_FIRST_MINIMAL_ACTION : undefined,
  };
}

export function evaluateLoadFirstMode(
  scores: LoadScores,
  burnoutProbability: number,
  matchedFamilyCount: number,
): boolean {
  if (matchedFamilyCount >= LOAD_FIRST_MIN_SIGNAL_CATEGORIES) return true;
  if (scores.emotionalLoadScore >= LOAD_FIRST_EMOTIONAL_SCORE_THRESHOLD) return true;
  if (burnoutProbability >= 0.48) return true;
  if (
    scores.emotionalLoadScore >= 35 &&
    (scores.sleepRiskScore >= 35 || scores.uncertaintyIndex >= 0.35)
  ) {
    return true;
  }
  return false;
}

export function actionReductionFromState(
  state: CaregiverState,
  overrides?: Partial<DeriveActionReductionParams>,
): ActionReductionStrategy {
  return deriveActionReduction({
    scores: state.scores,
    loadFirstMode: state.loadFirstMode,
    burnoutProbability: state.burnout.probability,
    acuteBurnoutTriggered: state.burnout.acuteTriggered,
    ...overrides,
  });
}
