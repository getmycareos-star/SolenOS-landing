import type { GovernanceApplicationResult } from "../../settings-governance/types";
import {
  CARE_CONTEXT_INTENT_CONFIDENCE_THRESHOLD,
  CARE_CONTEXT_LAYER_FORBIDDEN,
  CARE_CONTEXT_LAYER_IDENTITY,
  CARE_CONTEXT_LAYER_ONE_LINE_TRUTH,
  CARE_CONTEXT_LAYER_PIPELINE_POSITION,
  CARE_CONTEXT_RECENT_EVENTS_MAX,
  CARE_CONTEXT_URGENCY_LEVELS,
  INTERRUPTION_RISK_LEVELS,
  LOCATION_CONTEXTS,
  SITUATION_TYPES,
  TIME_PRESSURE_LEVELS,
} from "./contract-constants";
import { classifyCareContextUrgency } from "./classify-urgency";
import {
  computeCareContext,
  formatSituationalCareContextObservation,
  toCareContextLayerPayload,
  type ComputeCareContextParams,
} from "./compute-care-context";
import { detectSituationType } from "./detect-situation";
import {
  runCareContextSystemGuarantee,
  validateCareContextLayerResult,
} from "./guarantee";
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
import { validateCareContextAgainstProfile } from "./validate-profile";
import {
  applyCareContextBehaviorWeighting,
  computeCareContextWeightEnvelope,
  mergeCareContextWithModuleWeights,
} from "./weighting";

export {
  CARE_CONTEXT_INTENT_CONFIDENCE_THRESHOLD,
  CARE_CONTEXT_LAYER_FORBIDDEN,
  CARE_CONTEXT_LAYER_IDENTITY,
  CARE_CONTEXT_LAYER_ONE_LINE_TRUTH,
  CARE_CONTEXT_LAYER_PIPELINE_POSITION,
  CARE_CONTEXT_RECENT_EVENTS_MAX,
  CARE_CONTEXT_URGENCY_LEVELS,
  INTERRUPTION_RISK_LEVELS,
  LOCATION_CONTEXTS,
  SITUATION_TYPES,
  TIME_PRESSURE_LEVELS,
};

export type {
  CareContextLayerPayload,
  CareContextLayerResult,
  CareContextSystemGuaranteeResult,
  CareContextUrgencyLevel,
  CareContextWeightEnvelope,
  InterruptionRisk,
  LocationContext,
  SituationType,
  SituationalCareContext,
  TimePressure,
} from "./types";

export {
  classifyCareContextUrgency,
  computeCareContext,
  computeCareContextWeightEnvelope,
  detectSituationType,
  extractActiveConstraints,
  extractInterruptionRisk,
  extractLocationContext,
  extractRecentEventsFromInput,
  extractTimePressure,
  extractUnresolvedItems,
  extractUserIntentSignal,
  formatSituationalCareContextObservation,
  mergeCareContextWithModuleWeights,
  mergeRecentEventsBuffer,
  runCareContextSystemGuarantee,
  toCareContextLayerPayload,
  validateCareContextAgainstProfile,
  validateCareContextLayerResult,
  applyCareContextBehaviorWeighting,
};

export type { ComputeCareContextParams };

/**
 * Post-reasoning merge of situational care context weights into governance module weights.
 */
export function applyCareContextGovernanceWeighting(
  governance: GovernanceApplicationResult,
  layer: import("./types").CareContextLayerResult,
): GovernanceApplicationResult {
  return {
    ...governance,
    moduleWeights: mergeCareContextWithModuleWeights(governance.moduleWeights, layer.envelope),
  };
}
