import type { SolenOSResponse } from "../response-validator";
import { collectCaregiverText } from "../solenos-fields";

export type GuiltReplayViolationCode =
  | "guilt_narrative_validated"
  | "emotional_analysis_expanded"
  | "guilt_loop_not_interrupted";

export const GUILT_REPLAY_INPUT_PATTERNS = [
  /\bi should have\b/i,
  /\bwhat if i missed\b/i,
  /\bdid i fail\b/i,
  /\bi failed to\b/i,
  /\bshould i have\b/i,
  /\bwhat if i (?:didn't|did not|failed)\b/i,
  /\bwas it my fault\b/i,
  /\bdid i do (?:something )?wrong\b/i,
] as const;

/** Patterns that validate guilt narrative instead of normalizing uncertainty. */
export const GUILT_VALIDATION_OUTPUT_PATTERNS = [
  /\byou (?:were|are) right to (?:feel|worry|blame)\b/i,
  /\byou should feel guilty\b/i,
  /\byou (?:clearly )?failed\b/i,
  /\bit (?:was|is) your fault\b/i,
  /\byou (?:could|should) have prevented\b/i,
  /\byou missed (?:an opportunity|something important)\b/i,
  /\bvalidat(?:e|ing) (?:your )?(?:guilt|worry|fear)\b/i,
] as const;

/** Patterns that expand emotional analysis instead of interrupting replay loops. */
export const EMOTIONAL_ANALYSIS_EXPANSION_PATTERNS = [
  /\bit's understandable that you feel\b/i,
  /\byour guilt is\b/i,
  /\bprocessing (?:your )?emotions\b/i,
  /\bwork through (?:your )?feelings\b/i,
  /\bexplore (?:why|how) you feel\b/i,
  /\bthe emotional (?:weight|burden|toll)\b/i,
  /\bgrief (?:cycle|process|stage)\b/i,
  /\bself[- ]compassion\b/i,
] as const;

export interface GuiltReplayResult {
  valid: boolean;
  violations: GuiltReplayViolationCode[];
  input_has_guilt_replay: boolean;
}

function matchAny(text: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

export function detectGuiltReplayPatterns(input: string): boolean {
  return matchAny(input, GUILT_REPLAY_INPUT_PATTERNS);
}

/**
 * When input shows guilt replay, output must normalize uncertainty — NOT validate guilt
 * or expand emotional analysis.
 */
export function validateGuiltReplayInterruption(
  output: SolenOSResponse,
  input?: string,
): GuiltReplayResult {
  const text = collectCaregiverText(output);
  const violations = new Set<GuiltReplayViolationCode>();
  const inputHasGuiltReplay = input ? detectGuiltReplayPatterns(input) : false;

  if (matchAny(text, GUILT_VALIDATION_OUTPUT_PATTERNS)) {
    violations.add("guilt_narrative_validated");
  }
  if (matchAny(text, EMOTIONAL_ANALYSIS_EXPANSION_PATTERNS)) {
    violations.add("emotional_analysis_expanded");
  }

  if (inputHasGuiltReplay) {
    const normalizesUncertainty =
      /\buncertain\b/i.test(text) ||
      /\bnot (?:yet )?known\b/i.test(text) ||
      /\bonly facts stated\b/i.test(text) ||
      /\bclarif(?:y|ication)\b/i.test(text);
    if (!normalizesUncertainty && violations.size === 0) {
      violations.add("guilt_loop_not_interrupted");
    }
  }

  return {
    valid: violations.size === 0,
    violations: [...violations],
    input_has_guilt_replay: inputHasGuiltReplay,
  };
}

export function isGuiltReplayInterruptionValid(
  output: SolenOSResponse,
  input?: string,
): boolean {
  return validateGuiltReplayInterruption(output, input).valid;
}
