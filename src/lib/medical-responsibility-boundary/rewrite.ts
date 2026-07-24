import type { SolenOSResponse } from "../response-validator";
import {
  CLINICAL_AUTHORITY_PATTERNS,
  DIAGNOSIS_PATTERNS,
  DIAGNOSTIC_CERTAINTY_PATTERNS,
  MEDICATION_INSTRUCTION_PATTERNS,
  SAFE_CONSULTATION_PHRASE,
  SAFE_UNCERTAINTY_PHRASE,
  TREATMENT_PATTERNS,
} from "./constants";

function rewriteText(text: string): string {
  let next = text;

  for (const pattern of DIAGNOSIS_PATTERNS) {
    next = next.replace(pattern, SAFE_UNCERTAINTY_PHRASE);
  }

  for (const pattern of DIAGNOSTIC_CERTAINTY_PATTERNS) {
    next = next.replace(pattern, SAFE_UNCERTAINTY_PHRASE);
  }

  for (const pattern of TREATMENT_PATTERNS) {
    next = next.replace(pattern, SAFE_CONSULTATION_PHRASE);
  }

  for (const pattern of MEDICATION_INSTRUCTION_PATTERNS) {
    next = next.replace(pattern, SAFE_CONSULTATION_PHRASE);
  }

  for (const pattern of CLINICAL_AUTHORITY_PATTERNS) {
    next = next.replace(
      pattern,
      "Follow existing clinical guidance and ask the care team about any conflicts.",
    );
  }

  return next.replace(/\s{2,}/g, " ").trim();
}

export function rewriteMedicalBoundaryOutput(output: SolenOSResponse): SolenOSResponse {
  return {
    ...output,
    what_is_happening: rewriteText(output.what_is_happening),
    what_matters_now: rewriteText(output.what_matters_now),
    what_to_ask_next: rewriteText(output.what_to_ask_next),
    what_can_wait: rewriteText(output.what_can_wait),
  };
}
