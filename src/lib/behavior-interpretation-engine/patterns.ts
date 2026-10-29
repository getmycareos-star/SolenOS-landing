import type { CanonicalCareEvent } from "../situation-entry/types";
import type { LongitudinalPattern, ObservedBehavior } from "./types";

/**
 * Longitudinal pattern authority is the persisted backend change/pattern service.
 *
 * This synchronous client-side interpretation pipeline has no authenticated
 * persistence or observation-coverage contract. It must not manufacture
 * longitudinal counts, confidence labels, or contextual associations from
 * keyword matches or process-local memory. Callers receive no inferred
 * longitudinal patterns here; the workspace renders persisted API results.
 */
export function learnLongitudinalPatterns(_input: {
  caregiver_id: string;
  observed: ObservedBehavior[];
  all_events: CanonicalCareEvent[];
}): LongitudinalPattern[] {
  return [];
}

/** Retained for source compatibility; there is no client-side pattern store. */
export function resetBehaviorPatternStore(): void {
  // Intentionally empty: longitudinal pattern state is persisted by the backend.
}
