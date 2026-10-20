import {
  ACUTE_BURNOUT_GROUNDING_MESSAGE,
  CHRONIC_CONFLICT_OPEN_THRESHOLD,
  CLI_CONTAINMENT_ZONE,
  CONTAINMENT_MAX_ACTIONS,
  EMOTIONAL_VALIDATION_DEFAULT_MESSAGE,
} from "./contract-constants";
import type { CaregiverLoad } from "../caregiver-load-index/types";
import type { PostDecisionEmotionalLoadResult } from "../emotional-load-signal/types";
import type {
  ContainmentMode,
  EmotionalContradictionLoop,
  EmotionalValidation,
  HighSignalStressPatternResult,
  IdentityDriftState,
  MoralInjurySignal,
} from "./types";

function severityAtLeast(
  severity: MoralInjurySignal["severity"],
  minimum: MoralInjurySignal["severity"],
): boolean {
  const order = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };
  return order[severity] >= order[minimum];
}

function driftAtLeast(
  level: IdentityDriftState["driftLevel"],
  minimum: IdentityDriftState["driftLevel"],
): boolean {
  const order = { STABLE: 0, EMERGING: 1, SIGNIFICANT: 2, FRAGMENTED: 3 };
  return order[level] >= order[minimum];
}

export type EvaluateContainmentParams = {
  caregiverLoad: CaregiverLoad;
  moralInjury: MoralInjurySignal;
  identityDrift: IdentityDriftState;
  emotionalContradictionLoops: readonly EmotionalContradictionLoop[];
  postDecisionEmotionalLoad?: PostDecisionEmotionalLoadResult;
  deferredDemandTitles?: readonly string[];
  protectionModeEngaged?: boolean;
  highSignalStress?: HighSignalStressPatternResult;
};

/**
 * Containment mode — CLI critical zone (0.8–0.95), protection mode, emotional loops.
 * Load reducer: max 1 action, suppress expansion, emphasize what can wait.
 */
export function evaluateContainmentMode(params: EvaluateContainmentParams): ContainmentMode {
  const cliNorm = params.caregiverLoad.score / 100;
  const inCriticalZone =
    cliNorm >= CLI_CONTAINMENT_ZONE.min && cliNorm <= CLI_CONTAINMENT_ZONE.max;
  const cliStateCritical = params.caregiverLoad.state === "CRITICAL";
  const hasEmotionalLoop = params.emotionalContradictionLoops.some(
    (l) => l.triggersBehaviorChange,
  );
  const protection =
    params.protectionModeEngaged === true ||
    params.postDecisionEmotionalLoad?.protectionMode.engaged === true;

  const acuteBurnout = params.highSignalStress?.acuteCaregiverBurnoutRiskState === true;

  const engaged =
    acuteBurnout ||
    inCriticalZone ||
    cliStateCritical ||
    protection ||
    hasEmotionalLoop ||
    (severityAtLeast(params.moralInjury.severity, "HIGH") && cliNorm >= 0.7);

  const reasons: string[] = [];
  if (acuteBurnout) {
    reasons.push("Acute Caregiver Burnout Risk State (emotional harm + sleep + uncertainty)");
  }
  if (inCriticalZone) {
    reasons.push(`CLI critical zone (${params.caregiverLoad.score.toFixed(0)}/100)`);
  }
  if (cliStateCritical) reasons.push("CLI CRITICAL state");
  if (protection) reasons.push("Caregiver Protection Mode");
  if (hasEmotionalLoop) reasons.push("High emotional contradiction loop detected");
  if (severityAtLeast(params.moralInjury.severity, "HIGH")) {
    reasons.push(`Moral injury ${params.moralInjury.severity.toLowerCase()}`);
  }

  const whatNotToDoToday: string[] = [];
  if (engaged) {
    if (acuteBurnout) {
      whatNotToDoToday.push(
        "Do not pursue multi-step care plans or symptom tracking today — stabilization comes first.",
      );
      whatNotToDoToday.push(
        "Do not add medical advice tasks or parallel demands — one grounding step is enough.",
      );
    }
    for (const title of params.deferredDemandTitles ?? []) {
      whatNotToDoToday.push(`Do not take on "${title}" today — it can wait safely.`);
    }
    if (params.emotionalContradictionLoops.length > 0) {
      whatNotToDoToday.push(
        "Do not resolve emotional contradictions by adding more tasks — stabilize first.",
      );
    }
    if (severityAtLeast(params.moralInjury.severity, "HIGH")) {
      whatNotToDoToday.push(
        "Do not treat endurance guilt as a signal to do more — containment is the correct response.",
      );
    }
    whatNotToDoToday.push("Do not pursue multi-step plans or parallel demands today.");
  }

  return {
    engaged,
    reason:
      reasons.length > 0
        ? `Containment mode: ${reasons.join("; ")}.`
        : "Containment mode not engaged.",
    maxActions: engaged ? CONTAINMENT_MAX_ACTIONS : 4,
    suppressTaskExpansion: engaged,
    prioritizeEmotionalStabilization: engaged,
    emphasizeWhatCanWait: engaged,
    whatNotToDoToday: whatNotToDoToday.slice(0, 6),
    acuteBurnoutTriggered: acuteBurnout,
  };
}

export type EvaluateEmotionalValidationParams = {
  caregiverLoad: CaregiverLoad;
  moralInjury: MoralInjurySignal;
  identityDrift: IdentityDriftState;
  emotionalContradictionLoops: readonly EmotionalContradictionLoop[];
  openConflictCount?: number;
  containmentEngaged?: boolean;
  highSignalStress?: HighSignalStressPatternResult;
};

/**
 * Retention-critical normalization — EXPLANATION adjunct only; does NOT change STATE.
 */
export function evaluateEmotionalValidation(
  params: EvaluateEmotionalValidationParams,
): EmotionalValidation | null {
  const cliNorm = params.caregiverLoad.score / 100;
  const cliCritical =
    params.caregiverLoad.state === "CRITICAL" ||
    (cliNorm >= CLI_CONTAINMENT_ZONE.min && cliNorm <= CLI_CONTAINMENT_ZONE.max);
  const moralHigh = severityAtLeast(params.moralInjury.severity, "HIGH");
  const driftSignificant = driftAtLeast(params.identityDrift.driftLevel, "SIGNIFICANT");
  const chronicConflict =
    (params.openConflictCount ?? 0) >= CHRONIC_CONFLICT_OPEN_THRESHOLD &&
    params.emotionalContradictionLoops.length > 0;

  const triggers: string[] = [];
  if (cliCritical) triggers.push("CLI critical zone");
  if (moralHigh) triggers.push(`moral injury ${params.moralInjury.severity.toLowerCase()}`);
  if (driftSignificant) {
    triggers.push(`identity drift ${params.identityDrift.driftLevel.toLowerCase()}`);
  }
  if (chronicConflict) triggers.push("chronic unresolved conflict with emotional loop");
  if (params.containmentEngaged) triggers.push("containment mode active");
  if (params.highSignalStress?.acuteCaregiverBurnoutRiskState) {
    triggers.push("acute caregiver burnout risk state");
  }

  if (triggers.length === 0) return null;

  const message =
    params.highSignalStress?.groundingMessage ??
    (params.highSignalStress?.acuteCaregiverBurnoutRiskState
      ? ACUTE_BURNOUT_GROUNDING_MESSAGE
      : EMOTIONAL_VALIDATION_DEFAULT_MESSAGE);

  return {
    message,
    triggerReason: triggers.join("; "),
    normalizeExperience: true,
  };
}
