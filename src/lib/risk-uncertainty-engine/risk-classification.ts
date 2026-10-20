import type {
  CompletenessStatus,
  ConfidenceLevel,
  PriorityAssessment,
} from "./types";

const CRITICAL_SIGNALS =
  /\b(not breathing|can't breathe|unconscious|unresponsive|choking|chest pain|stroke|seizure|911|emergency now|severe bleeding)\b/i;

const HIGH_SIGNALS =
  /\b(severe|emergency|er\b|hospital|ambulance|fall.*(head|bleed)|worsening rapidly|can't stand)\b/i;

const MODERATE_SIGNALS =
  /\b(worse|concerning|needs attention|follow up|call doctor|new symptom|missed dose)\b/i;

/**
 * Step 4 — Risk classification. Only when COMPLETE or PARTIALLY_COMPLETE.
 */
export function classifyPriority(
  completeness: CompletenessStatus,
  input: string,
): { priority: PriorityAssessment; confidence: ConfidenceLevel } {
  if (completeness === "INSUFFICIENT") {
    return {
      priority: "Unable to Determine",
      confidence: "Insufficient Information",
    };
  }

  const text = input.trim();

  if (completeness === "PARTIALLY_COMPLETE") {
    if (CRITICAL_SIGNALS.test(text)) {
      return { priority: "High Priority", confidence: "Medium" };
    }
    return {
      priority: "Unable to Determine",
      confidence: "Low",
    };
  }

  // COMPLETE
  if (CRITICAL_SIGNALS.test(text)) {
    return { priority: "High Priority", confidence: "High" };
  }
  if (HIGH_SIGNALS.test(text)) {
    return { priority: "High Priority", confidence: "Medium" };
  }
  if (MODERATE_SIGNALS.test(text)) {
    return { priority: "Moderate Priority", confidence: "Medium" };
  }

  return { priority: "Low Priority", confidence: "High" };
}
