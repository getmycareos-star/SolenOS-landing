import type { JourneyGraphEvent } from "../care-journey-graph/types";
import { DISCUSSION_FRAMING, FREQUENCY_WINDOW_DAYS } from "./contract-constants";
import type { DetectedPattern, PatternConfidence } from "./types";

function createPatternId(): string {
  return `pat_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function eventsInWindow(
  events: JourneyGraphEvent[],
  windowDays: number,
  now: Date,
): JourneyGraphEvent[] {
  const cutoff = now.getTime() - windowDays * 24 * 60 * 60 * 1000;
  return events.filter((e) => new Date(e.timestamp).getTime() >= cutoff);
}

function confidenceFromCount(count: number, threshold: number): PatternConfidence {
  if (count >= threshold + 2) return "high";
  if (count >= threshold + 1) return "medium";
  return "low";
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
    label: "Repeated falls",
  },
  {
    event_types: ["emergency_visit", "hospital_visit"],
    min_count: 2,
    window_days: 60,
    label: "Repeated hospital or emergency visits",
  },
  {
    event_types: ["medication_started", "medication_stopped"],
    min_count: 3,
    window_days: FREQUENCY_WINDOW_DAYS,
    label: "Multiple medication changes",
  },
];

export function detectFrequencyPatterns(
  events: JourneyGraphEvent[],
  now: Date = new Date(),
): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];

  for (const rule of FREQUENCY_RULES) {
    const windowEvents = eventsInWindow(events, rule.window_days, now);
    const matched = windowEvents.filter((e) => rule.event_types.includes(e.event_type));
    if (matched.length < rule.min_count) continue;

    patterns.push({
      id: createPatternId(),
      pattern_type: "frequency",
      label: rule.label,
      description: `${matched.length} ${rule.event_types.join("/")} event(s) in the last ${rule.window_days} days.`,
      event_ids: matched.map((e) => e.id),
      confidence: confidenceFromCount(matched.length, rule.min_count),
      window_days: rule.window_days,
      discussion_note: DISCUSSION_FRAMING,
    });
  }

  return patterns;
}
