import type { SolenOSResponse } from "../response-validator";
import { validateAIResponse } from "../response-validator";

export const VERIFY_PROMPT_REGRESSION_GOLDENS: Readonly<Record<string, SolenOSResponse>> = {
  "Mom missed her evening medication.": validateAIResponse({
    what_is_happening:
      "The caregiver reports that evening medication was missed, which creates uncertainty about whether today's dose schedule is intact.",
    what_matters_now:
      "Confirm whether the missed evening dose was taken because medication timing affects safety and next-step decisions.",
    what_to_ask_next: "Did she take the evening dose?",
    risk_level: "medium",
    what_can_wait:
      "Insurance calls and scheduling can wait until medication status is confirmed.",
  }),
};

export function checkPromptRegressionWithGoldens(
  normalizedInput: string,
  output: SolenOSResponse,
  goldens: Readonly<Record<string, SolenOSResponse>>,
): import("./types").PromptRegressionCheckResult {
  const golden = goldens[normalizedInput.trim()];
  if (!golden) {
    return { ok: true, skipped: true };
  }

  const { canonicalizeOutput } = require("./canonicalize") as typeof import("./canonicalize");
  if (canonicalizeOutput(output) !== canonicalizeOutput(golden)) {
    return { ok: false, failure_type: "PROMPT_REGRESSION_FAILURE" };
  }

  return { ok: true, skipped: false };
}
