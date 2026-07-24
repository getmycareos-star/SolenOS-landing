import type { CaregiverLoadEngineResult } from "../caregiver-load-engine/types";
import type { InteractionLoadSignalResult } from "../interaction-load-signal/types";
import type { UrgencyDetectionResult } from "../urgency-detection";
import { classifyAttention } from "./classify-attention";
import { classifyBurnoutTier } from "./burnout-tier";
import type { AttentionClassification, AttentionLayerPayload } from "./types";

export type ProcessAttentionLayerParams = {
  rawInput: string;
  urgencyDetection: UrgencyDetectionResult;
  caregiverLoadEngine: CaregiverLoadEngineResult;
  interactionLoadLayer?: InteractionLoadSignalResult;
  safetyOverrideEngaged?: boolean;
};

export type AttentionLayerResult = {
  classification: AttentionClassification;
  burnoutTier: ReturnType<typeof classifyBurnoutTier>;
};

export function processAttentionLayer(
  params: ProcessAttentionLayerParams,
): AttentionLayerResult {
  const { state } = params.caregiverLoadEngine;
  const classification = classifyAttention({
    rawInput: params.rawInput,
    urgencyDetection: params.urgencyDetection,
    scores: state.scores,
    signals: state.signals,
    interactionLoadLayer: params.interactionLoadLayer,
    acuteBurnoutTriggered: state.burnout.acuteTriggered,
    safetyOverrideEngaged: params.safetyOverrideEngaged,
  });

  const burnoutTier = classifyBurnoutTier(
    state.burnout.probability,
    state.burnout.acuteTriggered,
  );

  return { classification, burnoutTier };
}

export function toAttentionLayerPayload(result: AttentionLayerResult): AttentionLayerPayload {
  const { classification, burnoutTier } = result;
  return {
    attentionClass: classification.attentionClass,
    attentionPriority: classification.attentionPriority,
    label: classification.label,
    reasoning: classification.reasoning,
    confidence: classification.confidence,
    burnoutTier,
    dominantLoadCategory: classification.dominantLoadCategory ?? null,
  };
}

export function formatAttentionObservation(result: AttentionLayerResult): string {
  const c = result.classification;
  return `OBSERVATION: ATTENTION_ENGINE class=${c.attentionClass} priority=${c.attentionPriority} burnout=${result.burnoutTier} confidence=${c.confidence.toFixed(2)}`;
}
