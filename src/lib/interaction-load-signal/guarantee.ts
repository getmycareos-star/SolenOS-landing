import type { InteractionLoadGuaranteeResult, InteractionLoadSignalResult } from "./types";

export function runInteractionLoadGuarantee(
  result: InteractionLoadSignalResult,
): InteractionLoadGuaranteeResult {
  const violations: string[] = [];
  const { metrics, sleepProtectionMode, outputStrategy, detected } = result;

  if (metrics.boundaryViolationIndex < 0 || metrics.boundaryViolationIndex > 100) {
    violations.push("boundaryViolationIndex out of 0–100");
  }
  if (metrics.emotionalLoadBoost < 0 || metrics.emotionalLoadBoost > 100) {
    violations.push("emotionalLoadBoost out of 0–100");
  }
  if (metrics.cognitiveLoadBoost < 0 || metrics.cognitiveLoadBoost > 100) {
    violations.push("cognitiveLoadBoost out of 0–100");
  }

  if (
    detected &&
    outputStrategy === "interaction_survivability" &&
    !sleepProtectionMode.prioritizeCalmingOutput
  ) {
    violations.push("interaction survivability must prioritize calming output");
  }

  if (
    sleepProtectionMode.engaged &&
    sleepProtectionMode.maxActions > 2
  ) {
    violations.push("sleep protection maxActions must be ≤ 2");
  }

  return { ok: violations.length === 0, violations };
}
