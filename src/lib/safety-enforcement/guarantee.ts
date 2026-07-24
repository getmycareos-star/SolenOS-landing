import { ALLOWED_SAFETY_CONSTRAINTS } from "./contract-constants";
import type { AppliedSafetyConstraint, SafetyEnforcementResult } from "./types";

const ALLOWED_KINDS = new Set<string>(ALLOWED_SAFETY_CONSTRAINTS);

/**
 * System guarantee before final output assembly — validates safety layer was applied correctly.
 */
export function runSafetySystemGuarantee(
  result: SafetyEnforcementResult,
): { ok: boolean; violations: string[] } {
  const violations: string[] = [];

  if (!result.control) {
    violations.push("missing safety control");
  }

  if (result.appliedConstraints.length === 0) {
    violations.push("no safety constraints applied");
  }

  for (const constraint of result.appliedConstraints) {
    if (!ALLOWED_KINDS.has(constraint.kind)) {
      violations.push(`unauthorized safety constraint kind: ${constraint.kind}`);
    }
    if (!constraint.detail.trim()) {
      violations.push(`empty constraint detail for kind ${constraint.kind}`);
    }
  }

  if (!hasConstraintKind(result.appliedConstraints, "escalation_matrix")) {
    violations.push("escalation matrix not applied");
  }

  if (!hasConstraintKind(result.appliedConstraints, "external_escalation_gate")) {
    violations.push("external escalation gate not applied");
  }

  if (result.control.alwaysShowUncertainty && !hasConstraintKind(result.appliedConstraints, "uncertainty_injection")) {
    violations.push("alwaysShowUncertainty enabled but uncertainty not injected");
  }

  if (result.control.noCertaintyMode && !hasConstraintKind(result.appliedConstraints, "certainty_softening")) {
    violations.push("noCertaintyMode enabled but certainty softening not applied");
  }

  if (
    !result.control.externalEscalationEnabled &&
    containsExternalEscalation(result.response)
  ) {
    violations.push("external escalation disabled but escalation routes remain in output");
  }

  if (
    result.emergencyOverrideActive &&
    !hasConstraintKind(result.appliedConstraints, "emergency_override")
  ) {
    violations.push("emergency override active but constraint not recorded");
  }

  if (!responseFieldsValid(result.response)) {
    violations.push("safety-enforced response missing required SolenOS fields");
  }

  return { ok: violations.length === 0, violations };
}

function hasConstraintKind(
  constraints: readonly AppliedSafetyConstraint[],
  kind: AppliedSafetyConstraint["kind"],
): boolean {
  return constraints.some((c) => c.kind === kind);
}

function containsExternalEscalation(
  response: SafetyEnforcementResult["response"],
): boolean {
  const combined = [
    response.what_is_happening,
    response.what_matters_now,
    response.what_to_ask_next,
    response.what_can_wait,
  ].join(" ");

  return (
    /\b(?:call|dial)\s+(?:911|999|112)\b/i.test(combined) ||
    /\b(?:go to|seek)\s+(?:the\s+)?(?:ER|emergency room)\b/i.test(combined) ||
    /\bseek immediate (?:medical|emergency)\b/i.test(combined)
  );
}

function responseFieldsValid(response: SafetyEnforcementResult["response"]): boolean {
  return (
    typeof response.what_is_happening === "string" &&
    response.what_is_happening.length > 0 &&
    typeof response.what_matters_now === "string" &&
    response.what_matters_now.length > 0 &&
    typeof response.what_to_ask_next === "string" &&
    response.what_to_ask_next.length > 0 &&
    typeof response.what_can_wait === "string" &&
    response.what_can_wait.length > 0 &&
    typeof response.risk_level === "string"
  );
}
