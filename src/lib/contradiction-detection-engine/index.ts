export {
  CHANGE_TYPES,
  CONTRADICTION_DETECTION_DEFINING_PRINCIPLE,
  CONTRADICTION_DETECTION_IDENTITY,
  CONTRADICTION_DETECTION_RULES,
  MOBILITY_STATE_PATTERNS,
} from "./contract-constants";
export type {
  ChangeType,
  ContradictionDetectionResult,
  OpenContradiction,
  ProcessContradictionDetectionInput,
  TransitionEvent,
} from "./types";
export { detectMobilityTransitions, mergeTimelineContradictions } from "./detect";
export { processContradictionDetection } from "./pipeline";
