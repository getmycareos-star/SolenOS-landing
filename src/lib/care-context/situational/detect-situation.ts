import type { InputMode } from "../../input-classification";
import type { UrgencyDetectionResult } from "../../urgency-detection";
import { CRITICAL_URGENCY_SIGNALS, HIGH_URGENCY_SIGNALS } from "../../urgency-detection/constants";
import type { SituationType } from "./types";

const DAILY_ROUTINE_SIGNALS = [
  /\bmedication reminder\b/i,
  /\b(daily|morning|evening) (routine|schedule)\b/i,
  /\bmissed (her|his|their|the) (dose|medication|pill)\b/i,
  /\bremind(er)?\b/i,
  /\bnormal (day|routine)\b/i,
] as const;

const MEDICAL_EVENT_SIGNALS = [
  /\b(symptom|symptoms)\b/i,
  /\bhospital\b/i,
  /\bdischarge(d)?\b/i,
  /\bclinic\b/i,
  /\bdoctor (visit|appointment)\b/i,
  /\bmedication (issue|problem|reaction|side effect)\b/i,
  /\bworsening\b/i,
  /\bpain\b/i,
  /\bfever\b/i,
] as const;

const ADMINISTRATIVE_SIGNALS = [
  /\binsurance\b/i,
  /\bbenefits?\b/i,
  /\bform(s)?\b/i,
  /\bpaperwork\b/i,
  /\bdeadline\b/i,
  /\bmedicaid\b/i,
  /\bmedicare\b/i,
  /\bclaim(s)?\b/i,
  /\bauthorization\b/i,
] as const;

const FOLLOW_UP_SIGNALS = [
  /\bfollow[- ]?up\b/i,
  /\bcheck[- ]?in\b/i,
  /\bsince (last|our|the) (time|visit|call)\b/i,
  /\bupdate (on|about)\b/i,
  /\bstill waiting\b/i,
  /\bany (news|progress)\b/i,
] as const;

const UNCERTAIN_SIGNALS = [
  /\bnot sure\b/i,
  /\bdon'?t know\b/i,
  /\bunclear\b/i,
  /\bconfus(ed|ing)\b/i,
  /\bmissing information\b/i,
  /\bcan'?t tell\b/i,
] as const;

function countMatches(text: string, patterns: readonly RegExp[]): number {
  return patterns.filter((pattern) => pattern.test(text)).length;
}

/**
 * Classify situational type from surface signals — shallow, recomputed per interaction.
 */
export function detectSituationType(params: {
  input: string;
  inputMode: InputMode;
  urgencyDetection: UrgencyDetectionResult;
  intentConfidence: number;
}): SituationType {
  const text = params.input.trim();

  if (
    params.inputMode === "crisis_urgent" ||
    params.urgencyDetection.risk_level === "critical" ||
    countMatches(text, CRITICAL_URGENCY_SIGNALS) > 0
  ) {
    return "emergency";
  }

  if (params.intentConfidence < 0.6 && countMatches(text, UNCERTAIN_SIGNALS) > 0) {
    return "uncertain_state";
  }

  if (params.inputMode === "administrative_legal" || countMatches(text, ADMINISTRATIVE_SIGNALS) >= 2) {
    return "administrative";
  }

  if (countMatches(text, FOLLOW_UP_SIGNALS) > 0) {
    return "follow_up";
  }

  if (
    countMatches(text, MEDICAL_EVENT_SIGNALS) > 0 ||
    params.urgencyDetection.risk_level === "high" ||
    countMatches(text, HIGH_URGENCY_SIGNALS) > 0
  ) {
    return "medical_event";
  }

  if (countMatches(text, DAILY_ROUTINE_SIGNALS) > 0) {
    return "daily_routine";
  }

  if (countMatches(text, UNCERTAIN_SIGNALS) > 0 || text.length < 12) {
    return "uncertain_state";
  }

  return "daily_routine";
}
