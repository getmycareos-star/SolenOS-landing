/**
 * Phase 11 — Safety Boundary.
 * Risk ≠ medical advice. Never "you need emergency care." Never diagnose.
 */

import type { SolenOSResponse } from "../response-validator";
import {
  enforceMedicalBoundary,
  type MedicalBoundaryGateResult,
} from "../medical-responsibility-boundary";

export const SAFETY_BOUNDARY_HIGH_RISK_FRAMING =
  "Important information may need attention.";

export const SAFETY_BOUNDARY_BANS = [
  "you need emergency care",
  "go to the er now",
  "call 911 immediately",
  "you have been diagnosed",
  "this confirms the diagnosis",
] as const;

export type SafetyBoundaryResult = {
  safe: boolean;
  output: SolenOSResponse | null;
  medical_gate: MedicalBoundaryGateResult | null;
  high_risk_framing: string | null;
};

export function applySafetyBoundaryToOutput(
  output: SolenOSResponse,
  riskLevel?: "low" | "medium" | "high" | null,
): SafetyBoundaryResult {
  const medical_gate = enforceMedicalBoundary(output);
  const askNext = medical_gate.output.what_to_ask_next;
  const askNextText = Array.isArray(askNext)
    ? askNext.join(" ")
    : typeof askNext === "string"
      ? askNext
      : "";
  const blob = [
    medical_gate.output.what_is_happening,
    medical_gate.output.what_matters_now,
    askNextText,
    medical_gate.output.what_can_wait,
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();

  const violated = SAFETY_BOUNDARY_BANS.some((b) => blob.includes(b));
  let safeOutput = medical_gate.output;
  if (violated) {
    safeOutput = {
      ...medical_gate.output,
      what_matters_now: SAFETY_BOUNDARY_HIGH_RISK_FRAMING,
    };
  }

  return {
    safe: !violated && medical_gate.valid,
    output: safeOutput,
    medical_gate,
    high_risk_framing:
      riskLevel === "high" ? SAFETY_BOUNDARY_HIGH_RISK_FRAMING : null,
  };
}

export function containsSafetyBoundaryViolation(text: string): boolean {
  const lower = text.toLowerCase();
  return SAFETY_BOUNDARY_BANS.some((b) => lower.includes(b));
}
