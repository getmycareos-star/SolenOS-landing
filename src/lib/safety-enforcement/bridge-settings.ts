import type { SafetyControl } from "../settings-governance/types";
import { DEFAULT_SAFETY_CONTROL } from "./defaults";
import type { SolenOSSafetyControl, SafetyRiskTolerance } from "./types";

function normalizeRiskTolerance(value: string | undefined): SafetyRiskTolerance {
  const upper = (value ?? "LOW").toUpperCase();
  if (upper === "MEDIUM" || upper === "HIGH") return upper;
  return "LOW";
}

/** Bridge system settings SafetyControl into the enforcement-layer control model. */
export function toSolenOSSafetyControl(
  safetyControl: Partial<SafetyControl> | undefined,
): SolenOSSafetyControl {
  if (!safetyControl) {
    return { ...DEFAULT_SAFETY_CONTROL };
  }

  return {
    medicalMode: safetyControl.medicalMode ?? DEFAULT_SAFETY_CONTROL.medicalMode,
    emergencySensitivity:
      safetyControl.emergencySensitivity ?? DEFAULT_SAFETY_CONTROL.emergencySensitivity,
    externalEscalationEnabled:
      safetyControl.externalEscalationEnabled ?? DEFAULT_SAFETY_CONTROL.externalEscalationEnabled,
    alwaysShowUncertainty:
      safetyControl.alwaysShowUncertainty ?? DEFAULT_SAFETY_CONTROL.alwaysShowUncertainty,
    noCertaintyMode: safetyControl.noCertaintyMode ?? DEFAULT_SAFETY_CONTROL.noCertaintyMode,
    riskTolerance: normalizeRiskTolerance(safetyControl.riskTolerance),
  };
}
