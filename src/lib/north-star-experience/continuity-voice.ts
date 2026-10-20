import { daysBetween } from "../continuity-decay-engine/compute-decay";
import type { CanonicalCareEvent } from "../situation-entry/types";
import { countSimilarPriorOccurrences, topicFromText } from "./detect-continuity";

export function buildContinuityRecognition(input: {
  raw_input: string;
  related_prior_events: CanonicalCareEvent[];
  all_events: CanonicalCareEvent[];
  as_of: string;
}): string | null {
  if (input.related_prior_events.length === 0) return null;

  const latestPrior = input.related_prior_events[input.related_prior_events.length - 1]!;
  const priorText = latestPrior.raw_input.slice(0, 100);
  const daysAgo = Math.round(
    daysBetween(latestPrior.ingestion_time, input.as_of || new Date().toISOString()),
  );
  const topic = topicFromText(
    `${input.raw_input} ${input.related_prior_events.map((e) => e.raw_input).join(" ")}`,
  );
  const occurrenceCount =
    countSimilarPriorOccurrences(topic, input.all_events) +
    (/\bagain|another|second\b/i.test(input.raw_input) ? 1 : 0);

  const timePhrase =
    daysAgo <= 1
      ? "earlier today"
      : daysAgo <= 7
        ? `earlier this week (${daysAgo} day${daysAgo === 1 ? "" : "s"} ago)`
        : `${daysAgo} days ago`;

  if (topic === "mobility / fall" && occurrenceCount >= 1 && /\bagain|another|second|it happened\b/i.test(input.raw_input)) {
    return `I remember the near-fall you reported ${timePhrase}. This is now the ${ordinal(Math.max(2, occurrenceCount + 1))} mobility concern in recent days, which increases attention on safety and follow-up.`;
  }

  if (topic === "medication" && /\bagain|still|refus/i.test(input.raw_input)) {
    return `I remember the medication situation from ${timePhrase}. This update continues that thread — not a new conversation.`;
  }

  if (/\bagain|still|same|it happened\b/i.test(input.raw_input)) {
    return `I remember what you shared ${timePhrase}: "${priorText}". Here is what has changed since your last update.`;
  }

  return `Continuing from your prior update (${timePhrase}): "${priorText.slice(0, 80)}".`;
}

function ordinal(n: number): string {
  const words = ["first", "second", "third", "fourth", "fifth"];
  return words[n - 1] ?? `${n}th`;
}
