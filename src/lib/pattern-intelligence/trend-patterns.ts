import type { JourneyGraphEvent } from "../care-journey-graph/types";
import type { DetectedPattern } from "./types";

/**
 * Text-keyword trend inference is intentionally disabled. Direction and severity
 * require structured, time-bound observations, coverage-aware comparisons, and
 * persisted evidence links from the backend change-intelligence service.
 */
export function detectTrendPatterns(_events: JourneyGraphEvent[]): DetectedPattern[] {
  return [];
}
