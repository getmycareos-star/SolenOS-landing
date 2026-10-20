import { canonicalizeRiskLevel } from "../final-output-contract";
import type { SolenOSResponse } from "../response-validator";
import { toSolenOSSafetyControl } from "./bridge-settings";
import { buildEscalationContext } from "./escalation-matrix";
import {
  applyEmergencySensitivity,
  applyEscalationMatrixAction,
  applyExternalEscalationGate,
  applyMedicalModeFilter,
  applyRiskToleranceShaping,
  applyUncertaintyControls,
} from "./filters";
import { runSafetySystemGuarantee } from "./guarantee";
import type {
  AppliedSafetyConstraint,
  SafetyEnforcementResult,
  SafetyEscalationContext,
  SafetyLayerPayload,
  SolenOSSafetyControl,
} from "./types";
import type { SafetyControl } from "../settings-governance/types";
import type { CareContextUrgencyLevel } from "../care-context/situational/types";
import type { OverloadSimplificationSignals } from "../situation-risk-register/types";
import { applyOverloadSafetySimplification } from "../situation-risk-register/bridge-safety";

export type EnforceSafetyContext = {
  /** Partial or full safety controls from settings-governance. */
  safetyControl?: Partial<SafetyControl>;
  /** Explicit control override — takes precedence over safetyControl bridge. */
  control?: SolenOSSafetyControl;
  /** Read-only situational urgency from care-context layer. */
  careContextUrgency?: CareContextUrgencyLevel;
  /** Read-only emergency situation flag from care-context. */
  emergencySituation?: boolean;
  /** Read-only memory composite influence — for conflict resolution. */
  memoryCompositeInfluence?: number;
  /** Read-only emotional distress signal from memory envelope. */
  emotionalDistressSignal?: boolean;
  /** Situation Risk Register overload signals — reduce autonomy / simplify outputs. */
  overloadSimplification?: OverloadSimplificationSignals;
};

/**
 * SAFETY ENFORCEMENT LAYER — constrains allowed outputs and escalation behavior.
 * Runs after settings governance, before trust/disclaimer output assembly.
 * Does NOT influence reasoning, intent interpretation, or extracted facts.
 */
export function enforceSafetyConstraints(
  response: SolenOSResponse,
  context: EnforceSafetyContext = {},
): SafetyEnforcementResult {
  const originalResponse = { ...response };
  const control = context.control ?? toSolenOSSafetyControl(context.safetyControl);
  const appliedConstraints: AppliedSafetyConstraint[] = [];

  const escalation = buildEscalationContext({
    responseRiskLevel: response.risk_level,
    careContextUrgency: context.careContextUrgency,
    emergencySituation: context.emergencySituation,
    memoryCompositeInfluence: context.memoryCompositeInfluence,
    emotionalDistressSignal: context.emotionalDistressSignal,
    emergencySensitivity: control.emergencySensitivity,
  });

  if (
    context.memoryCompositeInfluence !== undefined &&
    context.careContextUrgency &&
    context.memoryCompositeInfluence < 0.25 &&
    (context.careContextUrgency === "HIGH" || context.careContextUrgency === "CRITICAL")
  ) {
    appliedConstraints.push({
      kind: "conflict_resolution",
      detail: "memory low-risk vs context emergency — chose higher safety threshold",
    });
  }

  let constrained: SolenOSResponse = {
    ...response,
    risk_level: canonicalizeRiskLevel(escalation.effectiveRiskLevel),
  };

  constrained = applyMedicalModeFilter(
    constrained,
    control.medicalMode,
    escalation.emergencyOverrideActive,
    appliedConstraints,
  );

  constrained = applyEmergencySensitivity(
    constrained,
    control.emergencySensitivity,
    escalation.emergencySignals,
    appliedConstraints,
  );

  constrained = applyExternalEscalationGate(
    constrained,
    control.externalEscalationEnabled,
    appliedConstraints,
  );

  constrained = applyUncertaintyControls(constrained, control, appliedConstraints);

  constrained = applyRiskToleranceShaping(constrained, control.riskTolerance, appliedConstraints);

  constrained = applyEscalationMatrixAction(
    constrained,
    escalation.escalationAction,
    escalation.effectiveRiskLevel,
    appliedConstraints,
  );

  if (context.overloadSimplification?.overloadHigh) {
    constrained = applyOverloadSafetySimplification(
      constrained,
      context.overloadSimplification,
      appliedConstraints,
    );
  }

  const result: SafetyEnforcementResult = {
    response: constrained,
    originalResponse,
    control,
    effectiveRiskLevel: escalation.effectiveRiskLevel,
    escalationAction: escalation.escalationAction,
    emergencyOverrideActive: escalation.emergencyOverrideActive,
    appliedConstraints,
    guarantee: { ok: true, violations: [] },
  };

  result.guarantee = runSafetySystemGuarantee(result);

  return result;
}

export function toSafetyLayerPayload(result: SafetyEnforcementResult): SafetyLayerPayload {
  return {
    medicalMode: result.control.medicalMode,
    emergencySensitivity: result.control.emergencySensitivity,
    externalEscalationEnabled: result.control.externalEscalationEnabled,
    effectiveRiskLevel: result.effectiveRiskLevel,
    escalationAction: result.escalationAction,
    emergencyOverrideActive: result.emergencyOverrideActive,
    appliedConstraints: result.appliedConstraints,
  };
}

export type { SafetyEscalationContext };
