/**
 * Phase 9 — Caregiver Capacity Adaptation.
 * When overload signals appear, reduce questions and shorten orientation.
 * Never surface CareLoad scores. Never create another workload.
 */

export type CapacityAdaptation = {
  overload_likely: boolean;
  max_asks: number;
  shorten_response: boolean;
  single_priority_only: boolean;
  reason: "none" | "overload_language" | "explicit_overwhelm";
};

/**
 * Structural overwhelm cues — not topic-specific product logic.
 * Matches cognitive load phrasing patterns, not medical scenarios.
 */
export function adaptForCaregiverCapacity(rawInput: string): CapacityAdaptation {
  const text = rawInput.trim();
  if (!text) {
    return {
      overload_likely: false,
      max_asks: 3,
      shorten_response: false,
      single_priority_only: false,
      reason: "none",
    };
  }

  const overload =
    /\b(everything (is|at once)|too much|overwhelm|i don't know what to do|dont know what to do|can't keep up|cannot keep up|exhausted|falling apart)\b/i.test(
      text,
    );

  if (!overload) {
    return {
      overload_likely: false,
      max_asks: 3,
      shorten_response: false,
      single_priority_only: false,
      reason: "none",
    };
  }

  return {
    overload_likely: true,
    max_asks: 1,
    shorten_response: true,
    single_priority_only: true,
    reason: /don't know what to do|dont know what to do/i.test(text)
      ? "explicit_overwhelm"
      : "overload_language",
  };
}
