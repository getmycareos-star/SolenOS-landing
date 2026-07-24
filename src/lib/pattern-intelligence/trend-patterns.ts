import type { JourneyGraphEvent } from "../care-journey-graph/types";
import { DISCUSSION_FRAMING } from "./contract-constants";
import type { DetectedPattern, PatternConfidence } from "./types";

type TrendConcept = {
  id: string;
  label: string;
  keywords: RegExp;
  worsening: RegExp;
  improving: RegExp;
};

const TREND_CONCEPTS: TrendConcept[] = [
  {
    id: "appetite",
    label: "Appetite",
    keywords: /\b(appetite|eating|food intake|meals)\b/i,
    worsening: /\b(less|declin\w*|reduced|poor|not eating|barely)\b/i,
    improving: /\b(better|improv\w*|increased|more)\b/i,
  },
  {
    id: "weight",
    label: "Weight",
    keywords: /\b(weight|weigh\w*|lbs|kg|pounds)\b/i,
    worsening: /\b(loss|lost|declin\w*|decreas\w*|down)\b/i,
    improving: /\b(gain\w*|increas\w*|up|stable)\b/i,
  },
  {
    id: "sleep",
    label: "Sleep",
    keywords: /\b(sleep|insomnia|rest|night)\b/i,
    worsening: /\b(worse|poor|less|disrupt\w*|restless|wake\w*)\b/i,
    improving: /\b(better|improv\w*|more rest|sleeping well)\b/i,
  },
  {
    id: "mobility",
    label: "Mobility",
    keywords: /\b(mobility|walking|walker|balance|mobil\w*)\b/i,
    worsening: /\b(worse|declin\w*|reduced|limited|unable)\b/i,
    improving: /\b(better|improv\w*|independent|stronger)\b/i,
  },
  {
    id: "confusion",
    label: "Confusion",
    keywords: /\b(confus\w*|disorient\w*|memory)\b/i,
    worsening: /\b(worse|increas\w*|more|severe|significant)\b/i,
    improving: /\b(better|clear\w*|improv\w*|less)\b/i,
  },
];

function createPatternId(): string {
  return `pat_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function matchConceptEvents(events: JourneyGraphEvent[], concept: TrendConcept): JourneyGraphEvent[] {
  return events
    .filter((e) => concept.keywords.test(`${e.title} ${e.description}`))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

function trendDirection(
  matched: JourneyGraphEvent[],
  concept: TrendConcept,
): "declining" | "improving" | "mixed" | "unknown" {
  let worsening = 0;
  let improving = 0;
  for (const e of matched) {
    const text = `${e.title} ${e.description}`;
    if (concept.worsening.test(text)) worsening++;
    if (concept.improving.test(text)) improving++;
  }
  if (worsening > improving && worsening >= 2) return "declining";
  if (improving > worsening && improving >= 2) return "improving";
  if (worsening > 0 && improving > 0) return "mixed";
  if (worsening >= 2) return "declining";
  return "unknown";
}

function confidenceForTrend(pointCount: number, direction: string): PatternConfidence {
  if (pointCount >= 4 && direction !== "unknown") return "high";
  if (pointCount >= 3 && direction !== "unknown") return "medium";
  return "low";
}

/** Requires ≥ 3 data points over time. */
export function detectTrendPatterns(events: JourneyGraphEvent[]): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];

  for (const concept of TREND_CONCEPTS) {
    const matched = matchConceptEvents(events, concept);
    if (matched.length < 3) continue;

    const direction = trendDirection(matched, concept);
    if (direction === "unknown" || direction === "improving") continue;

    const trendLabel =
      direction === "declining"
        ? `${concept.label} declining trend`
        : `${concept.label} mixed trend`;

    patterns.push({
      id: createPatternId(),
      pattern_type: "trend",
      label: trendLabel,
      description: `${matched.length} recorded observations of ${concept.label.toLowerCase()} over time showing ${direction} movement.`,
      event_ids: matched.map((e) => e.id),
      confidence: confidenceForTrend(matched.length, direction),
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
