import type { SolenOSResponse } from "../response-validator";
import type { AppliedSafetyConstraint } from "../safety-enforcement/types";
import type { DecisionAuthorityLevel } from "../settings-governance/types-derived";
import type { GovernanceApplicationResult } from "../settings-governance/types";
import type { OverloadSimplificationSignals, SystemRiskState } from "./types";

const OVERLOAD_CONFIRMATION_PREFIX = "[Confirm before acting] ";
const OVERLOAD_SIMPLIFY_MARKER =
  "[Systemic risk overload — focused on top priorities only.]";

function truncateSentence(text: string, maxChars: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return trimmed;
  const cut = trimmed.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

/**
 * When overload HIGH: simplify decision outputs, suppress secondary recommendations,
 * reduce autonomy, increase confirmation.
 */
export function applyOverloadSafetySimplification(
  response: SolenOSResponse,
  overload: OverloadSimplificationSignals,
  applied: AppliedSafetyConstraint[] = [],
): SolenOSResponse {
  if (!overload.overloadHigh) return response;

  let next = { ...response };

  if (overload.simplifyDecisionOutputs || overload.reduceCognitiveComplexity) {
    applied.push({
      kind: "autonomy_reduction",
      detail: "situation risk overload — reduce cognitive output complexity",
    });
    next = {
      ...next,
      what_is_happening: truncateSentence(next.what_is_happening, 160),
      what_matters_now: truncateSentence(next.what_matters_now, 140),
      what_to_ask_next: truncateSentence(next.what_to_ask_next, 120),
    };
  }

  if (overload.suppressSecondaryRecommendations) {
    applied.push({
      kind: "warning_constraint",
      detail: "situation risk overload — suppress secondary recommendations",
    });
    next = {
      ...next,
      what_can_wait: truncateSentence(
        `${OVERLOAD_SIMPLIFY_MARKER} Secondary items deferred.`,
        180,
      ),
    };
  }

  if (overload.increaseConfirmation || overload.reduceAutonomy) {
    applied.push({
      kind: "autonomy_reduction",
      detail: "situation risk overload — increase confirmation / reduce autonomy",
    });
    if (!next.what_matters_now.startsWith(OVERLOAD_CONFIRMATION_PREFIX)) {
      next = {
        ...next,
        what_matters_now: OVERLOAD_CONFIRMATION_PREFIX + next.what_matters_now,
      };
    }
  }

  return next;
}

function reduceAutonomyLevel(
  current: DecisionAuthorityLevel,
  steps: number,
): DecisionAuthorityLevel {
  const order: DecisionAuthorityLevel[] = ["HIGH", "MEDIUM", "LOW"];
  const idx = order.indexOf(current);
  const next = Math.min(order.length - 1, Math.max(0, idx + steps));
  return order[next]!;
}

/**
 * Bridge overload into settings-governance routing — lower autonomy, prefer simplify mode.
 */
export function applySituationRiskGovernanceWeighting(
  governance: GovernanceApplicationResult,
  params: {
    systemRisk: SystemRiskState;
    overload: OverloadSimplificationSignals;
  },
): GovernanceApplicationResult {
  const { systemRisk, overload } = params;
  if (!overload.overloadHigh && systemRisk.totalRiskExposure <= 0) {
    return governance;
  }

  let decisionAutonomy = governance.routing.decisionAutonomy;
  let emotionalMode = governance.settings.emotionalControl.mode;

  if (overload.reduceAutonomy) {
    decisionAutonomy = reduceAutonomyLevel(decisionAutonomy, 1);
  }
  if (overload.simplifyDecisionOutputs || overload.reduceCognitiveComplexity) {
    emotionalMode = "simplify";
  }

  return {
    ...governance,
    settings: {
      ...governance.settings,
      emotionalControl: {
        ...governance.settings.emotionalControl,
        mode: emotionalMode,
        overloadSimplification:
          overload.reduceCognitiveComplexity ||
          governance.settings.emotionalControl.overloadSimplification,
      },
      decisionControl: {
        ...governance.settings.decisionControl,
        level: decisionAutonomy,
        requireConfirmationForHighRisk:
          overload.increaseConfirmation ||
          governance.settings.decisionControl.requireConfirmationForHighRisk,
      },
    },
    routing: {
      ...governance.routing,
      decisionAutonomy,
    },
    appliedConstraints: [
      ...governance.appliedConstraints,
      {
        kind: "memory_module_weight",
        detail: `situationRiskRegister exposure=${systemRisk.totalRiskExposure.toFixed(1)} overload=${overload.overloadHigh} volatility=${systemRisk.riskVolatility.toFixed(1)}`,
      },
    ],
  };
}
