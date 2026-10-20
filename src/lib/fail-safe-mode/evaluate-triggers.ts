import type { FailSafeModeInput, FailSafeTriggerHit } from "./types";

function isHighRisk(input: FailSafeModeInput): boolean {
  const risk = (input.outputRiskLevel ?? "").toLowerCase();
  const urgency = (input.careContextUrgency ?? "").toUpperCase();
  return (
    input.priorityOverrideApplied === true ||
    input.medicalOrTimeSensitive === true ||
    risk === "high" ||
    risk === "critical" ||
    urgency === "HIGH" ||
    urgency === "CRITICAL"
  );
}

/** Confidence is “strong” only when uncapped, low conflict penalty, and not unreliable. */
function hasStrongConfidence(input: FailSafeModeInput): boolean {
  if (input.systemHealthBand === "Unreliable") return false;
  if (input.systemHealthBoostUncertainty === true) return false;
  if (input.systemHealthRequestClarification === true) return false;
  if (typeof input.confidenceCap === "number" && input.confidenceCap < 0.7) {
    return false;
  }
  if (
    typeof input.conflictConfidencePenalty === "number" &&
    input.conflictConfidencePenalty >= 0.15
  ) {
    return false;
  }
  if (
    typeof input.priorityMeanConfidence === "number" &&
    input.priorityMeanConfidence < 0.65
  ) {
    return false;
  }
  // No affirmative confidence signal → do not treat as strong under high risk.
  if (
    input.confidenceCap === undefined &&
    input.conflictConfidencePenalty === undefined &&
    input.priorityMeanConfidence === undefined &&
    input.systemHealthBand === undefined
  ) {
    return false;
  }
  return true;
}

/**
 * Evaluate Fail-Safe triggers. ANY hit → engage.
 * Deterministic — no LLM, no probabilistic gap-filling.
 */
export function evaluateFailSafeTriggers(
  input: FailSafeModeInput,
): readonly FailSafeTriggerHit[] {
  const hits: FailSafeTriggerHit[] = [];

  const highMissing =
    input.highMissingInfoBlocked === true ||
    (input.highPriorityMissingInfoCount ?? 0) > 0;
  const unknownOwner =
    input.responsibilityEscalate === true ||
    input.responsibilityHealthState === "critical" ||
    (input.criticalUnassignedCount ?? 0) > 0 ||
    ((input.unassignedCount ?? 0) > 0 &&
      input.responsibilityHealthState === "at_risk");
  const unresolvedConflictingInputs =
    (input.openConflictCount ?? 0) > 0 &&
    (input.reEvaluationRequired === true ||
      input.criticalDecisionRestricted === true ||
      Boolean(input.conflictClarificationQuestion?.trim()));

  if (highMissing || unknownOwner || unresolvedConflictingInputs) {
    const parts: string[] = [];
    if (highMissing) parts.push("missing critical medical/care data (HIGH missing information)");
    if (unknownOwner) parts.push("unknown or critical unassigned responsibility owner");
    if (unresolvedConflictingInputs) {
      parts.push("unresolved conflicting inputs still open");
    }
    hits.push({
      kind: "HIGH_UNCERTAINTY",
      reason: parts.join("; "),
    });
  }

  if (isHighRisk(input) && !hasStrongConfidence(input)) {
    hits.push({
      kind: "HIGH_RISK_LOW_CONFIDENCE",
      reason:
        "medical or time-sensitive pressure is present but decision confidence is not strong",
    });
  }

  const ownershipMismatch =
    (input.ownershipConflictCount ?? 0) > 0 ||
    input.responsibilityEscalate === true;
  const memoryOrInputConflict =
    input.criticalDecisionRestricted === true ||
    input.reEvaluationRequired === true ||
    ((input.openConflictCount ?? 0) > 0 &&
      Boolean(input.conflictClarificationQuestion?.trim()));

  if (ownershipMismatch || memoryOrInputConflict) {
    const parts: string[] = [];
    if (ownershipMismatch) {
      parts.push("Responsibility Graph mismatch or ownership escalate");
    }
    if (memoryOrInputConflict) {
      parts.push("contradictory Memory vs new input or open CRITICAL conflict unresolved");
    }
    hits.push({
      kind: "UNRESOLVED_CONFLICT",
      reason: parts.join("; "),
    });
  }

  return hits;
}
