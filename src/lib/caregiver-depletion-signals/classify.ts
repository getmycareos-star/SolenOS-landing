import type { CaregiverDepletionState } from "./contract-constants";
import {
  CONTINUOUS_CARE_LOAD_SIGNALS,
  END_OF_LIFE_PRESENCE_SIGNALS,
  ENVIRONMENTAL_DEPENDENCY_SIGNALS,
  SINGLE_CAREGIVER_SIGNALS,
  SLEEP_DEPRIVATION_SIGNALS,
} from "./signals";
import type { CaregiverDepletionSignalsResult } from "./schema";

function countMatches(text: string, patterns: readonly RegExp[]): number {
  return patterns.filter((pattern) => pattern.test(text)).length;
}

function matchLabels(text: string, patterns: readonly RegExp[]): string[] {
  return patterns.filter((pattern) => pattern.test(text)).map((p) => p.source.slice(0, 40));
}

/**
 * Shallow surface-signal classifier for caregiver depletion — NOT a burnout engine.
 * Explicit signals only. No implied inference.
 */
export function classifyCaregiverDepletionSignals(input: string): CaregiverDepletionSignalsResult & {
  matched_signals: string[];
} {
  const text = input.trim();

  const sleepMatches = matchLabels(text, SLEEP_DEPRIVATION_SIGNALS);
  const loadMatches = matchLabels(text, CONTINUOUS_CARE_LOAD_SIGNALS);
  const singleMatches = matchLabels(text, SINGLE_CAREGIVER_SIGNALS);
  const eolMatches = matchLabels(text, END_OF_LIFE_PRESENCE_SIGNALS);
  const envMatches = matchLabels(text, ENVIRONMENTAL_DEPENDENCY_SIGNALS);

  const is_single_caregiver = singleMatches.length > 0;

  const environmental_dependency_flag =
    envMatches.length > 0 ? ("support_anchor_present" as const) : ("none" as const);

  const loadSignalCount =
    (sleepMatches.length > 0 ? 1 : 0) +
    (loadMatches.length > 0 ? 1 : 0) +
    (singleMatches.length > 0 ? 1 : 0) +
    (eolMatches.length > 0 ? 1 : 0);

  let caregiver_depletion_state: CaregiverDepletionState = "normal";

  if (
    loadSignalCount >= 2 ||
    (sleepMatches.length > 0 && (singleMatches.length > 0 || eolMatches.length > 0)) ||
    (eolMatches.length > 0 && loadMatches.length > 0)
  ) {
    caregiver_depletion_state = "critical";
  } else if (loadSignalCount >= 1) {
    caregiver_depletion_state = "elevated";
  }

  return {
    caregiver_depletion_state,
    is_single_caregiver,
    environmental_dependency_flag,
    matched_signals: [
      ...sleepMatches,
      ...loadMatches,
      ...singleMatches,
      ...eolMatches,
      ...envMatches,
    ],
  };
}
