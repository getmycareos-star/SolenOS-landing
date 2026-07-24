/**
 * HUMAN TRUST LAYER — EXPLANATION (post-hoc).
 * Pipeline: Decision Engine → HUMAN TRUST → Safety → Output.
 * Canonical companion path: solenos-layers/explanation (re-exports).
 */

export {
  HUMAN_TRUST_LAYER_IDENTITY,
  HUMAN_TRUST_LAYER_ONE_LINE_TRUTH,
  HUMAN_TRUST_LAYER_PIPELINE_POSITION,
  HUMAN_TRUST_LAYER_FORBIDDEN,
  HUMAN_TRUST_OPTIMIZE_FOR,
  REVERSIBILITY_ACTIONS,
  DEFAULT_UNDO_LABEL,
  DEFAULT_IGNORE_LABEL,
  DEFAULT_CHOOSE_ALTERNATIVE_LABEL,
  EMOTIONAL_READABILITY_LOAD_STATES,
} from "./contract-constants";

export type {
  RecommendationExplanation,
  ReversibilityAction,
  AlternativeOption,
  ReversibilityAffordance,
  CaregiverLoadStateForTrust,
  EmotionalReadabilityLoadState,
  DecisionGraphDemand,
  DecisionExplanationContext,
  ChallengeComparison,
  HumanTrustGuaranteeResult,
  HumanTrustLayerResult,
  HumanTrustLayerPayload,
} from "./types";

export {
  buildRecommendationExplanation,
  buildReversibilityAffordance,
  fingerprintDecisionContext,
} from "./build-explanation";

export {
  shouldApplyEmotionalReadability,
  stripSystemJargon,
  simplifyExplanationForLoad,
} from "./emotional-readability";

export { challengeModeCompare } from "./challenge-mode";

export {
  runHumanTrustGuarantee,
  buildHumanTrustLayer,
  processHumanTrustLayer,
  toHumanTrustLayerPayload,
} from "./process";
