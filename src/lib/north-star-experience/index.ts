export {
  NORTH_STAR_EXPERIENCE_IDENTITY,
  NORTH_STAR_FEELING,
  NORTH_STAR_OPTIMIZING_FOR,
  NORTH_STAR_NOT_OPTIMIZING,
  EMOTIONAL_OUTCOMES,
  PRODUCT_PRINCIPLES,
  PRINCIPLE_DEFINITIONS,
  EXPERIENCE_TEST_QUESTION,
  EXPERIENCE_ANTI_PATTERNS,
  BEHAVIORAL_INDICATORS,
  CONTINUATION_PHRASES,
  DEFINING_PRINCIPLE,
  ENGINEERING_DECISION_RULE,
} from "./contract-constants";

export type {
  ProductPrinciple,
  EmotionalOutcome,
  BehavioralIndicator,
  NorthStarExperienceResult,
  ProcessNorthStarExperienceInput,
  ExperienceGateInput,
  ExperienceGateResult,
} from "./types";

export {
  inputSignalsContinuation,
  findRelatedPriorEvents,
  topicFromText,
} from "./detect-continuity";
export { buildContinuityRecognition } from "./continuity-voice";
export { evaluateExperience } from "./evaluate-experience";
export { passesExperienceTest } from "./experience-gate";
export { processNorthStarExperience } from "./pipeline";
export { resetNorthStarExperienceStore, getExperienceSnapshots } from "./store";
