export type EpistemicViolationCode =
  | "certainty_inflation"
  | "diagnostic_certainty"
  | "outcome_prediction"
  | "false_reassurance"
  | "authority_framing"
  | "escalation_suppression"
  | "ambiguity_collapse"
  | "high_sensitivity_underframing";

export const EPISTEMIC_VIOLATION_CODES: readonly EpistemicViolationCode[] = [
  "certainty_inflation",
  "diagnostic_certainty",
  "outcome_prediction",
  "false_reassurance",
  "authority_framing",
  "escalation_suppression",
  "ambiguity_collapse",
  "high_sensitivity_underframing",
] as const;

/** Language that collapses uncertainty into false certainty. */
export const CERTAINTY_INFLATION_PATTERNS = [
  /\bthis is definitely\b/i,
  /\bthis confirms\b/i,
  /\bthis clearly means\b/i,
  /\bthis proves\b/i,
  /\bwithout (?:a )?doubt\b/i,
  /\bthere is no question\b/i,
  /\bthis is certainly\b/i,
] as const;

export const DEFINITIVE_MEANING_PATTERNS = [
  /\bthis means [a-z][\w\s]{2,40} is happening\b/i,
  /\bthis is (?:a |an )?condition\b/i,
  /\bthis is normal\b/i,
  /\bno need to worry\b/i,
  /\bnothing to worry about\b/i,
  /\bthis is not serious\b/i,
] as const;

export const OUTCOME_PREDICTION_PATTERNS = [
  /\bwill (?:recover|worsen|improve|deteriorate|die|pass away)\b/i,
  /\bwithin \d+ (?:days|hours|weeks)\b/i,
  /\bexpect(?:ed)? to (?:recover|worsen|improve|die)\b/i,
  /\bprognosis is\b/i,
  /\blikely timeline\b/i,
] as const;

export const AUTHORITY_FRAMING_PATTERNS = [
  /\bthe (?:ai|system) knows\b/i,
  /\bi know what is happening\b/i,
  /\bthis is the truth\b/i,
  /\bdefinitive answer\b/i,
  /\bconfirmed diagnosis\b/i,
] as const;

export const ESCALATION_SUPPRESSION_PATTERNS = [
  /\bno need to (?:call|contact|escalate|seek)\b/i,
  /\bdon't (?:call|contact) (?:the )?(?:doctor|911|emergency)\b/i,
  /\bnot an emergency\b/i,
  /\bwait and see without\b/i,
  /\bprofessional review is not needed\b/i,
] as const;

export const AMBIGUITY_COLLAPSE_PATTERNS = [
  /\bthe only explanation is\b/i,
  /\bthis must be\b/i,
  /\bthere is only one possibility\b/i,
  /\bno other explanation\b/i,
] as const;

export const UNCERTAINTY_PRESERVATION_MARKERS =
  /\b(may|might|could|uncertain|uncertainty|not certain|requires professional review|clinical confirmation|sometimes seen|may be associated|interpretation remains|unclear without)\b/i;

export const HIGH_SENSITIVITY_PATTERNS = [
  /\bhospice\b/i,
  /\bend[- ]of[- ]life\b/i,
  /\brespiratory\b/i,
  /\boxygen\b/i,
  /\bspo2\b/i,
  /\bmedication change\b/i,
  /\bchanged (?:her|his|their) meds\b/i,
  /\bsymptom(?:s)? (?:worsen|escalat)\b/i,
  /\bsudden(?:ly)? (?:change|confusion|agitation)\b/i,
  /\binsurance (?:denied|denial)\b/i,
  /\bcare denial\b/i,
  /\bprognosis\b/i,
  /\bemergency\b/i,
  /\b911\b/i,
] as const;

export const EPISTEMIC_SAFE_UNCERTAINTY =
  "This pattern may be associated with several possibilities and requires professional review to interpret in context.";

export const EPISTEMIC_ESCALATION_REMINDER =
  "When uncertainty remains, consulting a qualified healthcare professional is a valid and appropriate next step.";

export interface EpistemicSafetyResult {
  valid: boolean;
  violations: EpistemicViolationCode[];
  rewritten: boolean;
  high_sensitivity: boolean;
}
