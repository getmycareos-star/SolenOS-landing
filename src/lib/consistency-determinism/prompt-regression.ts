import type { SolenOSResponse } from "../response-validator";
import { canonicalizeOutput } from "./canonicalize";
import type { PromptRegressionCheckResult } from "./types";

/** Runtime goldens are intentionally empty; illustrative caregiver scenarios live only in test fixtures. */
export const PROMPT_REGRESSION_GOLDENS: Readonly<Record<string, SolenOSResponse>> = {};

export function checkPromptRegressionWithGoldens(
  normalizedInput: string,
  output: SolenOSResponse,
  goldens: Readonly<Record<string, SolenOSResponse>>,
): PromptRegressionCheckResult {
  const golden = goldens[normalizedInput.trim()];
  if (!golden) return { ok: true, skipped: true };
  if (canonicalizeOutput(output) !== canonicalizeOutput(golden)) {
    return { ok: false, failure_type: "PROMPT_REGRESSION_FAILURE" };
  }
  return { ok: true, skipped: false };
}

export function checkPromptRegression(
  normalizedInput: string,
  output: SolenOSResponse,
): PromptRegressionCheckResult {
  return checkPromptRegressionWithGoldens(normalizedInput, output, PROMPT_REGRESSION_GOLDENS);
}

export function clearPromptRegressionGoldens(): void {
  // Static runtime goldens are empty; this remains a symmetry hook for callers.
}
