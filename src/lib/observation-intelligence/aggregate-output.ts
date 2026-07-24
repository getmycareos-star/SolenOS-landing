import { OBSERVATION_FORBIDDEN_OUTPUT } from "./contract-constants";
import type { ExtractionResult } from "./extract-observation";
import type { ObservationCategory } from "./ontology";
import {
  findIncreasingTrends,
  summarizeCategoryTrends,
  type SignalTrend,
} from "./pattern-tracking";
import type { StructuredObservationRecord } from "./stores/observation-store";
import { generateWeeklySummary } from "./weekly-summary";
import type { OBSERVATION_RISK_LEVELS } from "./contract-constants";

export type ObservationRiskLevel = (typeof OBSERVATION_RISK_LEVELS)[number];

export type SystemAggregation = {
  what_is_happening: string;
  what_matters_now: string;
  what_to_ask_next: string;
  risk_level: ObservationRiskLevel;
  what_can_wait: string;
  follow_up_items: string[];
};

const FOLLOW_UP_BY_CATEGORY: Partial<Record<ObservationCategory, string>> = {
  memory: "When did repeated questioning or forgetting first become noticeable?",
  orientation: "Has getting lost or confusion about place/time happened before?",
  behavior: "Was anyone present when wandering or unsafe behavior occurred?",
  daily_function: "Are medication or daily tasks being supervised consistently?",
  mood: "How long has the mood change been present — days or weeks?",
  communication: "Is word-finding or comprehension difficulty new or worsening?",
};

/**
 * Build caregiver-facing aggregation from latest extraction + historical patterns.
 */
export function buildSystemAggregation(
  extraction: ExtractionResult,
  history: StructuredObservationRecord[],
  now = new Date(),
): SystemAggregation {
  const weekly = generateWeeklySummary(history, 4, now);
  const increasing = findIncreasingTrends(weekly.signalTrends);
  const categoryTrends = summarizeCategoryTrends(history, now);

  const latestSignals = extraction.structured.map((s) => s.signal.replace(/_/g, " "));
  const what_is_happening = buildWhatIsHappening(latestSignals, weekly.trendSnippets);
  const what_matters_now = buildWhatMattersNow(extraction, increasing);
  const risk_level = computeRiskLevel(extraction, increasing);
  const what_to_ask_next = buildWhatToAskNext(extraction, categoryTrends);
  const what_can_wait = buildWhatCanWait(extraction, risk_level);
  const follow_up_items = buildFollowUpItems(extraction, increasing);

  const output: SystemAggregation = {
    what_is_happening,
    what_matters_now,
    what_to_ask_next,
    risk_level,
    what_can_wait,
    follow_up_items,
  };

  assertNoForbiddenLanguage(output);
  return output;
}

function buildWhatIsHappening(signals: string[], snippets: string[]): string {
  if (signals.length === 0 && snippets.length === 0) {
    return "No specific observation signals detected in this entry.";
  }

  const parts: string[] = [];
  if (signals.length > 0) {
    parts.push(`Caregiver reported: ${signals.join(", ")}`);
  }
  if (snippets.length > 0) {
    parts.push(snippets[0]!);
  }
  return parts.join(". ");
}

function buildWhatMattersNow(
  extraction: ExtractionResult,
  increasing: SignalTrend[],
): string {
  if (extraction.supervisionRequired) {
    return "Supervision and safety monitoring appear important based on this observation.";
  }

  const highSeverity = extraction.structured.filter((s) => s.severity === "high");
  if (highSeverity.length > 0) {
    const signals = highSeverity.map((s) => s.signal.replace(/_/g, " ")).join(", ");
    return `Elevated concern noted for: ${signals}. Pattern frequency should be tracked.`;
  }

  if (increasing.length > 0) {
    const signal = increasing[0]!.signal.replace(/_/g, " ");
    return `Increase in ${signal} observed over recent weeks — worth noting for care team discussion.`;
  }

  if (extraction.structured.length > 0) {
    return "Continue recording observations to reveal patterns over time.";
  }

  return "Add more specific behavioral observations to improve pattern tracking.";
}

function computeRiskLevel(
  extraction: ExtractionResult,
  increasing: SignalTrend[],
): ObservationRiskLevel {
  if (extraction.supervisionRequired || extraction.safetyRisk) return "high";

  const hasHigh = extraction.structured.some((s) => s.severity === "high");
  if (hasHigh) return "high";

  const hasMedium = extraction.structured.some((s) => s.severity === "medium");
  const hasIncreasing = increasing.length > 0;

  if (hasMedium && hasIncreasing) return "medium";
  if (hasMedium || hasIncreasing) return "medium";

  return "low";
}

function buildWhatToAskNext(
  extraction: ExtractionResult,
  categoryTrends: ReturnType<typeof summarizeCategoryTrends>,
): string {
  const categories = extraction.structured.map((s) => s.category);
  const increasingCats = categoryTrends.filter((c) => c.direction === "increasing");

  for (const cat of [...categories, ...increasingCats.map((c) => c.category)]) {
    const question = FOLLOW_UP_BY_CATEGORY[cat];
    if (question) return question;
  }

  return "What changed today compared to a typical day last month?";
}

function buildWhatCanWait(extraction: ExtractionResult, risk: ObservationRiskLevel): string {
  if (risk === "high") {
    return "Non-urgent documentation can wait until immediate safety is addressed.";
  }
  if (extraction.structured.every((s) => s.severity === "low")) {
    return "Routine scheduling and non-safety tasks can wait while patterns are tracked.";
  }
  return "Detailed care planning discussions can wait until more observations are recorded.";
}

function buildFollowUpItems(
  extraction: ExtractionResult,
  increasing: SignalTrend[],
): string[] {
  const items: string[] = [];

  if (extraction.supervisionRequired) {
    items.push("Note whether supervision was available when the behavior occurred");
  }

  if (extraction.frequency !== undefined && extraction.frequency >= 2) {
    items.push(`Track frequency — caregiver reported ${extraction.frequency} occurrence(s)`);
  }

  for (const trend of increasing.slice(0, 2)) {
    items.push(`Monitor ${trend.signal.replace(/_/g, " ")} frequency over the next week`);
  }

  const categories = new Set(extraction.structured.map((s) => s.category));
  for (const cat of categories) {
    const item = FOLLOW_UP_BY_CATEGORY[cat];
    if (item && !items.includes(item)) items.push(item);
  }

  return items.slice(0, 5);
}

/** Guard against forbidden medical/diagnostic language in outputs. */
export function containsForbiddenLanguage(text: string): boolean {
  const lower = text.toLowerCase();
  return OBSERVATION_FORBIDDEN_OUTPUT.some((phrase) => lower.includes(phrase.toLowerCase()));
}

export function assertNoForbiddenLanguage(aggregation: SystemAggregation): void {
  const fields = [
    aggregation.what_is_happening,
    aggregation.what_matters_now,
    aggregation.what_to_ask_next,
    aggregation.what_can_wait,
    ...aggregation.follow_up_items,
  ];

  for (const field of fields) {
    if (containsForbiddenLanguage(field)) {
      throw new Error(`Forbidden language detected in aggregation output: ${field}`);
    }
  }
}

export function sanitizeAggregationText(text: string): string {
  let result = text;
  for (const forbidden of OBSERVATION_FORBIDDEN_OUTPUT) {
    const re = new RegExp(forbidden, "gi");
    result = result.replace(re, "[observation pattern]");
  }
  return result;
}
