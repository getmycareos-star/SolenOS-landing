import type { JourneyGraphEvent } from "../care-journey-graph/types";
import { DISCUSSION_FRAMING, FREQUENCY_WINDOW_DAYS } from "./contract-constants";
import type { DetectedPattern } from "./types";

function createPatternId(): string {
  return `pat_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function eventsInWindow(events: JourneyGraphEvent[], windowDays: number, now: Date): JourneyGraphEvent[] {
  const nowMs = now.getTime();
  const cutoff = nowMs - windowDays * 24 * 60 * 60 * 1000;
  const seen = new Set<string>();
  return events.filter((event) => {
    const timestamp = new Date(event.timestamp).getTime();
    if (!Number.isFinite(timestamp) || timestamp < cutoff || timestamp > nowMs || seen.has(event.id)) return false;
    seen.add(event.id);
    return true;
  });
}

type FrequencyRule = {
  event_types: JourneyGraphEvent["event_type"][];
  min_count: number;
  window_days: number;
  label: string;
};

const FREQUENCY_RULES: FrequencyRule[] = [
  {
    event_types: ["fall"],
    min_count: 2,
    window_days: FREQUENCY_WINDOW_DAYS,
    label: "Repeated recorded fall events",
  },
  {
    event_types: ["emergency_visit", "hospital_visit"],
    min_count: 2,
    window_days: 60,
    label: "Repeated recorded hospital or emergency events",
  },
  {
    event_types: ["medication_started", "medication_stopped"],
    min_count: 3,
    window_days: FREQUENCY_WINDOW_DAYS,
    label: "Multiple recorded medication event records",
  },
];

/**
 * This client graph has no verified observation-coverage denominator. It can
 * report a count of distinct recorded event IDs, but cannot claim a calibrated
 * confidence, normalized occurrence rate, absence, deterioration, or recovery.
 * Persisted backend assessments are authoritative for those interpretations.
 */
export function detectFrequencyPatterns(
  events: JourneyGraphEvent[],
  now: Date = new Date(),
): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];

  for (const rule of FREQUENCY_RULES) {
    const matched = eventsInWindow(events, rule.window_days, now)
      .filter((event) => rule.event_types.includes(event.event_type));
    if (matched.length < rule.min_count) continue;

    patterns.push({
      id: createPatternId(),
      pattern_type: "frequency",
      label: rule.label,
      description:
        `${matched.length} distinct recorded event(s) in the last ${rule.window_days} days. ` +
        "Observation coverage is not available in this client view, so this count is not a normalized occurrence rate and does not establish what happened during unobserved intervals.",
      event_ids: matched.map((event) => event.id),
      confidence: "low",
      window_days: rule.window_days,
      discussion_note: DISCUSSION_FRAMING,
    });
  }

  return patterns;
}
