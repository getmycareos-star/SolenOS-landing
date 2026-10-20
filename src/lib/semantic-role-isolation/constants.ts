import { HIGH_URGENCY_HEADER_PATTERN } from "../urgency-escalation/constants";

export type SemanticRoleViolationCode =
  | "happening_contains_priority"
  | "happening_contains_advice"
  | "happening_contains_question"
  | "happening_contains_urgency"
  | "happening_unsupported_inference"
  | "happening_contains_emotional_framing"
  | "happening_contains_self_blame"
  | "matters_contains_explanation"
  | "matters_contains_reasoning"
  | "matters_contains_emotional_commentary"
  | "matters_contains_planning"
  | "ask_contains_advice"
  | "ask_contains_recommendation"
  | "ask_contains_emotional_prompting"
  | "ask_missing_question"
  | "can_wait_contains_urgency"
  | "can_wait_contains_priority"
  | "can_wait_contains_planning"
  | "happening_contains_guilt_validation"
  | "happening_contains_retrospective_simulation"
  | "matters_contains_retrospective_simulation"
  | "follow_up_contains_interpretation";

export const SEMANTIC_ROLE_VIOLATION_CODES: readonly SemanticRoleViolationCode[] = [
  "happening_contains_priority",
  "happening_contains_advice",
  "happening_contains_question",
  "happening_contains_urgency",
  "happening_unsupported_inference",
  "happening_contains_emotional_framing",
  "happening_contains_self_blame",
  "matters_contains_explanation",
  "matters_contains_reasoning",
  "matters_contains_emotional_commentary",
  "matters_contains_planning",
  "ask_contains_advice",
  "ask_contains_recommendation",
  "ask_contains_emotional_prompting",
  "ask_missing_question",
  "can_wait_contains_urgency",
  "can_wait_contains_priority",
  "can_wait_contains_planning",
  "happening_contains_guilt_validation",
  "happening_contains_retrospective_simulation",
  "matters_contains_retrospective_simulation",
  "follow_up_contains_interpretation",
] as const;

/** Priority / focus language belongs in what_matters_now only. */
export const PRIORITY_LEAKAGE_IN_HAPPENING = [
  /\bfocus on\b/i,
  /\bmain immediate\b/i,
  /\bprioriti[sz]e\b/i,
  /\bmost (?:important|urgent)\b/i,
  /\bneeds immediate attention\b/i,
  /\bshould be addressed first\b/i,
  /\branked concern\b/i,
] as const;

/** Advice belongs outside what_is_happening. */
export const ADVICE_PATTERNS = [
  /\byou should\b/i,
  /\bconsider contacting\b/i,
  /\bseek (?:medical|emergency)\b/i,
  /\bcall 911\b/i,
  /\brecommend\b/i,
  /\badvise\b/i,
] as const;

/** Narrative explanation markers leaking into what_matters_now. */
export const EXPLANATION_LEAKAGE_IN_MATTERS = [
  /\bthe caregiver reports\b/i,
  /\bthese are the only facts\b/i,
  /\baccording to the input\b/i,
  /\bwas reported\b/i,
  /\bthe input states\b/i,
] as const;

/** Reasoning / because-chains in what_matters_now. */
export const REASONING_IN_MATTERS = [
  /\bbecause\b/i,
  /\bdue to\b/i,
  /\bwhich means\b/i,
  /\bthis suggests that\b/i,
  /\bas a result\b/i,
] as const;

/** Emotional commentary in what_matters_now. */
export const EMOTIONAL_COMMENTARY_IN_MATTERS = [
  /\bit's understandable\b/i,
  /\bthis must be hard\b/i,
  /\byou're doing your best\b/i,
  /\bdon't blame yourself\b/i,
  /\bfeel(?:s|ing)? overwhelming\b/i,
] as const;

/** Planning / workflow language in what_matters_now. */
export const PLANNING_IN_MATTERS = [
  /\baction plan\b/i,
  /\bcare plan\b/i,
  /\bworkflow\b/i,
  /\bchecklist\b/i,
  /\btask list\b/i,
  /\btrack progress\b/i,
] as const;

/** Unsupported inference in what_is_happening — grounded restatement only. */
export const UNSUPPORTED_INFERENCE_IN_HAPPENING = [
  /\bmay be suffering from\b/i,
  /\blikely has\b/i,
  /\bprobably (?:has|is|due to)\b/i,
  /\bindicates (?:that )?(?:he|she|they) (?:has|is)\b/i,
  /\bthis (?:is|means) (?:a )?(?:confirmed|definite)\b/i,
  /\bdiagnos(?:is|ed)\b/i,
  /\bcaused by\b/i,
  /\bbecause of (?:stress|anxiety|depression)\b/i,
] as const;

/** Emotional framing belongs outside structured fields — UI grounding only. */
export const EMOTIONAL_FRAMING_IN_HAPPENING = [
  /\bit's understandable\b/i,
  /\bi understand (?:this|how you) feel/i,
  /\bthis must be (?:hard|overwhelming|difficult)\b/i,
  /\byou're doing your best\b/i,
  /\bdon't blame yourself\b/i,
  /\bfeel(?:s|ing)? overwhelming\b/i,
] as const;

/** Self-blame and reassurance loops in what_is_happening. */
export const SELF_BLAME_IN_HAPPENING = [
  /\byou failed\b/i,
  /\byour fault\b/i,
  /\bdoing this wrong\b/i,
  /\byou should have\b/i,
  /\bnot doing enough\b/i,
  /\bdon't worry\b/i,
  /\bthis is fine\b/i,
] as const;

/** Action queue must not explain or interpret. */
export const FOLLOW_UP_FORBIDDEN_PATTERNS = [
  /\bmay be because\b/i,
  /\bthis (?:is|means)\b/i,
  /\bdepressed\b/i,
  /\bbecause\b/i,
  /\blikely\b/i,
  /\bprobably\b/i,
] as const;

/** Recommendations disguised as questions in what_to_ask_next. */
export const RECOMMENDATION_IN_ASK = [
  /\bconsider\b/i,
  /\byou should\b/i,
  /\brecommend\b/i,
  /\bcontact a (?:healthcare|medical)\b/i,
  /\bshould you call\b/i,
  /\bhave you tried\b/i,
  /\bwhy don't you\b/i,
] as const;

/** Emotional prompting disguised as questions. */
export const EMOTIONAL_PROMPTING_IN_ASK = [
  /\bhow (?:are you|do you) feel\b/i,
  /\bare you (?:worried|anxious|overwhelmed|stressed)\b/i,
  /\bwhat's making you feel\b/i,
  /\bdo you blame yourself\b/i,
] as const;

/** Urgency framing belongs in what_matters_now / risk_level — not what_can_wait. */
export const URGENCY_IN_CAN_WAIT = [
  HIGH_URGENCY_HEADER_PATTERN,
  /\bimmediate action\b/i,
  /\burgent(?:ly)?\b/i,
  /\bemergency\b/i,
  /\bdo not delay\b/i,
] as const;

export const PRIORITY_IN_CAN_WAIT = [
  /\bfocus on\b/i,
  /\bmain (?:concern|priority|signal)\b/i,
  /\bprioriti[sz]e\b/i,
] as const;

/** Planning / workflow language in what_can_wait. */
export const PLANNING_IN_CAN_WAIT = [
  /\baction plan\b/i,
  /\bworkflow\b/i,
  /\bchecklist\b/i,
  /\btask list\b/i,
  /\bdashboard\b/i,
  /\btrack progress\b/i,
] as const;

/** Retrospective simulation / guilt reconstruction in structured output. */
export const RETROSPECTIVE_SIMULATION_PATTERNS = [
  /\bretrospective(?:ly)?\b/i,
  /\bwhat would have happened\b/i,
  /\bif only\b/i,
  /\bwhat if i (?:had|should have)\b/i,
  /\bshould have (?:noticed|done|called|checked)\b/i,
  /\breconstruct(?:ing|ion)?\b/i,
  /\breplay(?:ing)? (?:the|this|what)\b/i,
] as const;

/** Guilt validation — output must not affirm caregiver blame narratives. */
export const GUILT_VALIDATION_PATTERNS = [
  /\byou (?:were|are) right to (?:feel|worry|blame)\b/i,
  /\byou should feel guilty\b/i,
  /\byou (?:clearly )?failed\b/i,
  /\bit (?:was|is) your fault\b/i,
  /\byou (?:could|should) have prevented\b/i,
  /\byou missed (?:an opportunity|something important)\b/i,
] as const;

export interface SemanticRoleIsolationResult {
  valid: boolean;
  violations: SemanticRoleViolationCode[];
}
