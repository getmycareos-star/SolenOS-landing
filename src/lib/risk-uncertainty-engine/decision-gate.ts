import type { CompletenessStatus, DecisionGateResult } from "./types";

/**
 * Step 3 — Decision gate. INSUFFICIENT blocks all priority/urgency assignment.
 */
export function runDecisionGate(completeness: CompletenessStatus): DecisionGateResult {
  if (completeness === "INSUFFICIENT") {
    return {
      blocked: true,
      reason:
        "Required safety context is missing — priority and urgency cannot be assigned.",
    };
  }
  return { blocked: false, reason: null };
}
