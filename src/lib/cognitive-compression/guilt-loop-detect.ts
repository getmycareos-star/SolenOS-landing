export {
  GUILT_REPLAY_INPUT_PATTERNS,
  detectGuiltReplayPatterns,
} from "./guilt-replay";

/** Spec alias — detect guilt replay loop patterns in caregiver input. */
export { detectGuiltReplayPatterns as detectGuiltLoopPatterns } from "./guilt-replay";

export {
  GUILT_VALIDATION_OUTPUT_PATTERNS,
  EMOTIONAL_ANALYSIS_EXPANSION_PATTERNS,
  validateGuiltReplayInterruption,
  isGuiltReplayInterruptionValid,
  type GuiltReplayViolationCode,
  type GuiltReplayResult,
} from "./guilt-replay";
