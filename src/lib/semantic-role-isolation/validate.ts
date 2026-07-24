import type { SolenOSResponse } from "../response-validator";



import { hasClarifyingQuestion } from "../solenos-fields";



import {
  ADVICE_PATTERNS,
  EMOTIONAL_COMMENTARY_IN_MATTERS,
  EMOTIONAL_FRAMING_IN_HAPPENING,
  EMOTIONAL_PROMPTING_IN_ASK,
  EXPLANATION_LEAKAGE_IN_MATTERS,
  GUILT_VALIDATION_PATTERNS,
  PLANNING_IN_CAN_WAIT,
  PLANNING_IN_MATTERS,
  PRIORITY_IN_CAN_WAIT,
  PRIORITY_LEAKAGE_IN_HAPPENING,
  REASONING_IN_MATTERS,
  RECOMMENDATION_IN_ASK,
  RETROSPECTIVE_SIMULATION_PATTERNS,
  SELF_BLAME_IN_HAPPENING,
  UNSUPPORTED_INFERENCE_IN_HAPPENING,
  URGENCY_IN_CAN_WAIT,
  type SemanticRoleIsolationResult,
  type SemanticRoleViolationCode,
} from "./constants";



function matchAny(text: string, patterns: readonly RegExp[]): boolean {

  return patterns.some((pattern) => pattern.test(text));

}



function checkWhatIsHappening(text: string): SemanticRoleViolationCode[] {

  const violations: SemanticRoleViolationCode[] = [];



  if (matchAny(text, PRIORITY_LEAKAGE_IN_HAPPENING)) {

    violations.push("happening_contains_priority");

  }

  if (matchAny(text, ADVICE_PATTERNS)) {

    violations.push("happening_contains_advice");

  }

  if (/\?/.test(text)) {

    violations.push("happening_contains_question");

  }

  if (/(?:🔴\s*)?CRITICAL|HIGH URGENCY/i.test(text)) {

    violations.push("happening_contains_urgency");

  }

  if (matchAny(text, UNSUPPORTED_INFERENCE_IN_HAPPENING)) {
    violations.push("happening_unsupported_inference");
  }
  if (matchAny(text, EMOTIONAL_FRAMING_IN_HAPPENING)) {
    violations.push("happening_contains_emotional_framing");
  }
  if (matchAny(text, SELF_BLAME_IN_HAPPENING)) {
    violations.push("happening_contains_self_blame");
  }
  if (matchAny(text, GUILT_VALIDATION_PATTERNS)) {
    violations.push("happening_contains_guilt_validation");
  }
  if (matchAny(text, RETROSPECTIVE_SIMULATION_PATTERNS)) {
    violations.push("happening_contains_retrospective_simulation");
  }

  return violations;

}



function checkWhatMattersNow(text: string): SemanticRoleViolationCode[] {

  const violations: SemanticRoleViolationCode[] = [];



  if (matchAny(text, EXPLANATION_LEAKAGE_IN_MATTERS)) {

    violations.push("matters_contains_explanation");

  }

  if (matchAny(text, REASONING_IN_MATTERS)) {
    violations.push("matters_contains_reasoning");
  }
  if (matchAny(text, EMOTIONAL_COMMENTARY_IN_MATTERS)) {
    violations.push("matters_contains_emotional_commentary");
  }
  if (matchAny(text, PLANNING_IN_MATTERS)) {
    violations.push("matters_contains_planning");
  }
  if (matchAny(text, RETROSPECTIVE_SIMULATION_PATTERNS)) {
    violations.push("matters_contains_retrospective_simulation");
  }

  return violations;

}



function checkWhatToAskNext(text: string): SemanticRoleViolationCode[] {

  const violations: SemanticRoleViolationCode[] = [];



  if (matchAny(text, ADVICE_PATTERNS)) {

    violations.push("ask_contains_advice");

  }

  if (matchAny(text, RECOMMENDATION_IN_ASK)) {
    violations.push("ask_contains_recommendation");
  }
  if (matchAny(text, EMOTIONAL_PROMPTING_IN_ASK)) {
    violations.push("ask_contains_emotional_prompting");
  }

  return violations;

}



function checkWhatCanWait(text: string): SemanticRoleViolationCode[] {

  const violations: SemanticRoleViolationCode[] = [];



  if (matchAny(text, URGENCY_IN_CAN_WAIT)) {

    violations.push("can_wait_contains_urgency");

  }

  if (matchAny(text, PRIORITY_IN_CAN_WAIT)) {
    violations.push("can_wait_contains_priority");
  }
  if (matchAny(text, PLANNING_IN_CAN_WAIT)) {
    violations.push("can_wait_contains_planning");
  }

  return violations;

}



/** Enforces semantic role isolation — grounded restatement only in what_is_happening. */

export function validateSemanticRoleIsolation(output: SolenOSResponse): SemanticRoleIsolationResult {

  const violations = new Set<SemanticRoleViolationCode>([

    ...checkWhatIsHappening(output.what_is_happening),

    ...checkWhatMattersNow(output.what_matters_now),

    ...checkWhatToAskNext(output.what_to_ask_next),

    ...checkWhatCanWait(output.what_can_wait),

  ]);



  if (!hasClarifyingQuestion(output)) {

    violations.add("ask_missing_question");

  }



  return { valid: violations.size === 0, violations: [...violations] };

}



export function isSemanticRoleIsolationValid(output: SolenOSResponse): boolean {

  return validateSemanticRoleIsolation(output).valid;

}

