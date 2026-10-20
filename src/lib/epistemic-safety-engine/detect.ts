import type { SolenOSResponse } from "../response-validator";
import { collectCaregiverText, outputImpliesIncompleteContext } from "../solenos-fields";
import type { StressNormalizedOutput } from "../input-stress-normalizer";
import {
  AMBIGUITY_COLLAPSE_PATTERNS,
  AUTHORITY_FRAMING_PATTERNS,
  CERTAINTY_INFLATION_PATTERNS,
  DEFINITIVE_MEANING_PATTERNS,
  type EpistemicViolationCode,
  ESCALATION_SUPPRESSION_PATTERNS,
  HIGH_SENSITIVITY_PATTERNS,
  OUTCOME_PREDICTION_PATTERNS,
  UNCERTAINTY_PRESERVATION_MARKERS,
} from "./constants";

function matchAny(text: string, patterns: readonly RegExp[]): boolean {  return patterns.some((pattern) => pattern.test(text));
}

export function detectHighSensitivityContext(
  input?: StressNormalizedOutput | string,
): boolean {
  const text =
    typeof input === "string"
      ? input
      : input?.raw_input ?? input?.detected_tags.join(" ") ?? "";
  return matchAny(text, HIGH_SENSITIVITY_PATTERNS);
}

export function detectEpistemicViolations(
  output: SolenOSResponse,
  inputContext?: StressNormalizedOutput,
): EpistemicViolationCode[] {
  const text = collectCaregiverText(output);
  const violations = new Set<EpistemicViolationCode>();

  if (matchAny(text, CERTAINTY_INFLATION_PATTERNS)) {
    violations.add("certainty_inflation");
  }
  if (matchAny(text, DEFINITIVE_MEANING_PATTERNS)) {
    violations.add("diagnostic_certainty");
  }
  if (matchAny(text, OUTCOME_PREDICTION_PATTERNS)) {
    violations.add("outcome_prediction");
  }
  if (/\bno need to worry\b/i.test(text) || /\bthis is normal\b/i.test(text)) {
    violations.add("false_reassurance");
  }
  if (matchAny(text, AUTHORITY_FRAMING_PATTERNS)) {
    violations.add("authority_framing");
  }
  if (matchAny(text, ESCALATION_SUPPRESSION_PATTERNS)) {
    violations.add("escalation_suppression");
  }
  if (matchAny(text, AMBIGUITY_COLLAPSE_PATTERNS)) {
    violations.add("ambiguity_collapse");
  }

  const highSensitivity = detectHighSensitivityContext(inputContext);
  const hasUncertaintyMarkers = UNCERTAINTY_PRESERVATION_MARKERS.test(text);
  const incomplete = outputImpliesIncompleteContext(output);

  if (highSensitivity && incomplete && !hasUncertaintyMarkers) {
    violations.add("high_sensitivity_underframing");
  }

  if (
    output.risk_level === "high" &&
    matchAny(text, ESCALATION_SUPPRESSION_PATTERNS)
  ) {
    violations.add("escalation_suppression");
  }

  return [...violations];
}

export function isEpistemicSafetyValid(
  output: SolenOSResponse,
  inputContext?: StressNormalizedOutput,
): boolean {
  return detectEpistemicViolations(output, inputContext).length === 0;
}
