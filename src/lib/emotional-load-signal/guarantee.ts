import type { EmotionalLoadSignalLayerResult, PostDecisionEmotionalLoadResult } from "./types";

export function runEmotionalLoadGuarantee(
  result: Pick<EmotionalLoadSignalLayerResult, "signal" | "priorityAdjustment">,
): { ok: boolean; violations: string[] } {
  const violations: string[] = [];
  const { signal, priorityAdjustment } = result;

  if (signal.burnoutProbability.value < 0 || signal.burnoutProbability.value > 1) {
    violations.push("burnout probability must be 0–1");
  }
  if (!signal.burnoutProbability.reasoning?.trim()) {
    violations.push("burnout reasoning required");
  }
  if (!signal.cognitiveFatigue.explanation?.trim()) {
    violations.push("cognitive fatigue explanation required");
  }
  if (signal.compositeScore < 0 || signal.compositeScore > 100) {
    violations.push("composite score must be 0–100");
  }
  if (priorityAdjustment.adjustedTopN < 1) {
    violations.push("adjustedTopN must be >= 1");
  }
  if (
    signal.cognitiveFatigue.level === "CRITICAL" &&
    priorityAdjustment.adjustedTopN > 1 &&
    priorityAdjustment.deferNonCritical === false
  ) {
    violations.push("CRITICAL fatigue must defer non-critical or limit to 1 action");
  }

  return { ok: violations.length === 0, violations };
}

export function runPostDecisionEmotionalLoadGuarantee(
  result: PostDecisionEmotionalLoadResult,
): { ok: boolean; violations: string[] } {
  const violations: string[] = [];
  const meta = result.recommendationMetadata;

  if (!meta.cognitiveLoadRequired || !meta.emotionalImpact) {
    violations.push("recommendation metadata must include cognitive and emotional levels");
  }
  if (meta.burnoutContribution < 0 || meta.burnoutContribution > 1) {
    violations.push("burnoutContribution must be 0–1");
  }
  if (result.protectionMode.engaged && result.outputConstraints.maxActions > 1) {
    violations.push("protection mode must limit to 1 action");
  }
  if (
    result.outputConstraints.maxActions <= 2 &&
    result.outputConstraints.allowBranching &&
    (result.protectionMode.engaged ||
      result.outputConstraints.simplifyOutput)
  ) {
    violations.push("HIGH fatigue / protection mode must disallow branching");
  }

  return { ok: violations.length === 0, violations };
}
