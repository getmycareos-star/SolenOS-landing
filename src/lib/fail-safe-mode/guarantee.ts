import type {
  ClarificationModeOutput,
  DecisionConfidence,
  FailSafeGuaranteeResult,
  FailSafeModeResult,
  FailSafeTriggerHit,
} from "./types";

/**
 * Fail-Safe invariants:
 * - Engaged ⇒ confidence not HIGH
 * - Engaged ⇒ clarification mode with suppressed recommendation
 * - Engaged ⇒ effective action is clarify_before_action
 * - Never invents confidence HIGH while any trigger is active
 */
export function runFailSafeGuarantee(params: {
  engaged: boolean;
  triggers: readonly FailSafeTriggerHit[];
  decisionConfidence: DecisionConfidence;
  clarification: ClarificationModeOutput | null;
  effectiveActionId: string;
}): FailSafeGuaranteeResult {
  const violations: string[] = [];

  if (params.triggers.length > 0 && !params.engaged) {
    violations.push("triggers present but fail-safe not engaged");
  }
  if (params.engaged && params.triggers.length === 0) {
    violations.push("fail-safe engaged without triggers");
  }
  if (params.engaged && params.decisionConfidence.level === "HIGH") {
    violations.push("DecisionConfidence must not be HIGH when fail-safe is engaged");
  }
  if (params.engaged && !params.clarification) {
    violations.push("engaged fail-safe must emit clarification mode output");
  }
  if (
    params.engaged &&
    params.clarification &&
    params.clarification.suppressedRecommendation !== true
  ) {
    violations.push("clarification mode must suppress recommendations");
  }
  if (
    params.engaged &&
    params.clarification &&
    params.clarification.mustClarifyBeforeAction.length === 0
  ) {
    violations.push("clarification mode must list at least one must-clarify item");
  }
  if (params.engaged && params.effectiveActionId !== "clarify_before_action") {
    violations.push("engaged fail-safe must force clarify_before_action");
  }
  if (!params.decisionConfidence.reason?.trim()) {
    violations.push("DecisionConfidence.reason must be non-empty");
  }

  return { ok: violations.length === 0, violations };
}

export function validateFailSafeModeResult(
  result: FailSafeModeResult,
): FailSafeGuaranteeResult {
  return runFailSafeGuarantee({
    engaged: result.engaged,
    triggers: result.triggers,
    decisionConfidence: result.decisionConfidence,
    clarification: result.clarification,
    effectiveActionId: result.effectiveActionId,
  });
}
