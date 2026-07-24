/**
 * Attention Engine — Behavioral Specification v1.
 * Classifies situations: Now (A) / Watch (B) / Later (C).
 */

export {
  ATTENTION_ENGINE_IDENTITY,
  ATTENTION_ENGINE_ONE_LINE_TRUTH,
  ATTENTION_ENGINE_PIPELINE_POSITION,
  BEHAVIORAL_SPEC_V1_PRINCIPLES,
  BEHAVIORAL_SPEC_ANTI_PATTERNS,
  B2B2C_FUTURE_NOTE,
  ATTENTION_CLASS_HIT,
  ATTENTION_CLASS_A_PATTERNS,
  ATTENTION_CLASS_B_PATTERNS,
  ATTENTION_CLASS_C_PATTERNS,
  BURNOUT_TIER_THRESHOLDS,
} from "./contract-constants";

export type {
  AttentionClass,
  AttentionPriority,
  BurnoutTier,
  AttentionClassification,
  AttentionLayerPayload,
} from "./types";

export {
  ATTENTION_CLASS_LABELS,
  ATTENTION_PRIORITY_LABELS,
  attentionClassToPriority,
  labelForAttentionClass,
} from "./attention-labels";

export { classifyAttention, type ClassifyAttentionParams } from "./classify-attention";
export { classifyBurnoutTier } from "./burnout-tier";
export {
  shapeBehavioralResponse,
  type ShapeBehavioralResponseParams,
} from "./behavioral-response";
export {
  processAttentionLayer,
  toAttentionLayerPayload,
  formatAttentionObservation,
  type ProcessAttentionLayerParams,
  type AttentionLayerResult,
} from "./process";
