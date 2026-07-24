import { BURNOUT_TIER_THRESHOLDS } from "./contract-constants";
import type { BurnoutTier } from "./types";

/**
 * Burnout probability (0–1) + acute flag → Low | Moderate | High | Critical.
 */
export function classifyBurnoutTier(
  burnoutProbability: number,
  acuteTriggered = false,
): BurnoutTier {
  if (acuteTriggered || burnoutProbability >= BURNOUT_TIER_THRESHOLDS.high) {
    return "Critical";
  }
  if (burnoutProbability >= BURNOUT_TIER_THRESHOLDS.moderate) {
    return "High";
  }
  if (burnoutProbability >= BURNOUT_TIER_THRESHOLDS.low) {
    return "Moderate";
  }
  return "Low";
}
