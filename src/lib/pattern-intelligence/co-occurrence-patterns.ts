import type { JourneyGraphEvent } from "../care-journey-graph/types";
import { CO_OCCURRENCE_WINDOW_DAYS, DISCUSSION_FRAMING } from "./contract-constants";
import type { DetectedPattern, PatternConfidence } from "./types";

function createPatternId(): string {
  return `pat_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

type CoOccurrenceRule = {
  label: string;
  description: string;
  matchers: ((e: JourneyGraphEvent) => boolean)[];
  min_match: number;
};

const CO_RULES: CoOccurrenceRule[] = [
  {
    label: "Falls with appetite and mobility changes",
    description: "Falls occurring alongside reduced appetite or mobility observations in the same period.",
    matchers: [
      (e) => e.event_type === "fall",
      (e) => /\b(appetite|eating)\b/i.test(`${e.title} ${e.description}`),
      (e) => /\b(weight|mobil\w*|walking)\b/i.test(`${e.title} ${e.description}`),
    ],
    min_match: 2,
  },
  {
    label: "Confusion with infection and medication change",
    description: "Confusion-related events co-occurring with infection diagnosis or medication changes.",
    matchers: [
      (e) => /\b(confus\w*)\b/i.test(`${e.title} ${e.description}`),
      (e) =>
        e.event_type === "diagnosis" ||
        /\b(uti|infection|urinary)\b/i.test(`${e.title} ${e.description}`),
      (e) => ["medication_started", "medication_stopped"].includes(e.event_type),
    ],
    min_match: 2,
  },
  {
    label: "Hospital visit with medication and symptom changes",
    description: "Hospital or emergency events alongside medication and symptom observations.",
    matchers: [
      (e) => ["hospital_visit", "emergency_visit"].includes(e.event_type),
      (e) => ["medication_started", "medication_stopped"].includes(e.event_type),
      (e) => ["symptom", "behaviour_change"].includes(e.event_type),
    ],
    min_match: 2,
  },
];

function eventsInWindow(
  events: JourneyGraphEvent[],
  windowDays: number,
  now: Date,
): JourneyGraphEvent[] {
  const cutoff = now.getTime() - windowDays * 24 * 60 * 60 * 1000;
  return events.filter((e) => new Date(e.timestamp).getTime() >= cutoff);
}

export function detectCoOccurrencePatterns(
  events: JourneyGraphEvent[],
  now: Date = new Date(),
): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];
  const windowEvents = eventsInWindow(events, CO_OCCURRENCE_WINDOW_DAYS, now);

  for (const rule of CO_RULES) {
    const matchedGroups = rule.matchers.map((fn) => windowEvents.filter(fn));
    const matchCount = matchedGroups.filter((g) => g.length > 0).length;
    if (matchCount < rule.min_match) continue;

    const eventIds = [
      ...new Set(matchedGroups.flat().map((e) => e.id)),
    ];

    const confidence: PatternConfidence =
      matchCount >= 3 && eventIds.length >= 4
        ? "high"
        : matchCount >= 2 && eventIds.length >= 3
          ? "medium"
          : "low";

    patterns.push({
      id: createPatternId(),
      pattern_type: "co_occurrence",
      label: rule.label,
      description: rule.description,
      event_ids: eventIds,
      confidence,
      window_days: CO_OCCURRENCE_WINDOW_DAYS,
      discussion_note: DISCUSSION_FRAMING,
    });
  }

  return patterns;
}
