import type { CareContext, PatternObservation } from "../types";

const SYMPTOM_KEYWORDS = [
  "headache",
  "pain",
  "wander",
  "confusion",
  "appetite",
  "fall",
  "exhaust",
  "night",
] as const;

/**
 * Pattern Learning Engine — identifies recurring relationships unique to each family.
 * Explicitly avoids assumptions of causation. Patterns help recognize changes earlier.
 */
export function detectPatterns(context: CareContext): PatternObservation[] {
  const patterns: PatternObservation[] = [];
  const disclaimer =
    "This pattern reflects repeated observations in your care timeline — not a medical cause or diagnosis.";

  for (const keyword of SYMPTOM_KEYWORDS) {
    const matching = context.timeline.filter((e) =>
      e.description.toLowerCase().includes(keyword),
    );

    if (matching.length >= 2) {
      const dates = matching
        .map((e) => e.date)
        .filter((d): d is string => d !== null)
        .sort();

      patterns.push({
        pattern: `Recurring "${keyword}" observations`,
        occurrences: matching.length,
        firstSeen: dates[0] ?? null,
        lastSeen: dates[dates.length - 1] ?? null,
        relatedEvents: matching.map((e) => e.description),
        disclaimer,
      });
    }
  }

  const nighttimeEvents = context.timeline.filter((e) =>
    /\b(night|overnight|evening|midnight)\b/i.test(e.description),
  );
  const daytimeEvents = context.timeline.filter(
    (e) =>
      !/\b(night|overnight|evening|midnight)\b/i.test(e.description) &&
      e.date !== null,
  );

  if (nighttimeEvents.length >= 2 && nighttimeEvents.length > daytimeEvents.length / 2) {
    patterns.push({
      pattern: "Events cluster in nighttime or evening hours",
      occurrences: nighttimeEvents.length,
      firstSeen: nighttimeEvents[0]?.date ?? null,
      lastSeen: nighttimeEvents[nighttimeEvents.length - 1]?.date ?? null,
      relatedEvents: nighttimeEvents.map((e) => e.description),
      disclaimer,
    });
  }

  return patterns;
}
