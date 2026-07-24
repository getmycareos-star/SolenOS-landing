export {
  isCaregiverQuestionPushback,
  resolveAnsweredUncertainties,
  mergeKnownUnknowns,
} from "./resolve-uncertainty";
export {
  filterOpenUncertaintiesForCareBlob,
  filterSessionUncertaintyAsks,
  gapFamilySatisfiedInCareBlob,
  projectOpenUncertaintiesForState,
  reconcileOpenUncertainties,
} from "./uncertainty-lifecycle";
export type { UncertaintyLifecycleResult } from "./uncertainty-lifecycle";
export {
  PROGRESSIVE_UNDERSTANDING_IDENTITY,
  PROGRESSIVE_UNDERSTANDING_PURPOSE,
  PROGRESSIVE_UNDERSTANDING_CHAIN,
  PROGRESSIVE_UNDERSTANDING_EFFECTS,
  PROGRESSIVE_UNDERSTANDING_NEVER,
} from "./contract-constants";
export type { ProgressiveUnderstandingEffect } from "./contract-constants";
export type {
  ProgressiveUnderstandingInput,
  ProgressiveUnderstandingResult,
  ObservationSignal,
} from "./types";
export { processProgressiveUnderstanding } from "./process";
export {
  detectObservationSignals,
  collectSituationSignals,
  latestObservationSignals,
  patternLabelFor,
  isImprovementUpdate,
  looksLikeImprovementNote,
} from "./detect-signals";
export {
  MAX_CAREGIVER_QUESTIONS,
  EARLY_CAREGIVER_QUESTIONS,
  questionFamily,
  isSafetyCriticalAsk,
  isUnderstandingGatherAsk,
  isCaregiverFacingAsk,
  earlyGatherIncomplete,
  understandingSufficient,
  careContextGapsRemain,
  careRealityObservations,
  hasCareEvidenceHeld,
  latestObservationIsCareWorthy,
  latestCareObservationFact,
  appetiteGatherIncomplete,
  nextQuestionsForUnderstanding,
} from "./questions";
export {
  buildCareClarityPillars,
  buildGuidanceOrientationPillars,
  isCaregiverFacingFactLine,
  isCaregiverGuidanceDemand,
  stripCaregiverGuidancePhrases,
} from "./clarity-pillars";
export type { CareClarityPillars } from "./clarity-pillars";
