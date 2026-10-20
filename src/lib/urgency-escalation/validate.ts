import type { SolenOSResponse } from "../response-validator";

import type { StressNormalizedOutput } from "../input-stress-normalizer";

import type { InputMode } from "../input-classification";

import { collectCaregiverText } from "../solenos-fields";

import { detectUrgencyLevel } from "../urgency-detection";

import { CRITICAL_HEADER } from "../safety-override";

import {

  DIAGNOSTIC_CERTAINTY_URGENCY_PATTERNS,

  ESCALATION_ACTION_MARKERS,

  URGENCY_SUPPRESSION_PATTERNS,

  type UrgencyEscalationResult,

  type UrgencyEscalationViolationCode,

} from "./constants";



import { RISK_RANK } from "../implementation-enforcement/risk-levels";



function matchAny(text: string, patterns: readonly RegExp[]): boolean {

  return patterns.some((pattern) => pattern.test(text));

}



export function validateUrgencyEscalation(

  output: SolenOSResponse,

  input: StressNormalizedOutput,

  inputMode?: InputMode,

): UrgencyEscalationResult {

  const detection = detectUrgencyLevel(input.raw_input, inputMode);

  const high_urgency_input =

    detection.risk_level === "critical" || detection.risk_level === "high";

  const text = collectCaregiverText(output);

  const violations = new Set<UrgencyEscalationViolationCode>();



  if (matchAny(text, DIAGNOSTIC_CERTAINTY_URGENCY_PATTERNS)) {

    violations.add("diagnostic_certainty_in_urgency");

  }



  if (high_urgency_input) {

    if (RISK_RANK[output.risk_level] < RISK_RANK[detection.risk_level]) {

      violations.add("risk_level_mismatch");

      violations.add("missing_escalation");

    }



    if (

      detection.risk_level === "critical" &&

      !output.what_matters_now.includes(CRITICAL_HEADER)

    ) {

      violations.add("missing_urgency_header");

    }



    if (!ESCALATION_ACTION_MARKERS.test(output.what_matters_now)) {

      violations.add("missing_immediate_action");

    }



    if (matchAny(output.what_is_happening, URGENCY_SUPPRESSION_PATTERNS)) {

      violations.add("urgency_suppressed");

    }

  } else if (
    output.risk_level === "high" &&
    /(?:🔴\s*)?CRITICAL|HIGH URGENCY/i.test(output.what_matters_now) &&
    !/\b(emergency|urgent|911|chest pain|breathing|unconscious|seizure|bleeding|stroke)\b/i.test(
      input.raw_input,
    )
  ) {

    violations.add("hallucinated_severity");

  }



  return { valid: violations.size === 0, violations: [...violations], high_urgency_input };

}



export function isUrgencyEscalationValid(

  output: SolenOSResponse,

  input: StressNormalizedOutput,

  inputMode?: InputMode,

): boolean {

  return validateUrgencyEscalation(output, input, inputMode).valid;

}

