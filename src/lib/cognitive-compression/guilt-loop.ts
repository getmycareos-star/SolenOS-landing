export {
  GUILT_REPLAY_INPUT_PATTERNS as GUILT_REPLAY_PATTERNS,
  GUILT_VALIDATION_OUTPUT_PATTERNS,
  EMOTIONAL_ANALYSIS_EXPANSION_PATTERNS,
  detectGuiltReplayPatterns,
  detectGuiltLoopPatterns,
  validateGuiltReplayInterruption,
  isGuiltReplayInterruptionValid,
  type GuiltReplayViolationCode,
  type GuiltReplayResult,
} from "./guilt-loop-detect";

export const GUILT_REPLAY_OBSERVATION_TAG_PREFIX = "OBSERVATION: GUILT_REPLAY_SIGNAL:";

/** Observational tag only — does NOT route behavior or change output schema. */
export function formatGuiltReplayObservation(detected: boolean): string | null {
  return detected ? `${GUILT_REPLAY_OBSERVATION_TAG_PREFIX} detected` : null;
}
