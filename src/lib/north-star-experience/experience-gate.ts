import {
  EXPERIENCE_ANTI_PATTERNS,
  EXPERIENCE_TEST_QUESTION,
  NORTH_STAR_NOT_OPTIMIZING,
} from "./contract-constants";
import type { ExperienceGateInput, ExperienceGateResult } from "./types";

/**
 * Gate for feature and engineering decisions — must pass before building.
 */
export function passesExperienceTest(input: ExperienceGateInput): ExperienceGateResult {
  const reasons: string[] = [];
  let passes = true;

  if (
    input.strengthens_continuity ||
    input.reduces_cognitive_burden ||
    input.makes_caregiver_feel_understood
  ) {
    reasons.push("Aligns with at least one north star outcome");
  } else {
    passes = false;
    reasons.push("Does not strengthen continuity, reduce burden, or increase felt understanding");
  }

  if (input.requires_repetition) {
    passes = false;
    reasons.push(`Violates: ${EXPERIENCE_ANTI_PATTERNS[0]}`);
  }

  if (input.ignores_prior_context) {
    passes = false;
    reasons.push(`Violates: ${EXPERIENCE_ANTI_PATTERNS[1]}`);
  }

  if (input.increases_screen_time) {
    passes = false;
    reasons.push(`Optimizes for ${NORTH_STAR_NOT_OPTIMIZING[3]} — not north star`);
  }

  let recommendation: ExperienceGateResult["recommendation"] = "build";
  if (!passes) {
    recommendation =
      input.strengthens_continuity || input.reduces_cognitive_burden ? "redesign" : "remove";
  }

  return {
    passes,
    experience_test_question: EXPERIENCE_TEST_QUESTION,
    reasons,
    recommendation,
  };
}
