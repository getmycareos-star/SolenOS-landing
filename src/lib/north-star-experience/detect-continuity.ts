import type { CanonicalCareEvent } from "../situation-entry/types";
import { CONTINUATION_PHRASES } from "./contract-constants";

const EVENT_TOPIC_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /\b(near.?fall|almost fell|nearly fell|fell|fall)\b/i, label: "mobility / fall" },
  { pattern: /\b(medication|med|pill|refus\w*.*med)\b/i, label: "medication" },
  { pattern: /\b(sleep|night|insomnia|wander)\b/i, label: "sleep" },
  { pattern: /\b(eat|appetite|food|drink|hydrat)\b/i, label: "eating / hydration" },
  { pattern: /\b(agitat|anxious|confus|wander)\b/i, label: "behavior" },
  { pattern: /\b(hospital|discharge|er\b|emergency)\b/i, label: "hospital / discharge" },
];

export function inputSignalsContinuation(rawInput: string): boolean {
  return CONTINUATION_PHRASES.some((p) => p.test(rawInput));
}

export function topicFromText(text: string): string | null {
  for (const { pattern, label } of EVENT_TOPIC_PATTERNS) {
    if (pattern.test(text)) return label;
  }
  return null;
}

export function findRelatedPriorEvents(input: {
  raw_input: string;
  events_created: CanonicalCareEvent[];
  all_events: CanonicalCareEvent[];
  prior_event_count: number;
}): CanonicalCareEvent[] {
  if (input.prior_event_count <= 0) return [];

  const priorEvents = input.all_events.slice(0, input.prior_event_count);
  const combinedNewText = [
    input.raw_input,
    ...input.events_created.map((e) => e.raw_input),
    ...input.events_created.map((e) => String(e.attributes.source_situation_text ?? "")),
  ].join(" ");

  const newTopic = topicFromText(combinedNewText);
  const signalsContinuation = inputSignalsContinuation(input.raw_input);

  const related = priorEvents.filter((e) => {
    if (e.status === "invalidated" || e.status === "superseded") return false;
    const priorText = `${e.raw_input} ${e.attributes.source_situation_text ?? ""}`;
    if (newTopic && topicFromText(priorText) === newTopic) return true;
    if (signalsContinuation && e.extracted_type === input.events_created[0]?.extracted_type) {
      return true;
    }
    return false;
  });

  if (related.length > 0) return related.slice(-5);

  if (signalsContinuation && priorEvents.length > 0) {
    const fallPrior = priorEvents.filter(
      (e) => topicFromText(`${e.raw_input} ${e.attributes.source_situation_text ?? ""}`) === "mobility / fall",
    );
    if (fallPrior.length > 0) return fallPrior.slice(-3);
    return priorEvents.slice(-1);
  }

  return [];
}

export function countSimilarPriorOccurrences(
  topic: string | null,
  priorEvents: CanonicalCareEvent[],
): number {
  if (!topic) return 0;
  return priorEvents.filter((e) => {
    const text = `${e.raw_input} ${e.attributes.source_situation_text ?? ""}`;
    return topicFromText(text) === topic;
  }).length;
}
