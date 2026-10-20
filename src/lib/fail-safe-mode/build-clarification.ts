import {
  FAIL_SAFE_CLARIFY_ACTION_ID,
  FAIL_SAFE_CLARIFY_ACTION_LABEL,
} from "./contract-constants";
import type {
  ClarificationModeOutput,
  DecisionConfidence,
  FailSafeModeInput,
  FailSafeTriggerHit,
} from "./types";

/**
 * When Fail-Safe is engaged, confidence MUST NOT be HIGH.
 * Critical / medical-restricted → LOW; other engaged states → MEDIUM.
 */
export function buildDecisionConfidence(params: {
  engaged: boolean;
  triggers: readonly FailSafeTriggerHit[];
  input: FailSafeModeInput;
}): DecisionConfidence {
  if (!params.engaged) {
    const strong =
      (params.input.systemHealthBand === "Strong" ||
        params.input.systemHealthBand === "Stable") &&
      params.input.highMissingInfoBlocked !== true &&
      (params.input.openConflictCount ?? 0) === 0 &&
      params.input.criticalDecisionRestricted !== true;
    if (strong) {
      return {
        level: "HIGH",
        reason: "No fail-safe triggers; health strong/stable and no open critical gaps.",
      };
    }
    return {
      level: "MEDIUM",
      reason: "No fail-safe triggers, but residual soft uncertainty remains.",
    };
  }

  const critical =
    params.input.criticalDecisionRestricted === true ||
    params.triggers.some((t) => t.kind === "HIGH_RISK_LOW_CONFIDENCE") ||
    params.input.responsibilityHealthState === "critical" ||
    params.input.systemHealthBand === "Unreliable";

  if (critical) {
    return {
      level: "LOW",
      reason: params.triggers.map((t) => t.reason).join(" | ") || "Fail-safe engaged",
    };
  }

  return {
    level: "MEDIUM",
    reason: params.triggers.map((t) => t.reason).join(" | ") || "Fail-safe engaged",
  };
}

/**
 * Build deterministic HIGH clarification questions from known trigger signals.
 * Never invents patient/dose facts — only ownership/conflict/missing-info prompts.
 */
export function buildEscalationQuestions(
  input: FailSafeModeInput,
  triggers: readonly FailSafeTriggerHit[],
): readonly string[] {
  const questions: string[] = [];
  const push = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    if (questions.some((x) => x.toLowerCase() === trimmed.toLowerCase())) return;
    questions.push(trimmed);
  };

  for (const existing of input.missingInfoQuestions ?? []) {
    push(existing);
  }

  if (input.conflictClarificationQuestion?.trim()) {
    push(input.conflictClarificationQuestion.trim());
  }

  const needsOwner =
    input.responsibilityEscalate === true ||
    (input.criticalUnassignedCount ?? 0) > 0 ||
    (input.unassignedCount ?? 0) > 0 ||
    (input.ownershipConflictCount ?? 0) > 0 ||
    triggers.some((t) => t.kind === "UNRESOLVED_CONFLICT" && t.reason.includes("Responsibility"));

  if (needsOwner) {
    push("Who is responsible for medication pickup?");
    push("Who owns the next care action for this situation?");
  }

  if (input.criticalDecisionRestricted === true || input.reEvaluationRequired === true) {
    push("Which conflicting care details should be treated as current and true?");
  }

  if (
    input.highMissingInfoBlocked === true ||
    (input.highPriorityMissingInfoCount ?? 0) > 0
  ) {
    push("What critical medical details are still unknown before any irreversible step?");
  }

  if (questions.length === 0 && triggers.length > 0) {
    push("What must be confirmed before SolenOS can safely recommend a next action?");
  }

  return questions.slice(0, 8);
}

export function buildClarificationModeOutput(params: {
  input: FailSafeModeInput;
  escalationQuestions: readonly string[];
}): ClarificationModeOutput {
  const known: string[] = [];
  for (const fact of params.input.knownFacts ?? []) {
    if (fact.trim()) known.push(fact.trim());
  }
  if (params.input.chosenActionLabel?.trim()) {
    const candidate = `Candidate action was considered: ${params.input.chosenActionLabel.trim()}`;
    if (!known.includes(candidate)) known.push(candidate);
  }
  if (known.length === 0) {
    known.push("Situation is tracked but decision-critical facts are incomplete.");
  }

  const missing = [...params.escalationQuestions];
  if (missing.length === 0) {
    missing.push("Decision-critical details required before action");
  }

  return {
    mode: "clarification",
    known: known.slice(0, 8),
    missing: missing.slice(0, 8),
    mustClarifyBeforeAction: missing.slice(0, 5),
    suppressedRecommendation: true,
  };
}

export function failSafeClarifyAction(): {
  id: string;
  label: string;
} {
  return {
    id: FAIL_SAFE_CLARIFY_ACTION_ID,
    label: FAIL_SAFE_CLARIFY_ACTION_LABEL,
  };
}
