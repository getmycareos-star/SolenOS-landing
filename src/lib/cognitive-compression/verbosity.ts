import type { SolenOSResponse } from "../response-validator";
import type { SolenOSRiskLevel } from "../implementation-enforcement/risk-levels";
import { collectCaregiverText } from "../solenos-fields";
import { VERBOSITY_TOTAL_WORD_LIMITS } from "./contract-constants";

/** Total word count across all caregiver-facing text fields. */
export function countCaregiverTextWords(output: SolenOSResponse): number {
  return collectCaregiverText(output).trim().split(/\s+/).filter(Boolean).length;
}

/** Resolve total word limit for a risk level per Final System Spec. */
export function resolveVerbosityWordLimit(riskLevel: SolenOSRiskLevel): number {
  return VERBOSITY_TOTAL_WORD_LIMITS[riskLevel];
}

export function isWithinVerbosityLimit(output: SolenOSResponse): boolean {
  return countCaregiverTextWords(output) <= resolveVerbosityWordLimit(output.risk_level);
}
