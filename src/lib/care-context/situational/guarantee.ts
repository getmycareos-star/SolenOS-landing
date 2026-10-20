import { CARE_CONTEXT_INTENT_CONFIDENCE_THRESHOLD } from "./contract-constants";
import type {
  CareContextLayerResult,
  CareContextSystemGuaranteeResult,
  SituationalCareContext,
} from "./types";

function urgencyLevelValid(level: SituationalCareContext["urgencyLevel"]): boolean {
  return level === "LOW" || level === "MEDIUM" || level === "HIGH" || level === "CRITICAL";
}

/**
 * System guarantee before decision — context fresh, urgency validated, intent checked.
 */
export function runCareContextSystemGuarantee(params: {
  context: SituationalCareContext;
  envelopeApplied: boolean;
  intentThresholdChecked: boolean;
}): CareContextSystemGuaranteeResult {
  const violations: string[] = [];
  const { context } = params;

  if (!context.timestamp) {
    violations.push("care context timestamp missing — not computed fresh");
  }

  if (!urgencyLevelValid(context.urgencyLevel)) {
    violations.push("urgency level not validated");
  }

  if (context.situationType === "emergency" && context.urgencyLevel !== "CRITICAL") {
    violations.push("emergency situation must have CRITICAL urgency");
  }

  if (!params.envelopeApplied) {
    violations.push("care context weighting envelope not applied");
  }

  if (!params.intentThresholdChecked) {
    violations.push("intent confidence threshold not checked");
  }

  if (
    context.userIntentSignal.confidence < CARE_CONTEXT_INTENT_CONFIDENCE_THRESHOLD &&
    context.situationType !== "uncertain_state" &&
    context.situationType !== "emergency" &&
    !context.userIntentSignal.explicitIntent
  ) {
    violations.push("low-confidence intent must not assume action without explicit intent");
  }

  if (context.unresolvedItems.length > 0 && context.activeConstraints.length === 0) {
    violations.push("unresolved items present but no active constraints recorded");
  }

  return { ok: violations.length === 0, violations };
}

export function validateCareContextLayerResult(
  result: CareContextLayerResult,
): CareContextSystemGuaranteeResult {
  return runCareContextSystemGuarantee({
    context: result.context,
    envelopeApplied: Boolean(result.envelope),
    intentThresholdChecked: true,
  });
}
