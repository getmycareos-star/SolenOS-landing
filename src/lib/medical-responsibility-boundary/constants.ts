/**
 * Medical responsibility boundary — aligned with caregiver-first positioning.
 * SolenOS provides clarity and compression for caregivers; it must NEVER become
 * medical authority, diagnostic system, treatment planner, or clinical judgment replacement.
 * See caregiver-first-positioning module: CAREGIVER_FIRST_NEVER_BECOME.
 */
export const MEDICAL_BOUNDARY_CAREGIVER_FIRST_ALIGNMENT =
  "Medical boundary enforces caregiver-first positioning: clarity over authority, never diagnosis, treatment, or clinical judgment replacement.";

export type MedicalBoundaryViolationCode =
  | "diagnosis_language"
  | "treatment_recommendation"
  | "medication_instruction"
  | "clinical_authority_override"
  | "diagnostic_certainty";

export const MEDICAL_BOUNDARY_VIOLATIONS: readonly MedicalBoundaryViolationCode[] = [
  "diagnosis_language",
  "treatment_recommendation",
  "medication_instruction",
  "clinical_authority_override",
  "diagnostic_certainty",
] as const;

/** Declarative diagnosis framing — interpretive only, never clinical conclusions. */
export const DIAGNOSIS_PATTERNS = [
  /\bthis is (?!happening|unclear|about|what|when|where|why|how|related)[a-z][\w-]*(?:\s+[a-z][\w-]*){0,4}\b/i,
  /\bthis indicates (?:a |an )?[a-z]/i,
  /\bthis confirms (?:a |an )?[a-z]/i,
  /\byou have (?:a |an )?[a-z][\w-]*(?:\s+[a-z][\w-]*){0,3}\b/i,
  /\b(?:he|she|they) have (?:a |an )?(?:pneumonia|cancer|diabetes|heart failure|stroke|sepsis|infection)\b/i,
  /\bdiagnosed with\b/i,
  /\b(?:signs|symptoms) of (?:a |an )?[a-z]/i,
  /\b(?:likely|probably) has (?:a |an )?[a-z]/i,
  /\b(?:pneumonia|heart failure|cancer progression|sepsis|kidney failure)\b/i,
] as const;

export const TREATMENT_PATTERNS = [
  /\b(increase|decrease|reduce|raise|lower|stop|start|discontinue|begin|change|adjust)\s+(?:the\s+)?(?:dose|dosage|medication|medicine|drug|prescription|treatment)\b/i,
  /\bshould (?:take|start|stop|increase|decrease|change)\b/i,
  /\brecommend(?:ed|ing)? (?:to )?(?:take|start|stop|increase|decrease)\b/i,
  /\bneeds to (?:take|start|stop|increase|decrease)\b/i,
] as const;

export const MEDICATION_INSTRUCTION_PATTERNS = [
  /\b(?:take|give|administer)\s+\d+\s*(?:mg|ml|mcg|units?)\b/i,
  /\b(?:take|give)\s+(?:every|twice|once|three times|four times)\b/i,
  /\bswitch to (?:a |an |the )?[a-z]/i,
  /\bsubstitute (?:the |a |an )?(?:medication|medicine|drug)\b/i,
  /\bdouble (?:the )?(?:dose|medication)\b/i,
  /\bhalf (?:the )?(?:dose|medication)\b/i,
] as const;

export const CLINICAL_AUTHORITY_PATTERNS = [
  /\b(?:ignore|disregard|override|contradict)\s+(?:the\s+)?(?:doctor|physician|clinician|hospital|hospice|nurse)\b/i,
  /\bdo not (?:follow|listen to)\s+(?:the\s+)?(?:doctor|physician|clinician|hospital)\b/i,
  /\binstead of (?:what )?(?:the )?(?:doctor|physician|clinician|hospital)\b/i,
  /\boverrule (?:the )?(?:doctor|physician|clinician)\b/i,
] as const;

export const DIAGNOSTIC_CERTAINTY_PATTERNS = [
  /\b(?:definitely|certainly|clearly|obviously)\s+(?:has|is|shows|indicates|means)\b/i,
  /\bthis is (?:worsening|progressing|advanced|terminal)\b/i,
  /\bno doubt (?:this|it|that)\b/i,
] as const;

export const SAFE_CONSULTATION_PHRASE =
  "Consult a healthcare professional before making any clinical decisions.";

export const SAFE_UNCERTAINTY_PHRASE =
  "This pattern may need clinical confirmation from a qualified professional.";

export interface MedicalBoundaryResult {
  valid: boolean;
  violations: MedicalBoundaryViolationCode[];
  rewritten: boolean;
}
