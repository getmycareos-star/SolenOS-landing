/**
 * Emotional Load Signal (v1.0) — CRITICAL SYSTEM LAYER
 * DERIVED over STATE + BELIEF + Caregiver Load Index.
 * Canonical companion: src/lib/solenos-layers/derived/compute-emotional-load
 */

export {
  EMOTIONAL_LOAD_SIGNAL_IDENTITY,
  EMOTIONAL_LOAD_SIGNAL_ONE_LINE_TRUTH,
  EMOTIONAL_LOAD_SIGNAL_PIPELINE_POSITION,
  EMOTIONAL_LOAD_SIGNAL_EARLY_POSITION,
  EMOTIONAL_LOAD_SIGNAL_FORBIDDEN,
  COGNITIVE_FATIGUE_LEVELS,
  BURNOUT_PROTECTION_THRESHOLD,
  COGNITIVE_FATIGUE_BANDS,
  STRESS_INDICATOR_WEIGHTS,
  BURNOUT_FORMULA_WEIGHTS,
  RECOVERY_TIME_STUB_MINUTES,
  LOAD_AWARE_TEMPORAL_REDUCTION,
  FATIGUE_SURFACE_LIMITS,
} from "./contract-constants";

export type {
  CognitiveFatigueLevel,
  StressIndicators,
  BurnoutProbability,
  CognitiveFatigue,
  SituationEmotionalLoadContribution,
  RecoveryTimeEstimate,
  EmotionalLoadSignal,
  EmotionalLoadSignalInputs,
  LoadAwarePriorityAdjustment,
  CaregiverProtectionMode,
  RecommendationLoadMetadata,
  EmotionalLoadGuaranteeResult,
  EmotionalLoadSignalLayerResult,
  PostDecisionEmotionalLoadResult,
  EmotionalLoadSignalLayerPayload,
} from "./types";

export {
  clamp01,
  clamp100,
  computeStressIndicators,
  computeBurnoutProbability,
  classifyCognitiveFatigue,
  buildCognitiveFatigueExplanation,
  computeSituationContributions,
  estimateRecoveryTime,
  computeCompositeEmotionalScore,
  computeEmotionalLoadSignal,
} from "./compute";

export {
  computeLoadAwarePriorityAdjustment,
  evaluateCaregiverProtectionMode,
  mergeProtectionConstraints,
  type ProtectionModeRiskContext,
} from "./protection-mode";

export {
  computeRecommendationLoadMetadata,
  applyLoadAwareTemporalReduction,
} from "./recommendation-metadata";

export {
  runEmotionalLoadGuarantee,
  runPostDecisionEmotionalLoadGuarantee,
} from "./guarantee";

export {
  buildEmotionalLoadSignalInputs,
  processEmotionalLoadSignalLayer,
  applyPostDecisionEmotionalLoad,
  toEmotionalLoadSignalLayerPayload,
  formatEmotionalLoadSignalObservation,
  type ProcessEmotionalLoadSignalParams,
  type ApplyPostDecisionEmotionalLoadParams,
} from "./process";
