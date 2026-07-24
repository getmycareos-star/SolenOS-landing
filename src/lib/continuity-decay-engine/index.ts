export {

  CONTINUITY_DECAY_IDENTITY,

  DECAY_ENGINE_BOUNDARY,

  DECAY_PROHIBITED,

  FRESHNESS_TIERS,

  FRESHNESS_WINDOW_DAYS,

  CONFIDENCE_GAP_THRESHOLD,

  DECAY_PIPELINE_STAGES,

  REFRESH_QUESTION_TEMPLATES,

} from "./contract-constants";



export type {

  FreshnessTier,

  ObjectConfidence,

  ExpectedFollowUp,

  ContinuityGap,

  StaleContinuityItem,

  FamilyRhythm,

  RefreshSession,

  ContinuityDecayResult,

  ProcessContinuityDecayInput,

} from "./types";



export { classifyEventFreshness, objectLabel } from "./classify-freshness";

export {

  daysBetween,

  getLastConfirmedAt,

  computeObjectConfidence,

  computeOverallContinuityConfidence,

} from "./compute-decay";

export { learnFamilyRhythm } from "./family-rhythm";

export { deriveExpectedFollowUps } from "./expected-followups";

export { deriveStaleItems, detectContinuityGaps } from "./continuity-gaps";

export {

  buildRecheckPrompts,

  buildRefreshSession,

  buildDecisionTraceReasons,

} from "./refresh-planner";

export { resetContinuityDecayStore } from "./store";

export { processContinuityDecay, shouldTriggerDecayEngine } from "./pipeline";


