import type { StressNormalizedOutput } from "../input-stress-normalizer";

/** Detect emotional signals in normalized input. */
export function detectEmotionalInput(input: StressNormalizedOutput): boolean {
  if (input.metadata.has_emotional_language) return true;
  return input.detected_tags.includes("EMOTIONAL_OVERLOAD");
}
