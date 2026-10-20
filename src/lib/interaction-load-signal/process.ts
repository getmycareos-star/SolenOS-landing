import {
  INTERACTION_LOAD_SYSTEM_INSIGHT,
  SLEEP_PROTECTION_MAX_ACTIONS,
} from "./contract-constants";
import { detectInteractionLoadSignals } from "./detect";
import {
  computeInteractionLoadMetricDeltas,
  evaluateInteractionLoadFlags,
  evaluateSleepProtectionMode,
  isInteractionLoadDetected,
} from "./compute";
import { runInteractionLoadGuarantee } from "./guarantee";
import type {
  InteractionLoadLayerPayload,
  InteractionLoadSignalResult,
  OutputStrategy,
} from "./types";

export type ProcessInteractionLoadSignalParams = {
  rawInput: string;
  /** Active situation id for situation-centric attachment (observational). */
  situationId?: string | null;
};

function resolveOutputStrategy(
  detected: boolean,
  sleepProtectionEngaged: boolean,
): OutputStrategy {
  if (!detected && !sleepProtectionEngaged) return "normal";
  return "interaction_survivability";
}

/**
 * Early pipeline pass — after input classification / load interpretation, before CLI + ELS.
 */
export function processInteractionLoadSignal(
  params: ProcessInteractionLoadSignalParams,
): InteractionLoadSignalResult {
  const detectedSignals = detectInteractionLoadSignals(params.rawInput);
  const metrics = computeInteractionLoadMetricDeltas(detectedSignals);
  const flags = evaluateInteractionLoadFlags(detectedSignals, metrics);
  const detected = isInteractionLoadDetected(detectedSignals, flags);

  let sleepProtectionMode = evaluateSleepProtectionMode(
    detectedSignals,
    metrics,
    detected,
  );

  if (detected && sleepProtectionMode.engaged) {
    sleepProtectionMode = {
      ...sleepProtectionMode,
      maxActions: Math.min(sleepProtectionMode.maxActions, SLEEP_PROTECTION_MAX_ACTIONS),
    };
  }

  const outputStrategy = resolveOutputStrategy(
    detected,
    sleepProtectionMode.engaged,
  );

  const result: InteractionLoadSignalResult = {
    detected,
    systemInsight: INTERACTION_LOAD_SYSTEM_INSIGHT,
    flags,
    metrics,
    sleepProtectionMode,
    outputStrategy,
    detectedSignals,
    guarantee: { ok: true, violations: [] },
  };

  result.guarantee = runInteractionLoadGuarantee(result);
  return result;
}

export function toInteractionLoadLayerPayload(
  layer: InteractionLoadSignalResult,
): InteractionLoadLayerPayload {
  return {
    detected: layer.detected,
    systemInsight: layer.systemInsight,
    outputStrategy: layer.outputStrategy,
    sleepProtectionEngaged: layer.sleepProtectionMode.engaged,
    sleepDisruptionRisk: layer.metrics.sleepDisruptionRisk,
    boundaryViolationIndex: layer.metrics.boundaryViolationIndex,
    emotionalLoadBoost: layer.metrics.emotionalLoadBoost,
    cognitiveLoadBoost: layer.metrics.cognitiveLoadBoost,
    repetitionFatigue: layer.flags.some((f) => f.code === "repetition_fatigue"),
    boundaryStress: layer.flags.some((f) => f.code === "boundary_stress"),
    matchedCategoryCount: layer.detectedSignals.matchedCategories.length,
    guaranteeOk: layer.guarantee.ok,
  };
}

export function formatInteractionLoadObservation(
  layer: InteractionLoadSignalResult,
): string {
  return `OBSERVATION: INTERACTION_LOAD detected=${layer.detected} strategy=${layer.outputStrategy} sleepProtection=${layer.sleepProtectionMode.engaged} bvi=${layer.metrics.boundaryViolationIndex.toFixed(0)} sleepRisk=${layer.metrics.sleepDisruptionRisk} flags=${layer.flags.map((f) => f.code).join(",") || "none"}`;
}
