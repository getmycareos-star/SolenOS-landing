import type { InputMode } from "../../input-classification";
import type { UrgencyDetectionResult } from "../../urgency-detection";
import { CARE_CONTEXT_INTENT_CONFIDENCE_THRESHOLD } from "./contract-constants";
import { classifyCareContextUrgency } from "./classify-urgency";
import { detectSituationType } from "./detect-situation";
import { runCareContextSystemGuarantee } from "./guarantee";
import {
  extractActiveConstraints,
  extractInterruptionRisk,
  extractLocationContext,
  extractRecentEventsFromInput,
  extractTimePressure,
  extractUnresolvedItems,
  extractUserIntentSignal,
  mergeRecentEventsBuffer,
} from "./signals";
import type { CareContextLayerResult, SituationalCareContext } from "./types";
import { computeCareContextWeightEnvelope } from "./weighting";

export type ComputeCareContextParams = {
  input: string;
  inputMode: InputMode;
  urgencyDetection: UrgencyDetectionResult;
  /** Ephemeral request-scope buffer only — never persisted across sessions. */
  recentEventsBuffer?: string[];
};

/**
 * Compute fresh situational Care Context for this interaction only.
 * NOT stored long-term; NOT merged into Care Profile identity.
 */
export function computeCareContext(params: ComputeCareContextParams): CareContextLayerResult {
  const text = params.input.trim();
  const intentSignal = extractUserIntentSignal(text);

  let situationType = detectSituationType({
    input: text,
    inputMode: params.inputMode,
    urgencyDetection: params.urgencyDetection,
    intentConfidence: intentSignal.confidence,
  });

  if (
    intentSignal.confidence < CARE_CONTEXT_INTENT_CONFIDENCE_THRESHOLD &&
    situationType !== "emergency"
  ) {
    situationType = "uncertain_state";
  }

  const urgencyLevel = classifyCareContextUrgency({
    urgencyDetection: params.urgencyDetection,
    situationType,
  });

  const locationContext = extractLocationContext(text);
  const timePressure = extractTimePressure(text, params.urgencyDetection);
  const interruptionRisk = extractInterruptionRisk(text);

  const activeConstraints = extractActiveConstraints(text, params.inputMode);
  const unresolvedItems = extractUnresolvedItems(text);
  if (unresolvedItems.length > 0 && !activeConstraints.includes("unresolved_information")) {
    activeConstraints.push("unresolved_information");
  }

  const context: SituationalCareContext = {
    timestamp: new Date().toISOString(),
    situationType,
    urgencyLevel,
    environmentSignals: {
      locationContext: locationContext ?? "unknown",
      timePressure,
      interruptionRisk,
    },
    activeConstraints,
    recentEvents: mergeRecentEventsBuffer(
      params.recentEventsBuffer,
      extractRecentEventsFromInput(text),
    ),
    unresolvedItems,
    userIntentSignal: intentSignal,
  };

  const envelope = computeCareContextWeightEnvelope(context);

  const guarantee = runCareContextSystemGuarantee({
    context,
    envelopeApplied: true,
    intentThresholdChecked: true,
  });

  return { context, envelope, guarantee };
}

export function toCareContextLayerPayload(
  result: CareContextLayerResult,
): import("./types").CareContextLayerPayload {
  const { context, envelope } = result;
  return {
    situationType: context.situationType,
    urgencyLevel: context.urgencyLevel,
    locationContext: context.environmentSignals.locationContext,
    timePressure: context.environmentSignals.timePressure,
    interruptionRisk: context.environmentSignals.interruptionRisk,
    intentConfidence: context.userIntentSignal.confidence,
    unresolvedCount: context.unresolvedItems.length,
    constraintCount: context.activeConstraints.length,
    envelope,
  };
}

/**
 * Observation tag for LLM envelope — situational snapshot only, not identity.
 */
export function formatSituationalCareContextObservation(
  context: SituationalCareContext,
): string {
  const intent =
    context.userIntentSignal.explicitIntent ??
    context.userIntentSignal.inferredIntent ??
    "unspecified";
  const confidenceNote =
    context.userIntentSignal.confidence < CARE_CONTEXT_INTENT_CONFIDENCE_THRESHOLD
      ? " (low confidence — do not assume action)"
      : "";
  return (
    `SITUATIONAL_CARE_CONTEXT: type=${context.situationType}; urgency=${context.urgencyLevel}; ` +
    `location=${context.environmentSignals.locationContext ?? "unknown"}; ` +
    `time_pressure=${context.environmentSignals.timePressure}; ` +
    `interruption_risk=${context.environmentSignals.interruptionRisk}; ` +
    `intent=${intent}${confidenceNote}; unresolved=${context.unresolvedItems.length}`
  );
}
