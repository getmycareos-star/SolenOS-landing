import type { SolenOSResponse } from "../response-validator";
import type { BehaviorProfile } from "../input-classification";
import type { SafetyOverrideState } from "../safety-override";
import { countCaregiverTextWords } from "../cognitive-compression/verbosity";
import { VERBOSITY_TOTAL_WORD_LIMITS } from "../cognitive-compression";
import {
  CRITICAL_TOTAL_MAX_WORDS,
  HIGH_TOTAL_MAX_WORDS,
} from "../safety-override";
import {
  COMPRESSION_LIMITS,
  type OutputCompressionResult,
  type OutputCompressionViolationCode,
} from "./compression-constants";

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function countBullets(text: string): number {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return 0;

  const explicitBullets = lines.filter((line) => /^[-*•]|\d+[.)]\s/.test(line)).length;
  if (explicitBullets > 0) return explicitBullets;

  return lines.length;
}

function countQuestions(text: string): number {
  const matches = text.match(/\?/g);
  return matches?.length ?? 0;
}

function countTotalWords(output: SolenOSResponse): number {
  return countCaregiverTextWords(output);
}

function resolveLimits(
  output: SolenOSResponse,
  profile?: BehaviorProfile,
  safetyOverride?: SafetyOverrideState,
) {
  const factor = profile?.verbosity_factor ?? 1;

  if (safetyOverride?.floor_risk_level === "critical") {
    return {
      what_is_happening_max_words: CRITICAL_TOTAL_MAX_WORDS,
      what_matters_now_max_bullets: 3,
      what_to_ask_next_max_questions: 2,
      what_can_wait_max_bullets: 1,
      total_max_words: CRITICAL_TOTAL_MAX_WORDS,
    };
  }

  if (safetyOverride?.floor_risk_level === "high") {
    return {
      what_is_happening_max_words: 60,
      what_matters_now_max_bullets: 4,
      what_to_ask_next_max_questions: 3,
      what_can_wait_max_bullets: 2,
      total_max_words: HIGH_TOTAL_MAX_WORDS,
    };
  }

  return {
    what_is_happening_max_words: Math.max(
      40,
      Math.floor(COMPRESSION_LIMITS.what_is_happening_max_words * factor),
    ),
    what_matters_now_max_bullets: COMPRESSION_LIMITS.what_matters_now_max_bullets,
    what_to_ask_next_max_questions: COMPRESSION_LIMITS.what_to_ask_next_max_questions,
    what_can_wait_max_bullets: COMPRESSION_LIMITS.what_can_wait_max_bullets,
    total_max_words: VERBOSITY_TOTAL_WORD_LIMITS[output.risk_level],
  };
}

/** Mandatory output compression — limits tighten under behavior profile and safety override. */
export function validateOutputCompression(
  output: SolenOSResponse,
  profile?: BehaviorProfile,
  safetyOverride?: SafetyOverrideState,
): OutputCompressionResult {
  const limits = resolveLimits(output, profile, safetyOverride);
  const violations: OutputCompressionViolationCode[] = [];

  if (countWords(output.what_is_happening) > limits.what_is_happening_max_words) {
    violations.push("happening_over_word_limit");
  }
  if (countBullets(output.what_matters_now) > limits.what_matters_now_max_bullets) {
    violations.push("matters_over_bullet_limit");
  }
  if (countQuestions(output.what_to_ask_next) > limits.what_to_ask_next_max_questions) {
    violations.push("ask_over_question_limit");
  }
  if (countBullets(output.what_can_wait) > limits.what_can_wait_max_bullets) {
    violations.push("can_wait_over_bullet_limit");
  }

  if (countTotalWords(output) > limits.total_max_words) {
    violations.push("total_over_word_limit");
  }

  return { valid: violations.length === 0, violations };
}

export function isOutputCompressionValid(
  output: SolenOSResponse,
  profile?: BehaviorProfile,
  safetyOverride?: SafetyOverrideState,
): boolean {
  return validateOutputCompression(output, profile, safetyOverride).valid;
}
