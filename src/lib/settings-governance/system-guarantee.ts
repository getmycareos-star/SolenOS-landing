import { ALLOWED_GOVERNANCE_CONSTRAINTS } from "./contract-constants";
import { deriveMemoryVisibility } from "./normalize-settings";
import type {
  AppliedGovernanceConstraint,
  GovernanceApplicationResult,
  SystemBehaviorGuaranteeResult,
} from "./types";

const ALLOWED_KINDS = new Set<string>(ALLOWED_GOVERNANCE_CONSTRAINTS);

/**
 * Final validation before returning governed output.
 * Ensures settings layer was applied correctly with no unauthorized modifications.
 */
export function runSystemBehaviorGuarantee(
  result: GovernanceApplicationResult,
): SystemBehaviorGuaranteeResult {
  const violations: string[] = [];

  if (!result.settings) {
    violations.push("missing settings object");
  }

  if (!result.settings.systemMode) {
    violations.push("missing system mode");
  }

  if (result.appliedConstraints.length === 0) {
    violations.push("no governance constraints applied");
  }

  for (const constraint of result.appliedConstraints) {
    if (!ALLOWED_KINDS.has(constraint.kind)) {
      violations.push(`unauthorized constraint kind: ${constraint.kind}`);
    }
    if (!constraint.detail.trim()) {
      violations.push(`empty constraint detail for kind ${constraint.kind}`);
    }
  }

  if (!hasConstraintKind(result.appliedConstraints, "system_mode_envelope")) {
    violations.push("system mode envelope not applied");
  }

  if (!result.moduleActivation) {
    violations.push("missing module activation state");
  }

  if (!result.moduleWeights) {
    violations.push("missing module weights");
  }

  if (!result.routing) {
    violations.push("missing routing context");
  }

  const expectedMemoryVisibility = deriveMemoryVisibility(result.settings.memoryControl);
  if (result.routing.memoryInfluenceLevel !== expectedMemoryVisibility) {
    violations.push("memory influence level mismatch");
  }

  if (result.settings.privacyControl.disableInferenceEngine && result.moduleWeights.memory > 0) {
    violations.push("inference engine disabled but memory weight non-zero");
  }

  if (
    result.settings.systemMode === "CONSERVATIVE" &&
    result.routing.riskTolerance !== "low"
  ) {
    violations.push("CONSERVATIVE mode requires low risk tolerance routing");
  }

  if (result.settings.systemMode === "CRISIS" && result.routing.decisionAutonomy !== "LOW") {
    violations.push("CRISIS mode requires LOW decision autonomy");
  }

  if (!responseFieldsValid(result.response)) {
    violations.push("governed response missing required SolenOS fields");
  }

  return { ok: violations.length === 0, violations };
}

function hasConstraintKind(
  constraints: readonly AppliedGovernanceConstraint[],
  kind: AppliedGovernanceConstraint["kind"],
): boolean {
  return constraints.some((c) => c.kind === kind);
}

function responseFieldsValid(
  response: GovernanceApplicationResult["response"],
): boolean {
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
