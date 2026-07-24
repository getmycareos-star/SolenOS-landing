import type { SolenOSResponse } from "../response-validator";
import {
  AMBIGUITY_COLLAPSE_PATTERNS,
  AUTHORITY_FRAMING_PATTERNS,
  CERTAINTY_INFLATION_PATTERNS,
  DEFINITIVE_MEANING_PATTERNS,
  EPISTEMIC_ESCALATION_REMINDER,
  EPISTEMIC_SAFE_UNCERTAINTY,
  ESCALATION_SUPPRESSION_PATTERNS,
  OUTCOME_PREDICTION_PATTERNS,
} from "./constants";

function rewriteText(text: string): string {
  let next = text;

  for (const pattern of [
    ...CERTAINTY_INFLATION_PATTERNS,
    ...DEFINITIVE_MEANING_PATTERNS,
    ...AMBIGUITY_COLLAPSE_PATTERNS,
    ...AUTHORITY_FRAMING_PATTERNS,
  ]) {
    next = next.replace(pattern, EPISTEMIC_SAFE_UNCERTAINTY);
  }

  for (const pattern of OUTCOME_PREDICTION_PATTERNS) {
    next = next.replace(
      pattern,
      "Outcome timing cannot be determined from this information alone and requires clinical interpretation.",
    );
  }

  for (const pattern of ESCALATION_SUPPRESSION_PATTERNS) {
    next = next.replace(pattern, EPISTEMIC_ESCALATION_REMINDER);
  }

  next = next.replace(/\bno need to worry\b/gi, EPISTEMIC_SAFE_UNCERTAINTY);
  next = next.replace(/\bthis is normal\b/gi, EPISTEMIC_SAFE_UNCERTAINTY);
  next = next.replace(/\bnothing to worry about\b/gi, EPISTEMIC_SAFE_UNCERTAINTY);

  return next.replace(/\s{2,}/g, " ").trim();
}

export function rewriteEpistemicOutput(output: SolenOSResponse): SolenOSResponse {
  return {
    ...output,
    what_is_happening: rewriteText(output.what_is_happening),
    what_matters_now: rewriteText(output.what_matters_now),
    what_to_ask_next: rewriteText(output.what_to_ask_next),
    what_can_wait: rewriteText(output.what_can_wait),
  };
}
