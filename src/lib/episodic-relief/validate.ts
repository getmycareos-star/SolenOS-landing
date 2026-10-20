import type { SolenOSResponse } from "../response-validator";
import { collectCaregiverText } from "../solenos-fields";
import {
  DEPENDENCY_FRAMING_PATTERNS,
  MULTI_STEP_FLOW_PATTERNS,
  PLATFORM_BEHAVIOR_PATTERNS,
  RETENTION_ENGAGEMENT_PATTERNS,
  type EpisodicReliefResult,
  type EpisodicReliefViolationCode,
} from "./constants";

function matchAny(text: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

/** Episodic relief gate — no retention, engagement, or platform behavior in output. */
export function validateEpisodicRelief(output: SolenOSResponse): EpisodicReliefResult {
  const text = collectCaregiverText(output);
  const violations = new Set<EpisodicReliefViolationCode>();

  if (matchAny(text, RETENTION_ENGAGEMENT_PATTERNS)) {
    violations.add("retention_language");
    violations.add("engagement_loop");
  }

  if (matchAny(text, DEPENDENCY_FRAMING_PATTERNS)) {
    violations.add("dependency_framing");
  }

  if (matchAny(text, PLATFORM_BEHAVIOR_PATTERNS)) {
    violations.add("platform_behavior");
    if (/\bonboarding\b/i.test(text) || /\bset up your profile\b/i.test(text)) {
      violations.add("onboarding_prompt");
    }
  }

  if (/\b(build a habit|daily routine with this app)\b/i.test(text)) {
    violations.add("habit_formation");
  }

  if (matchAny(text, MULTI_STEP_FLOW_PATTERNS)) {
    violations.add("multi_step_flow");
  }

  return { valid: violations.size === 0, violations: [...violations] };
}

export function isEpisodicReliefValid(output: SolenOSResponse): boolean {
  return validateEpisodicRelief(output).valid;
}
