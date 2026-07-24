import type { InputMode } from "../input-classification";
import type { SolenOSRiskLevel } from "../implementation-enforcement/risk-levels";
import {
  CRITICAL_URGENCY_SIGNALS,
  HIGH_URGENCY_SIGNALS,
  type UrgencyDetectionResult,
} from "./constants";

function labelForPattern(pattern: RegExp): string {
  return pattern.source
    .replace(/\\b/g, "")
    .replace(/\\'?/g, "'")
    .replace(/\(\?:[^)]+\)\??/g, "")
    .slice(0, 48);
}

function matchSignals(text: string, patterns: readonly RegExp[]): string[] {
  const matched: string[] = [];
  for (const pattern of patterns) {
    if (pattern.test(text)) {
      matched.push(labelForPattern(pattern));
    }
  }
  return matched;
}

/**
 * Rule-based urgency detection — shallow keyword match, limited contextual confirmation.
 * Does NOT deep-reason. Order: CRITICAL → HIGH → contextual → default.
 */
export function detectUrgencyLevel(
  input: string,
  inputMode?: InputMode,
): UrgencyDetectionResult {
  const text = input.trim();

  const critical_signals = matchSignals(text, CRITICAL_URGENCY_SIGNALS);
  if (critical_signals.length > 0) {
    return {
      risk_level: "critical",
      critical_signals,
      high_signals: [],
      detection_method: "rule_match",
    };
  }

  const high_signals = matchSignals(text, HIGH_URGENCY_SIGNALS);
  if (high_signals.length > 0) {
    return {
      risk_level: "high",
      critical_signals: [],
      high_signals,
      detection_method: "rule_match",
    };
  }

  if (inputMode === "crisis_urgent") {
    return {
      risk_level: "high",
      critical_signals: [],
      high_signals: ["crisis_urgent_mode"],
      detection_method: "contextual_confirmation",
    };
  }

  if (inputMode === "administrative_legal") {
    return {
      risk_level: "low",
      critical_signals: [],
      high_signals: [],
      detection_method: "default",
    };
  }

  const defaultLevel: SolenOSRiskLevel = text.length > 0 ? "medium" : "low";
  return {
    risk_level: defaultLevel,
    critical_signals: [],
    high_signals: [],
    detection_method: "default",
  };
}
