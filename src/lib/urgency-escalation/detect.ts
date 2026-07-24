import type { StressNormalizedOutput } from "../input-stress-normalizer";
import { HIGH_URGENCY_SIGNAL_PATTERNS, type UrgencySignalDetectionResult } from "./constants";

function labelForPattern(pattern: RegExp): string {
  return pattern.source.replace(/\\b/g, "").replace(/\\'?/g, "'").replace(/\(\?:[^)]+\)\??/g, "").slice(0, 40);
}

/** Section 4 — input-grounded high-urgency signal detection (not diagnosis). */
export function detectHighUrgencySignals(input: string): UrgencySignalDetectionResult {
  const matched_signals: string[] = [];
  for (const pattern of HIGH_URGENCY_SIGNAL_PATTERNS) {
    if (pattern.test(input)) {
      matched_signals.push(labelForPattern(pattern));
    }
  }
  return { high_urgency: matched_signals.length > 0, matched_signals };
}

export function hasHighUrgencySignals(input: string): boolean {
  return detectHighUrgencySignals(input).high_urgency;
}

export function detectHighUrgencyFromNormalized(
  input: StressNormalizedOutput,
): UrgencySignalDetectionResult {
  return detectHighUrgencySignals(input.raw_input);
}

export function hasHighUrgencyFromNormalized(input: StressNormalizedOutput): boolean {
  return detectHighUrgencyFromNormalized(input).high_urgency;
}
