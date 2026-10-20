import type { JourneyGraphEvent } from "../care-journey-graph/types";
import { DISCUSSION_FRAMING } from "./contract-constants";
import type { DetectedPattern, PatternConfidence } from "./types";

const ESCALATION_KEYWORDS = [
  { level: 1, pattern: /\b(mild|slight|a little|somewhat)\b/i },
  { level: 2, pattern: /\b(moderate|noticeable|concerning|more)\b/i },
  { level: 3, pattern: /\b(severe|significant|much worse|very|unable)\b/i },
];

const ESCALATION_CONCEPTS = [
  { id: "confusion", keywords: /\b(confus\w*|disorient\w*)\b/i, label: "Confusion" },
  { id: "pain", keywords: /\b(pain|ache|hurt)\b/i, label: "Pain" },
  { id: "mobility", keywords: /\b(mobility|walking|fall)\b/i, label: "Mobility concern" },
];

function createPatternId(): string {
  return `pat_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function escalationLevel(text: string): number {
  let max = 0;
  for (const { level, pattern } of ESCALATION_KEYWORDS) {
    if (pattern.test(text)) max = Math.max(max, level);
  }
  return max;
}

export function detectEscalationPatterns(events: JourneyGraphEvent[]): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];

  for (const concept of ESCALATION_CONCEPTS) {
    const matched = events
      .filter((e) => concept.keywords.test(`${e.title} ${e.description}`))
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    if (matched.length < 2) continue;

    const levels = matched.map((e) => escalationLevel(`${e.title} ${e.description}`));
    const hasProgression = levels.some((l, i) => i > 0 && l > levels[i - 1]! && l >= 2);

    const repeatedWorsening =
      matched.length >= 3 &&
      matched.filter((e) => /\b(worse|declin\w*|increas\w*|more)\b/i.test(e.description)).length >= 2;

    if (!hasProgression && !repeatedWorsening) continue;

    const confidence: PatternConfidence =
      matched.length >= 3 && hasProgression ? "medium" : "low";

    patterns.push({
      id: createPatternId(),
      pattern_type: "escalation",
      label: `${concept.label} escalation pattern`,
      description: `Progressive ${concept.label.toLowerCase()} observations recorded over time (${matched.length} events).`,
      event_ids: matched.map((e) => e.id),
      confidence,
      window_days: Math.ceil(
        (new Date(matched[matched.length - 1]!.timestamp).getTime() -
          new Date(matched[0]!.timestamp).getTime()) /
          (1000 * 60 * 60 * 24),
      ) || 30,
      discussion_note: DISCUSSION_FRAMING,
    });
  }

  return patterns;
}
