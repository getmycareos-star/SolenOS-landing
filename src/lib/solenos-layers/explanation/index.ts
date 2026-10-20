/**

 * LAYER 3: EXPLANATION — why / audit / trust (post-hoc only).

 * Contains: Decision History, Timeline, System Health (derived summary ONLY),

 * Human Trust Layer (RecommendationExplanation — understand / challenge / undo).

 * MUST NOT influence decisions.

 */



export {

  writeExplanationDecision,

  toExplanationDecision,

  writeDecisionHistory,

  getDecisionHistoryLog,

  setDecisionHistoryLog,

  createEmptyDecisionHistoryLog,

  decisionHistoryForSituation,

  resetDecisionHistoryStore,

  type DecisionHistory,

  type WriteDecisionHistoryParams,

} from "./decision-history";



export {

  writeExplanationTimelineEvent,

  toExplanationTimelineEvent,

  createEmptyTimeline,

  timelineForSituation,

  appendTimelineEntry,

  type WriteTimelineEventParams,

  type TimelineEntry,

  type TimelineLog,

} from "./timeline";



export { viewHealthSummary } from "./health-view";



/** Human Trust Layer — post-decision explanation; facade: src/lib/human-trust-layer */

export {

  HUMAN_TRUST_LAYER_IDENTITY,

  HUMAN_TRUST_LAYER_ONE_LINE_TRUTH,

  HUMAN_TRUST_LAYER_PIPELINE_POSITION,

  HUMAN_TRUST_LAYER_FORBIDDEN,

  buildRecommendationExplanation,

  buildHumanTrustLayer,

  processHumanTrustLayer,

  toHumanTrustLayerPayload,

  challengeModeCompare,

  runHumanTrustGuarantee,

  type RecommendationExplanation,

  type DecisionExplanationContext,

  type HumanTrustLayerPayload,

  type HumanTrustLayerResult,

  type ChallengeComparison,

  type ReversibilityAffordance,

} from "../../human-trust-layer";


