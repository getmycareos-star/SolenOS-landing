export type CalibratedUncertaintyViolationCode =
  | "guarantee_language"
  | "outcome_reassurance"
  | "resolved_uncertainty_implied"
  | "low_risk_read_as_safe"
  | "escalation_pathway_missing"
  | "interpretive_paralysis"
  | "missing_prioritization"
  | "panic_amplification";

export const CALIBRATED_UNCERTAINTY_VIOLATION_CODES: readonly CalibratedUncertaintyViolationCode[] =
  [
    "guarantee_language",
    "outcome_reassurance",
    "resolved_uncertainty_implied",
    "low_risk_read_as_safe",
    "escalation_pathway_missing",
    "interpretive_paralysis",
    "missing_prioritization",
    "panic_amplification",
  ] as const;

/** Section 5 — hard-fail guarantee / false safety language. */
export const GUARANTEE_LANGUAGE_PATTERNS = [
  /\bnothing to worry about\b/i,
  /\bno need to worry\b/i,
  /\beverything is fine\b/i,
  /\beverything should be fine\b/i,
  /\beverything will be okay\b/i,
  /\bthis is harmless\b/i,
  /\ball clear\b/i,
  /\bguaranteed safe\b/i,
  /\babsence of concern\b/i,
  /\bthis is not serious\b/i,
  /\bnot an? emergency\b/i,
  /\bprofessional review is not needed\b/i,
  /\buncertainty (?:is )?resolved\b/i,
  /\bno (?:further )?concern\b/i,
] as const;

export const OUTCOME_REASSURANCE_PATTERNS = [
  /\byou(?:'ll| will) be okay\b/i,
  /\byou should be okay\b/i,
  /\byou(?:'ll| will) be fine\b/i,
  /\bthere is nothing to worry about\b/i,
  /\bdon't worry\b/i,
] as const;

export const RESOLVED_UNCERTAINTY_PATTERNS = [
  /\buncertainty (?:is )?resolved\b/i,
  /\bno longer uncertain\b/i,
  /\buncertainty has been resolved\b/i,
] as const;

export const LOW_RISK_FALSE_SAFETY_PATTERNS = [
  /\bis safe\b/i,
  /\bare safe\b/i,
  /\bis harmless\b/i,
  /\bare harmless\b/i,
  /\bnot concerning\b/i,
  /\bno concern needed\b/i,
  /\bunconcerning\b/i,
] as const;

export const PARALYSIS_PATTERNS = [
  /\bcannot (?:be )?determined from input\b/i,
  /\bunable to (?:determine|interpret|provide)\b/i,
  /\bno (?:useful )?information (?:is )?available\b/i,
] as const;

export const PANIC_AMPLIFICATION_PATTERNS = [
  /\bimmediate(?:ly)? life.?threatening\b/i,
  /\bcritical emergency\b/i,
  /\byou must act now or\b/i,
  /\bdisaster is imminent\b/i,
] as const;

export const ESCALATION_PATHWAY_MARKERS =
  /\b(professional|clinician|consult|review|monitor|seek|call|ask|escalat|qualified|healthcare)\b/i;

export const PRIORITIZATION_MARKERS =
  /\b(priority|confirm|check|monitor|clarify|matter|urgent|attention|first|now|because)\b/i;

export const MIN_USEFUL_PRIORITIZATION_LENGTH = 40;

export interface CalibratedUncertaintyResult {
  valid: boolean;
  violations: CalibratedUncertaintyViolationCode[];
}
