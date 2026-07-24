import type { CaregiverDepletionSignalsResult } from "../caregiver-depletion-signals";
import type { CaregiverLoad } from "../caregiver-load-index/types";
import type {
  EmotionalLoadSignalLayerResult,
  PostDecisionEmotionalLoadResult,
} from "../emotional-load-signal/types";
import { detectGuiltReplayPatterns } from "../cognitive-compression";
import {
  evaluateContainmentMode,
  evaluateEmotionalValidation,
} from "./containment-validation";
import {
  detectEmotionalContradictionLoops,
  emotionalContradictionHints,
} from "./detect-emotional-contradiction";
import { detectIdentityDrift } from "./detect-identity-drift";
import { detectMoralInjury } from "./detect-moral-injury";
import {
  detectHighSignalStressPattern,
  highSignalStressMetricBoosts,
} from "./detect-high-signal-stress";
import { runCaregiverPsychologicalLoadGuarantee } from "./guarantee";
import type {
  CaregiverPsychologicalLoadPayload,
  CaregiverPsychologicalLoadResult,
  HighSignalStressLayerPayload,
  HighSignalStressPatternResult,
} from "./types";

export type ProcessCaregiverPsychologicalLoadParams = {
  userInput?: string;
  caregiverLoad: CaregiverLoad;
  emotionalLoadSignalLayer?: EmotionalLoadSignalLayerResult;
  postDecisionEmotionalLoad?: PostDecisionEmotionalLoadResult;
  depletion?: CaregiverDepletionSignalsResult;
  assumptionHints?: readonly string[];
  memoryLabels?: readonly string[];
  sessionIdentityHints?: readonly string[];
  unresolvedSituationCount?: number;
  openConflictCount?: number;
  deferredDemandTitles?: readonly string[];
  protectionModeEngaged?: boolean;
  /** Pre-computed high-signal stress (pipeline early pass); recomputed from userInput if absent. */
  highSignalStress?: HighSignalStressPatternResult;
};

/**
 * Pipeline: after CLI + Emotional Load, before/with Conflict.
 * Pure derived functions — no STATE mutation.
 */
export function processCaregiverPsychologicalLoad(
  params: ProcessCaregiverPsychologicalLoadParams,
): CaregiverPsychologicalLoadResult {
  const guiltReplay = detectGuiltReplayPatterns(params.userInput ?? "");

  const highSignalStress =
    params.highSignalStress ??
    detectHighSignalStressPattern({ userInput: params.userInput });

  const emotionalContradictionLoops = detectEmotionalContradictionLoops({
    userInput: params.userInput,
    assumptionHints: params.assumptionHints,
    memoryLabels: params.memoryLabels,
    caregiverLoad: params.caregiverLoad,
    emotionalLoad: params.emotionalLoadSignalLayer,
    openConflictCount: params.openConflictCount,
  });

  const moralInjury = detectMoralInjury({
    userInput: params.userInput,
    caregiverLoad: params.caregiverLoad,
    emotionalLoad: params.emotionalLoadSignalLayer,
    guiltReplayDetected: guiltReplay,
    openConflictCount: params.openConflictCount,
    emotionalContradictionLoopCount: emotionalContradictionLoops.length,
  });

  // Re-run loops with moral injury for compound detection
  const refinedLoops =
    emotionalContradictionLoops.length > 0
      ? emotionalContradictionLoops
      : detectEmotionalContradictionLoops({
          userInput: params.userInput,
          assumptionHints: params.assumptionHints,
          memoryLabels: params.memoryLabels,
          caregiverLoad: params.caregiverLoad,
          emotionalLoad: params.emotionalLoadSignalLayer,
          moralInjury,
          openConflictCount: params.openConflictCount,
        });

  const identityDrift = detectIdentityDrift({
    userInput: params.userInput,
    caregiverLoad: params.caregiverLoad,
    emotionalLoad: params.emotionalLoadSignalLayer,
    sessionHints: params.sessionIdentityHints,
    unresolvedSituationCount: params.unresolvedSituationCount,
    depletionState: params.depletion?.caregiver_depletion_state,
  });

  const containmentMode = evaluateContainmentMode({
    caregiverLoad: params.caregiverLoad,
    moralInjury,
    identityDrift,
    emotionalContradictionLoops: refinedLoops,
    postDecisionEmotionalLoad: params.postDecisionEmotionalLoad,
    deferredDemandTitles: params.deferredDemandTitles,
    protectionModeEngaged: params.protectionModeEngaged,
    highSignalStress,
  });

  const emotionalValidation = evaluateEmotionalValidation({
    caregiverLoad: params.caregiverLoad,
    moralInjury,
    identityDrift,
    emotionalContradictionLoops: refinedLoops,
    openConflictCount: params.openConflictCount,
    containmentEngaged: containmentMode.engaged,
    highSignalStress,
  });

  const result: CaregiverPsychologicalLoadResult = {
    moralInjury,
    identityDrift,
    emotionalContradictionLoops: refinedLoops,
    containmentMode,
    emotionalValidation,
    highSignalStress,
    guarantee: { ok: true, violations: [] },
  };
  result.guarantee = runCaregiverPsychologicalLoadGuarantee(result);
  return result;
}

export function toCaregiverPsychologicalLoadPayload(
  result: CaregiverPsychologicalLoadResult,
): CaregiverPsychologicalLoadPayload {
  return {
    moralInjurySeverity: result.moralInjury.severity,
    moralInjuryContribution: result.moralInjury.contributionToLoad,
    identityDriftLevel: result.identityDrift.driftLevel,
    emotionalContradictionLoopCount: result.emotionalContradictionLoops.length,
    containmentEngaged: result.containmentMode.engaged,
    emotionalValidationTriggered: result.emotionalValidation !== null,
    emotionalValidationMessage: result.emotionalValidation?.message ?? null,
    whatNotToDoToday: result.containmentMode.whatNotToDoToday,
    guaranteeOk: result.guarantee.ok,
    acuteCaregiverBurnoutRiskState: result.highSignalStress.acuteCaregiverBurnoutRiskState,
    highSignalStressEngaged:
      result.highSignalStress.signals.emotionalHarm.detected ||
      result.highSignalStress.signals.sleepDisruption.detected ||
      result.highSignalStress.signals.uncertaintyOverload.detected,
  };
}

export function toHighSignalStressLayerPayload(
  result: HighSignalStressPatternResult,
  containmentEngaged: boolean,
): HighSignalStressLayerPayload {
  return {
    emotionalLoadScore: result.emotionalLoadScore,
    sleepDisruptionRisk: result.sleepDisruptionRisk,
    uncertaintyIndex: result.uncertaintyIndex,
    safetyStressEnvironmentFlag: result.safetyStressEnvironmentFlag,
    acuteCaregiverBurnoutRiskState: result.acuteCaregiverBurnoutRiskState,
    containmentModeEngaged: containmentEngaged,
    groundingMessage: result.groundingMessage,
  };
}

export function formatHighSignalStressObservation(
  result: HighSignalStressPatternResult,
): string {
  return `OBSERVATION: HIGH_SIGNAL_STRESS emotional=${result.emotionalLoadScore} sleep=${result.sleepDisruptionRisk} uncertainty=${result.uncertaintyIndex} acute=${result.acuteCaregiverBurnoutRiskState} safety_env=${result.safetyStressEnvironmentFlag}`;
}

export { highSignalStressMetricBoosts };

export function formatCaregiverPsychologicalLoadObservation(
  result: CaregiverPsychologicalLoadResult,
): string {
  const parts = [
    `OBSERVATION: PSYCH_LOAD moral=${result.moralInjury.severity}`,
    `drift=${result.identityDrift.driftLevel}`,
    `loops=${result.emotionalContradictionLoops.length}`,
    `containment=${result.containmentMode.engaged}`,
  ];
  if (result.emotionalValidation) {
    parts.push("validation=triggered");
  }
  return parts.join(" ");
}

export { emotionalContradictionHints };
