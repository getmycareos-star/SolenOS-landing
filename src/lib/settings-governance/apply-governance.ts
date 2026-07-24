import type { SolenOSResponse } from "../response-validator";
import { canonicalizeRiskLevel } from "../final-output-contract";
import type { SolenOSRiskLevel } from "../implementation-enforcement/risk-levels";
import { RISK_RANK } from "../implementation-enforcement/risk-levels";
import {
  computeGovernanceRouting,
  computeModuleActivation,
  computeModuleWeights,
} from "./module-weights";
import { runSystemBehaviorGuarantee } from "./system-guarantee";
import type {
  AppliedGovernanceConstraint,
  GovernanceApplicationResult,
  SolenOSSettings,
} from "./types";

const CONFIRMATION_PREFIX = "[Confirm before acting] ";

export type ApplyGovernanceContext = {
  /** Risk level from validated reasoning output — used for notification routing only. */
  validatedRiskLevel?: SolenOSRiskLevel;
};

/**
 * GOVERNANCE LAYER — applies settings constraints to validated reasoning output.
 * Runs after reasoning/decision/action generation, before output assembly.
 */
export function applySettingsGovernance(
  response: SolenOSResponse,
  settings: SolenOSSettings,
  context: ApplyGovernanceContext = {},
): GovernanceApplicationResult {
  const originalResponse = { ...response };
  const appliedConstraints: AppliedGovernanceConstraint[] = [];

  const moduleActivation = computeModuleActivation(settings);
  const moduleWeights = computeModuleWeights(settings, moduleActivation);
  const routing = computeGovernanceRouting(settings, moduleWeights);

  let constrained = { ...response };

  constrained = applySystemModeEnvelope(constrained, settings, routing, appliedConstraints);
  constrained = applySafetyTransparencyRouting(constrained, settings, appliedConstraints);
  constrained = applyEmotionalSimplification(constrained, settings, appliedConstraints);
  constrained = applyDecisionAuthorityConstraints(constrained, settings, appliedConstraints);
  constrained = applyPrivacyConstraints(constrained, settings, moduleWeights, appliedConstraints);
  constrained = applyNotificationRouting(constrained, settings, context, appliedConstraints);

  const result: GovernanceApplicationResult = {
    response: constrained,
    originalResponse,
    settings,
    moduleActivation,
    moduleWeights,
    routing,
    appliedConstraints,
    guarantee: { ok: true, violations: [] },
  };

  result.guarantee = runSystemBehaviorGuarantee(result);

  return result;
}

function applySystemModeEnvelope(
  response: SolenOSResponse,
  settings: SolenOSSettings,
  routing: ReturnType<typeof computeGovernanceRouting>,
  applied: AppliedGovernanceConstraint[],
): SolenOSResponse {
  applied.push({
    kind: "system_mode_envelope",
    detail: `systemMode=${settings.systemMode} inferenceDepth=${routing.inferenceDepth}`,
  });

  if (settings.systemMode === "CONSERVATIVE") {
    return capRiskLevel(response, "medium", applied, "risk_cap");
  }

  if (settings.systemMode === "CRISIS") {
    const capped = capRiskLevel(response, "high", applied, "risk_cap");
    if (RISK_RANK[capped.risk_level] < RISK_RANK.medium) {
      applied.push({
        kind: "risk_floor",
        detail: "CRISIS mode prevents downplaying urgency below medium",
      });
      return { ...capped, risk_level: "medium" };
    }
    return capped;
  }

  return response;
}

/** Governance records safety transparency routing only — output constraints live in safety-enforcement. */
function applySafetyTransparencyRouting(
  response: SolenOSResponse,
  settings: SolenOSSettings,
  applied: AppliedGovernanceConstraint[],
): SolenOSResponse {
  const { safetyControl } = settings;
  applied.push({
    kind: "transparency_routing",
    detail: `alwaysShowUncertainty=${safetyControl.alwaysShowUncertainty} noCertaintyMode=${safetyControl.noCertaintyMode} riskTolerance=${safetyControl.riskTolerance}`,
  });
  return response;
}

function applyEmotionalSimplification(
  response: SolenOSResponse,
  settings: SolenOSSettings,
  applied: AppliedGovernanceConstraint[],
): SolenOSResponse {
  const { emotionalControl, systemMode } = settings;
  const shouldSimplify =
    emotionalControl.mode === "simplify" ||
    emotionalControl.overloadSimplification ||
    systemMode === "CRISIS" ||
    systemMode === "CONSERVATIVE";

  if (!shouldSimplify) return response;

  applied.push({
    kind: "emotional_simplification",
    detail: `mode=${emotionalControl.mode} overloadSimplification=${emotionalControl.overloadSimplification}`,
  });

  return {
    ...response,
    what_matters_now: truncateForSimplification(response.what_matters_now, 280),
    what_can_wait: truncateForSimplification(response.what_can_wait, 200),
  };
}

function applyDecisionAuthorityConstraints(
  response: SolenOSResponse,
  settings: SolenOSSettings,
  applied: AppliedGovernanceConstraint[],
): SolenOSResponse {
  const { decisionControl } = settings;
  let result = { ...response };

  if (
    decisionControl.requireConfirmationForHighRisk &&
    RISK_RANK[result.risk_level] >= RISK_RANK.high &&
    !result.what_to_ask_next.startsWith(CONFIRMATION_PREFIX)
  ) {
    applied.push({
      kind: "confirmation_required",
      detail: "requireConfirmationForHighRisk=true",
    });
    result = {
      ...result,
      what_to_ask_next: CONFIRMATION_PREFIX + result.what_to_ask_next,
    };
  }

  if (decisionControl.level === "LOW" && !result.what_to_ask_next.startsWith(CONFIRMATION_PREFIX)) {
    applied.push({
      kind: "confirmation_required",
      detail: "decisionAuthority=LOW",
    });
    result = {
      ...result,
      what_to_ask_next: CONFIRMATION_PREFIX + result.what_to_ask_next,
    };
  }

  applied.push({
    kind: "transparency_routing",
    detail: `reasoningVisibility=${decisionControl.reasoningVisibility}`,
  });

  return result;
}

function applyPrivacyConstraints(
  response: SolenOSResponse,
  settings: SolenOSSettings,
  moduleWeights: ReturnType<typeof computeModuleWeights>,
  applied: AppliedGovernanceConstraint[],
): SolenOSResponse {
  if (settings.privacyControl.disableInferenceEngine) {
    applied.push({
      kind: "privacy_inference_block",
      detail: "disableInferenceEngine=true — memory weight zeroed",
    });
  }

  if (
    !settings.privacyControl.allowBehaviorInference &&
    settings.memoryControl.inferenceFromBehavior
  ) {
    applied.push({
      kind: "privacy_inference_block",
      detail: "behavior-based inference disabled by privacy control",
    });
  }

  if (!settings.memoryControl.allowMemoryRead) {
    applied.push({
      kind: "privacy_inference_block",
      detail: "allowMemoryRead=false — memory read blocked",
    });
  }

  applied.push({
    kind: "memory_module_weight",
    detail: `memory=${moduleWeights.memory.toFixed(2)} read=${settings.memoryControl.allowMemoryRead} write=${settings.memoryControl.allowMemoryWrite}`,
  });

  return response;
}

function applyNotificationRouting(
  response: SolenOSResponse,
  settings: SolenOSSettings,
  context: ApplyGovernanceContext,
  applied: AppliedGovernanceConstraint[],
): SolenOSResponse {
  const { notificationControl } = settings;
  const risk = context.validatedRiskLevel ?? response.risk_level;

  let eligible = true;
  if (notificationControl.urgencyFilter === "RED") {
    eligible = risk === "critical";
  } else if (notificationControl.urgencyFilter === "RED_ORANGE") {
    eligible = RISK_RANK[risk] >= RISK_RANK.high;
  }

  if (notificationControl.quietHoursEnabled && !notificationControl.emergencyOverride) {
    eligible = false;
  }

  applied.push({
    kind: "notification_routing",
    detail: `eligible=${eligible} filter=${notificationControl.urgencyFilter} digest=${notificationControl.digestMode}`,
  });

  return response;
}

function capRiskLevel(
  response: SolenOSResponse,
  maxLevel: SolenOSRiskLevel,
  applied: AppliedGovernanceConstraint[],
  kind: "risk_cap" | "risk_floor",
): SolenOSResponse {
  if (RISK_RANK[response.risk_level] > RISK_RANK[maxLevel]) {
    applied.push({
      kind,
      detail: `capped ${response.risk_level} → ${maxLevel}`,
    });
    return { ...response, risk_level: canonicalizeRiskLevel(maxLevel) };
  }
  return response;
}

function truncateForSimplification(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const truncated = text.slice(0, maxLen).trimEnd();
  const lastSpace = truncated.lastIndexOf(" ");
  const cut = lastSpace > maxLen * 0.6 ? truncated.slice(0, lastSpace) : truncated;
  return cut + "…";
}

export function toGovernanceLayerPayload(
  result: GovernanceApplicationResult,
): import("./types").GovernanceLayerPayload {
  return {
    systemMode: result.settings.systemMode,
    routing: result.routing,
    moduleActivation: result.moduleActivation,
    appliedConstraints: result.appliedConstraints,
  };
}
