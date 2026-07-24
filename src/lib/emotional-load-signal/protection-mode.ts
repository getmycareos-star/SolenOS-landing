import {
  BURNOUT_PROTECTION_THRESHOLD,
  FATIGUE_SURFACE_LIMITS,
  LOAD_AWARE_TEMPORAL_REDUCTION,
} from "./contract-constants";
import type {
  CaregiverProtectionMode,
  EmotionalLoadSignal,
  LoadAwarePriorityAdjustment,
} from "./types";

/**
 * Load-aware priority adjustment — HIGH priority + HIGH emotional load may defer/simplify.
 */
export function computeLoadAwarePriorityAdjustment(
  signal: EmotionalLoadSignal,
  baseTopN: number,
  detectionEnabled: boolean,
): LoadAwarePriorityAdjustment {
  const { cognitiveFatigue, stressIndicators, burnoutProbability } = signal;
  const fatigueLimit = FATIGUE_SURFACE_LIMITS[cognitiveFatigue.level];
  let adjustedTopN = Math.min(baseTopN, fatigueLimit);

  const highLoad =
    cognitiveFatigue.level === "HIGH" || cognitiveFatigue.level === "CRITICAL";
  const deferNonCritical = highLoad || burnoutProbability.value >= 0.5;
  const simplifyRecommendations =
    highLoad || stressIndicators.highUrgencyClustering >= 60;

  if (highLoad && baseTopN > 1) {
    adjustedTopN = Math.min(adjustedTopN, cognitiveFatigue.level === "CRITICAL" ? 1 : 2);
  }

  let temporalWeightReduction = 0;
  if (deferNonCritical && detectionEnabled) {
    temporalWeightReduction = LOAD_AWARE_TEMPORAL_REDUCTION;
  }

  const parts: string[] = [];
  if (adjustedTopN < baseTopN) {
    parts.push(`topN ${baseTopN}→${adjustedTopN} (${cognitiveFatigue.level} fatigue)`);
  }
  if (deferNonCritical) parts.push("defer non-critical under high load");
  if (simplifyRecommendations) parts.push("simplify multi-step recommendations");

  return {
    adjustedTopN,
    deferNonCritical,
    simplifyRecommendations,
    temporalWeightReduction,
    reasoning: parts.length > 0 ? parts.join("; ") : "no load-aware adjustment needed",
  };
}

export type ProtectionModeRiskContext = {
  outputRiskLevel?: string;
  priorityOverrideApplied?: boolean;
  medicalOrTimeSensitive?: boolean;
  topRiskLevel?: string;
};

/**
 * Caregiver Protection Mode — burnout > threshold AND high risk.
 * Human stability over task completion speed.
 */
export function evaluateCaregiverProtectionMode(
  signal: EmotionalLoadSignal,
  risk: ProtectionModeRiskContext,
  detectionEnabled: boolean,
): CaregiverProtectionMode {
  const burnoutHigh = signal.burnoutProbability.value >= BURNOUT_PROTECTION_THRESHOLD;
  const riskHigh =
    risk.outputRiskLevel === "high" ||
    risk.outputRiskLevel === "critical" ||
    risk.topRiskLevel === "HIGH" ||
    risk.topRiskLevel === "CRITICAL" ||
    risk.priorityOverrideApplied === true ||
    risk.medicalOrTimeSensitive === true;

  const fatigueCritical = signal.cognitiveFatigue.level === "CRITICAL";
  const engaged =
    detectionEnabled && ((burnoutHigh && riskHigh) || fatigueCritical);

  const constraints = {
    maxActions: engaged ? 1 : signal.cognitiveFatigue.level === "HIGH" ? 2 : 4,
    allowBranching: !engaged && signal.cognitiveFatigue.level !== "HIGH" && signal.cognitiveFatigue.level !== "CRITICAL",
    deferNonCritical: engaged || signal.cognitiveFatigue.level !== "LOW",
    simplifyOutput:
      engaged ||
      signal.cognitiveFatigue.level === "HIGH" ||
      signal.cognitiveFatigue.level === "CRITICAL",
  };

  let reason = "Protection mode not engaged.";
  if (engaged) {
    reason =
      burnoutHigh && riskHigh
        ? `Burnout ${(signal.burnoutProbability.value * 100).toFixed(0)}% with high risk — human stability prioritized over speed.`
        : `Critical cognitive fatigue — single simple action only.`;
  }

  return { engaged, reason, constraints };
}

export function mergeProtectionConstraints(
  protection: CaregiverProtectionMode,
  priorityAdjustment: LoadAwarePriorityAdjustment,
): CaregiverProtectionMode {
  if (!protection.engaged) return protection;
  return {
    ...protection,
    constraints: {
      ...protection.constraints,
      maxActions: Math.min(protection.constraints.maxActions, priorityAdjustment.adjustedTopN),
      deferNonCritical: true,
      simplifyOutput: true,
      allowBranching: false,
    },
  };
}
