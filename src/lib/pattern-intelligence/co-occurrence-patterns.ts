import type { JourneyGraphEvent } from "../care-journey-graph/types";
import type { DetectedPattern } from "./types";

/**
 * Narrative keyword co-occurrence does not establish that domains changed
 * together, shared a valid time window, or are related. Use persisted backend
 * assessments with explicit timestamps and evidence links instead.
 */
export function detectCoOccurrencePatterns(
  _events: JourneyGraphEvent[],
  _now: Date = new Date(),
): DetectedPattern[] {
  return [];
}
