import { getGraphForCaregiver } from "../care-journey-graph/graph-store";
import { detectCoOccurrencePatterns } from "./co-occurrence-patterns";
import { detectEscalationPatterns } from "./escalation-patterns";
import { detectFrequencyPatterns } from "./frequency-patterns";
import { detectTrendPatterns } from "./trend-patterns";
import type { DetectedPattern } from "./types";

/**
 * PatternEngine — continuous temporal pattern detection over Care Journey graph.
 * Detects structure, not meaning. Never diagnoses.
 */
export function runPatternEngine(
  caregiverId: string,
  caseId: string | null = null,
  now: Date = new Date(),
): DetectedPattern[] {
  const graph = getGraphForCaregiver(caregiverId, caseId);
  const events = graph?.events ?? [];

  const frequency = detectFrequencyPatterns(events, now);
  const trend = detectTrendPatterns(events);
  const coOccurrence = detectCoOccurrencePatterns(events, now);
  const escalation = detectEscalationPatterns(events);

  const seen = new Set<string>();
  return [...frequency, ...trend, ...coOccurrence, ...escalation].filter((p) => {
    const key = `${p.pattern_type}:${p.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function patternEngineEventCount(
  caregiverId: string,
  caseId: string | null = null,
): number {
  const graph = getGraphForCaregiver(caregiverId, caseId);
  return graph?.events.length ?? 0;
}
