/**
 * Condition-aware attention weighting — extends existing priority computation.
 *
 * This module applies condition-specific weight modifiers to the existing
 * care-event-priority engine. It does NOT replace priority computation.
 *
 * Usage:
 *   import { applyConditionAttentionWeights } from "@/lib/condition-modules/attention";
 *   const weighted = applyConditionAttentionWeights(event, "dementia", baselineEvents);
 */

import type { AttentionWeightInput } from "./types";
import type { CanonicalCareEvent } from "../situation-entry/types";
import {
  getActiveAttentionWeights,
  getActiveVocabularyRules,
} from "./registry";

export function applyConditionAttentionWeights(
  event: CanonicalCareEvent,
  careContext: "general" | "dementia" | "future_condition",
  baselineEvents: CanonicalCareEvent[] = [],
): AttentionWeightInput {
  const weights = getActiveAttentionWeights(careContext);
  const vocabulary = getActiveVocabularyRules(careContext);

  let urgency_delta = 0;
  let uncertainty_delta = 0;
  let attention_multiplier = 1.0;

  const domain = inferDomainFromEvent(event, vocabulary);

  for (const rule of weights) {
    if (rule.domain !== domain) continue;

    if (rule.condition) {
      const conditionMet = evaluateAttentionCondition(rule.condition, event, baselineEvents);
      if (!conditionMet) continue;
    }

    urgency_delta += rule.urgency_delta;
    uncertainty_delta += rule.uncertainty_delta;
    attention_multiplier *= rule.attention_multiplier;
  }

  return {
    urgency_delta,
    uncertainty_delta,
    attention_multiplier: Math.min(2.0, Math.max(0.5, attention_multiplier)),
  };
}

function inferDomainFromEvent(
  event: CanonicalCareEvent,
  vocabulary: ReturnType<typeof getActiveVocabularyRules>,
): string {
  const text = `${event.raw_input} ${event.extracted_type}`.toLowerCase();

  for (const rule of vocabulary) {
    for (const pattern of rule.patterns) {
      if (pattern.test(text)) {
        return rule.domain ?? "observation";
      }
    }
  }

  const type = event.extracted_type;
  if (type === "incident") return "safety";
  if (type === "behavioral_change") return "behavior";
  if (type === "financial_issue") return "care_system";

  return "observation";
}

function evaluateAttentionCondition(
  condition: string,
  event: CanonicalCareEvent,
  baselineEvents: CanonicalCareEvent[],
): boolean {
  switch (condition) {
    case "new":
      return !baselineEvents.some(
        (b) =>
          b.extracted_type === event.extracted_type &&
          b.raw_input.toLowerCase() === event.raw_input.toLowerCase(),
      );

    case "escalating":
      return isEscalating(event, baselineEvents);

    case "materially_different":
      return isMateriallyDifferent(event, baselineEvents);

    case "safety_associated":
      return event.extracted_type === "incident"
        || /fall|wander|medication|stove|lost|unsafe/i.test(event.raw_input);

    default:
      return true;
  }
}

function isEscalating(event: CanonicalCareEvent, baselineEvents: CanonicalCareEvent[]): boolean {
  const sameType = baselineEvents.filter((b) => b.extracted_type === event.extracted_type);
  if (sameType.length === 0) return true;

  const recentCount = sameType.filter((b) => {
    const eventTime = new Date(event.timestamp).getTime();
    const baseTime = new Date(b.timestamp).getTime();
    const daysDiff = (eventTime - baseTime) / (1000 * 60 * 60 * 24);
    return daysDiff >= 0 && daysDiff <= 7;
  }).length;

  return recentCount >= 2;
}

function isMateriallyDifferent(event: CanonicalCareEvent, baselineEvents: CanonicalCareEvent[]): boolean {
  const similar = baselineEvents.filter(
    (b) =>
      b.extracted_type === event.extracted_type &&
      b.raw_input.toLowerCase().includes(event.raw_input.toLowerCase().slice(0, 20)),
  );

  if (similar.length === 0) return true;

  const lastSimilar = similar.reduce((a, b) =>
    new Date(a.timestamp).getTime() > new Date(b.timestamp).getTime() ? a : b,
  );

  const eventTime = new Date(event.timestamp).getTime();
  const lastTime = new Date(lastSimilar.timestamp).getTime();
  const daysDiff = (eventTime - lastTime) / (1000 * 60 * 60 * 24);

  return daysDiff >= 14;
}
