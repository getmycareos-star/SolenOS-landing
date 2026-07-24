import type { SolenOSResponse } from "../response-validator";
import { checkPromptRegressionWithGoldens } from "./prompt-regression-fixtures";
import type { PromptRegressionCheckResult } from "./types";

/** Runtime goldens empty — live API skips prompt regression (verify uses fixtures). */
export const PROMPT_REGRESSION_GOLDENS: Readonly<Record<string, SolenOSResponse>> = {};

export function checkPromptRegression(
  normalizedInput: string,
  output: SolenOSResponse,
): PromptRegressionCheckResult {
  return checkPromptRegressionWithGoldens(normalizedInput, output, PROMPT_REGRESSION_GOLDENS);
}

export function clearPromptRegressionGoldens(): void {
  // Static module; symmetry hook for verify scripts.
}

export {
  VERIFY_PROMPT_REGRESSION_GOLDENS,
  checkPromptRegressionWithGoldens,
} from "./prompt-regression-fixtures";
