import type { SolenOSResponse } from "../response-validator";
import { HIGH_URGENCY_HEADER_PATTERN } from "../urgency-escalation/constants";
import { collectCaregiverText, hasClarifyingQuestion, outputImpliesIncompleteContext } from "../solenos-fields";
import {
  CRYPTIC_LABEL_PATTERN,
  MIN_CAREGIVER_FIELD_LENGTH,
  PRIORITIZATION_MARKERS,
  THEORY_SPECULATION_PATTERNS,
  UNCERTAINTY_MARKERS,
  type QualityGateFailureCode,
  type QualityGateResult,
} from "./constants";

function isCryptic(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length >= MIN_CAREGIVER_FIELD_LENGTH) return false;
  return CRYPTIC_LABEL_PATTERN.test(trimmed);
}

function isHighUrgencyResponse(output: SolenOSResponse): boolean {
  return (
    output.risk_level === "high" &&
    HIGH_URGENCY_HEADER_PATTERN.test(output.what_matters_now)
  );
}

function checkCrypticOutput(output: SolenOSResponse): QualityGateFailureCode[] {
  if (isCryptic(output.what_is_happening) || isCryptic(output.what_matters_now)) {
    return ["cryptic_output"];
  }
  return [];
}

function checkPrioritizationClear(output: SolenOSResponse): QualityGateFailureCode[] {
  if (isHighUrgencyResponse(output)) {
    return [];
  }

  if (!PRIORITIZATION_MARKERS.test(output.what_matters_now)) {
    return ["missing_explanation"];
  }

  return [];
}

function checkWhatMattersNowFocus(output: SolenOSResponse): QualityGateFailureCode[] {
  if (THEORY_SPECULATION_PATTERNS.test(output.what_matters_now)) {
    return ["missing_explanation"];
  }
  return [];
}

function checkUncertaintyExplained(output: SolenOSResponse): QualityGateFailureCode[] {
  if (!outputImpliesIncompleteContext(output)) return [];

  if (!UNCERTAINTY_MARKERS.test(output.what_is_happening)) {
    return ["uncertainty_unexplained"];
  }

  return [];
}

function checkQuestionFormat(output: SolenOSResponse): QualityGateFailureCode[] {
  if (!hasClarifyingQuestion(output)) {
    return ["question_format"];
  }
  return [];
}

/** Cognitive load minimization gate — clarity over completeness. */
export function validateOutputQuality(output: SolenOSResponse): QualityGateResult {
  const failures: QualityGateFailureCode[] = [
    ...checkCrypticOutput(output),
    ...checkPrioritizationClear(output),
    ...checkWhatMattersNowFocus(output),
    ...checkUncertaintyExplained(output),
    ...checkQuestionFormat(output),
  ];

  const unique = [...new Set(failures)];
  return { valid: unique.length === 0, failures: unique };
}

export function isOutputQualityValid(output: SolenOSResponse): boolean {
  return validateOutputQuality(output).valid;
}
