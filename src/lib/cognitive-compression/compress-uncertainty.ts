import type { SolenOSResponse } from "../response-validator";
import { collectCaregiverText } from "../solenos-fields";

export type CompressionConstraintViolationCode =
  | "multi_path_reasoning"
  | "speculative_branching"
  | "alternative_simulation"
  | "depth_expansion";

/** Multi-path reasoning and speculation patterns forbidden by COMPRESS UNCERTAINTY. */
export const MULTI_PATH_REASONING_PATTERNS = [
  /\bon the one hand\b/i,
  /\bon the other hand\b/i,
  /\beither .{0,40} or\b/i,
  /\bcould (?:also )?be\b/i,
  /\bpossibilit(?:y|ies) include\b/i,
  /\bmultiple (?:scenarios|paths|outcomes)\b/i,
  /\balternatively\b/i,
  /\banother (?:possibility|interpretation|scenario)\b/i,
  /\bif .{0,30} then .{0,30} (?:but|however|alternatively)\b/i,
] as const;

export const SPECULATIVE_BRANCHING_PATTERNS = [
  /\bit might mean\b/i,
  /\bthis could indicate\b/i,
  /\bthis may suggest\b/i,
  /\bprobably (?:means|indicates|due to)\b/i,
  /\blikely (?:means|indicates|due to)\b/i,
  /\bwhat if .{0,40} happens\b/i,
  /\bsimulate\b/i,
  /\bscenario (?:1|2|one|two)\b/i,
] as const;

export const ALTERNATIVE_SIMULATION_PATTERNS = [
  /\bconsider (?:all )?(?:the )?(?:options|alternatives|possibilities)\b/i,
  /\bweigh (?:the )?options\b/i,
  /\bcompare (?:the )?(?:options|scenarios|alternatives)\b/i,
  /\bplay (?:it )?out\b/i,
  /\bretrospective(?:ly)?\b/i,
  /\bwhat would have happened\b/i,
  /\bif only\b/i,
] as const;

export const DEPTH_EXPANSION_PATTERNS = [
  /\bin depth\b/i,
  /\bto understand (?:this|why)\b/i,
  /\blet me explain\b/i,
  /\bhere's (?:how|why) .{0,30} works\b/i,
  /\bthe mechanism (?:is|behind)\b/i,
  /\broot cause analysis\b/i,
] as const;

export interface CompressionConstraintResult {
  valid: boolean;
  violations: CompressionConstraintViolationCode[];
}

function matchAny(text: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

/** Validates no speculation or multi-path reasoning in output. */
export function validateCompressionConstraints(
  output: SolenOSResponse,
): CompressionConstraintResult {
  const text = collectCaregiverText(output);
  const violations = new Set<CompressionConstraintViolationCode>();

  if (matchAny(text, MULTI_PATH_REASONING_PATTERNS)) {
    violations.add("multi_path_reasoning");
  }
  if (matchAny(text, SPECULATIVE_BRANCHING_PATTERNS)) {
    violations.add("speculative_branching");
  }
  if (matchAny(text, ALTERNATIVE_SIMULATION_PATTERNS)) {
    violations.add("alternative_simulation");
  }
  if (matchAny(text, DEPTH_EXPANSION_PATTERNS)) {
    violations.add("depth_expansion");
  }

  return { valid: violations.size === 0, violations: [...violations] };
}

export function isCompressionConstraintsValid(output: SolenOSResponse): boolean {
  return validateCompressionConstraints(output).valid;
}
