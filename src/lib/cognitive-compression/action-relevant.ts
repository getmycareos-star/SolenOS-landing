import type { SolenOSResponse } from "../response-validator";

export type ActionRelevantViolationCode =
  | "matters_lacks_change_signal"
  | "matters_background_only"
  | "matters_emotional_only";

/** Signals that what_matters_now surfaces actionable change or risk. */
export const ACTION_RELEVANT_MARKERS = [
  /\bnew\b/i,
  /\bchanged\b/i,
  /\bworsen(?:ing|ed)?\b/i,
  /\bcontradict/i,
  /\brisk\b/i,
  /\burgent\b/i,
  /\bimmediate\b/i,
  /\bconfirm\b/i,
  /\bclarif(?:y|ication)\b/i,
  /\bfocus\b/i,
  /\bmonitor\b/i,
  /\bescalat/i,
  /\bmissed\b/i,
  /\bnot (?:taking|eating|breathing)\b/i,
  /\bCRITICAL\b/i,
  /\b🔴\b/,
] as const;

/** Background context without actionable change signal. */
export const BACKGROUND_ONLY_PATTERNS = [
  /\bin general\b/i,
  /\bover time\b/i,
  /\bhistorically\b/i,
  /\bfor context\b/i,
  /\bbackground\b/i,
  /\blong[- ]term\b/i,
  /\bunderstanding (?:the|why)\b/i,
] as const;

/** Emotional commentary without actionable change. */
export const EMOTIONAL_ONLY_PATTERNS = [
  /\bit's (?:hard|difficult|stressful)\b/i,
  /\bfeeling overwhelmed\b/i,
  /\bemotionally\b/i,
  /\byou're (?:doing|trying)\b/i,
  /\bthis must be\b/i,
] as const;

export interface ActionRelevantResult {
  valid: boolean;
  violations: ActionRelevantViolationCode[];
}

function matchAny(text: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

/** Validates what_matters_now surfaces change/risk only — not background or emotional filler. */
export function validateActionRelevantChange(output: SolenOSResponse): ActionRelevantResult {
  const matters = output.what_matters_now.trim();
  const violations = new Set<ActionRelevantViolationCode>();

  const hasChangeSignal = matchAny(matters, ACTION_RELEVANT_MARKERS);

  if (!hasChangeSignal) {
    violations.add("matters_lacks_change_signal");
  }

  if (matchAny(matters, BACKGROUND_ONLY_PATTERNS) && !hasChangeSignal) {
    violations.add("matters_background_only");
  }

  if (matchAny(matters, EMOTIONAL_ONLY_PATTERNS) && !hasChangeSignal) {
    violations.add("matters_emotional_only");
  }

  return { valid: violations.size === 0, violations: [...violations] };
}

export function isActionRelevantChangeValid(output: SolenOSResponse): boolean {
  return validateActionRelevantChange(output).valid;
}
