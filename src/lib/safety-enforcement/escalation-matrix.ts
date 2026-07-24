import { RISK_RANK, type SolenOSRiskLevel } from "../implementation-enforcement/risk-levels";
import type { CareContextUrgencyLevel } from "../care-context/situational/types";
import type {
  EscalationMatrixAction,
  SafetyEmergencySensitivity,
  SafetyEscalationContext,
} from "./types";

const URGENCY_TO_RISK: Record<CareContextUrgencyLevel, SolenOSRiskLevel> = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  CRITICAL: "critical",
};

export function detectEmergencySignals(context: SafetyEscalationContext): boolean {
  if (context.emergencySituation) return true;
  if (context.careContextUrgency === "CRITICAL") return true;
  if (RISK_RANK[context.responseRiskLevel] >= RISK_RANK.high) return true;
  if (context.emotionalDistressSignal && context.careContextUrgency === "HIGH") return true;
  return false;
}

/**
 * Conflict resolution: if memory suggests low risk but context suggests emergency,
 * choose the HIGHER safety threshold.
 */
export function resolveEffectiveRiskLevel(context: SafetyEscalationContext): SolenOSRiskLevel {
  let effective = context.responseRiskLevel;

  if (context.careContextUrgency) {
    const contextRisk = URGENCY_TO_RISK[context.careContextUrgency];
    if (RISK_RANK[contextRisk] > RISK_RANK[effective]) {
      effective = contextRisk;
    }
  }

  const memorySuggestsLow =
    context.memoryCompositeInfluence !== undefined &&
    context.memoryCompositeInfluence < 0.25 &&
    RISK_RANK[effective] <= RISK_RANK.medium;

  const contextSuggestsEmergency =
    context.emergencySituation ||
    context.careContextUrgency === "CRITICAL" ||
    context.careContextUrgency === "HIGH";

  if (memorySuggestsLow && contextSuggestsEmergency) {
    const contextRisk = context.careContextUrgency
      ? URGENCY_TO_RISK[context.careContextUrgency]
      : "high";
    if (RISK_RANK[contextRisk] > RISK_RANK[effective]) {
      effective = contextRisk;
    }
  }

  if (detectEmergencySignals(context) && RISK_RANK[effective] < RISK_RANK.high) {
    effective = "high";
  }

  return effective;
}

export function resolveEscalationAction(
  effectiveRisk: SolenOSRiskLevel,
  emergencyOverride: boolean,
): EscalationMatrixAction {
  if (emergencyOverride || effectiveRisk === "critical") {
    return "emergency_override";
  }
  if (effectiveRisk === "high") {
    return "restrict_escalate";
  }
  if (effectiveRisk === "medium") {
    return "warn";
  }
  return "allow";
}

export function applyEmergencySensitivityAdjustment(
  effectiveRisk: SolenOSRiskLevel,
  sensitivity: SafetyEmergencySensitivity,
  emergencySignals: boolean,
): SolenOSRiskLevel {
  if (sensitivity === "high" && emergencySignals && RISK_RANK[effectiveRisk] < RISK_RANK.medium) {
    return "medium";
  }
  if (sensitivity === "low" && !emergencySignals && RISK_RANK[effectiveRisk] > RISK_RANK.medium) {
    return "medium";
  }
  return effectiveRisk;
}

export function buildEscalationContext(params: {
  responseRiskLevel: SolenOSRiskLevel;
  careContextUrgency?: CareContextUrgencyLevel;
  emergencySituation?: boolean;
  memoryCompositeInfluence?: number;
  emotionalDistressSignal?: boolean;
  emergencySensitivity: SafetyEmergencySensitivity;
}): {
  effectiveRiskLevel: SolenOSRiskLevel;
  escalationAction: EscalationMatrixAction;
  emergencyOverrideActive: boolean;
  emergencySignals: boolean;
} {
  const baseContext: SafetyEscalationContext = {
    responseRiskLevel: params.responseRiskLevel,
    careContextUrgency: params.careContextUrgency,
    emergencySituation: params.emergencySituation,
    memoryCompositeInfluence: params.memoryCompositeInfluence,
    emotionalDistressSignal: params.emotionalDistressSignal,
  };

  const emergencySignals = detectEmergencySignals(baseContext);
  let effectiveRiskLevel = resolveEffectiveRiskLevel(baseContext);
  effectiveRiskLevel = applyEmergencySensitivityAdjustment(
    effectiveRiskLevel,
    params.emergencySensitivity,
    emergencySignals,
  );

  const emergencyOverrideActive =
    emergencySignals &&
    (params.emergencySensitivity === "high" || effectiveRiskLevel === "critical");

  const escalationAction = resolveEscalationAction(effectiveRiskLevel, emergencyOverrideActive);

  return { effectiveRiskLevel, escalationAction, emergencyOverrideActive, emergencySignals };
}
