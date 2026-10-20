export const MIN_CAREGIVER_FIELD_LENGTH = 40;

export const EXPLANATION_MARKERS =
  /\b(because|why|since|so that|this matters|uncertain|unclear|can't determine|may be|might be|needs confirmation|without knowing)\b/i;

export const UNCERTAINTY_MARKERS =
  /\b(uncertain|uncertainty|unclear|can't determine|don't know|missing|without knowing|may be normal|may indicate|needs confirmation)\b/i;

export const PRIORITIZATION_MARKERS =
  /\b(confirm|check|call|prioritize|first|immediate|verify|contact|ask|determine|focus on|need to know)\b/i;

export const THEORY_SPECULATION_PATTERNS =
  /\b(?:theory|mechanism|pathophysiology|background|historically|typically occurs|in general|research suggests)\b/i;

export const CRYPTIC_LABEL_PATTERN =
  /^[A-Za-z0-9\s-]{1,28}\.?$/;

export type QualityGateFailureCode =
  | "cryptic_output"
  | "missing_explanation"
  | "uncertainty_unexplained"
  | "question_format"
  | "missing_why_uncertainty";

export interface QualityGateResult {
  valid: boolean;
  failures: QualityGateFailureCode[];
}
