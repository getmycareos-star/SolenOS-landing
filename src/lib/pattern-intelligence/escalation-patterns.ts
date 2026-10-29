import type { JourneyGraphEvent } from "../care-journey-graph/types";
import type { DetectedPattern } from "./types";

/**
 * Severity escalation inferred from adjectives in event prose is not a
 * measurement. Escalation patterns must come from structured comparable
 * observations and the backend's coverage-aware change assessments.
 */
export function detectEscalationPatterns(_events: JourneyGraphEvent[]): DetectedPattern[] {
  return [];
}
