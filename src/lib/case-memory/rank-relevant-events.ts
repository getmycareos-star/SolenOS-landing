import {
  CASE_SELECTIVE_RECALL_MAX,
  CASE_STRONG_MATCH_THRESHOLD,
  CASE_WEAK_MATCH_THRESHOLD,
} from "./contract-constants";
import { findSuccessfulIntervention } from "./stores/intervention-outcome-store";
import type {
  CaseEvent,
  ExtractedCaseFacts,
  PatternMatchStrength,
  RankedCaseEvent,
  SelectiveRecallResult,
} from "./types";
import { shouldRecall } from "./should-recall";

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function scoreEvent(
  event: CaseEvent,
  facts: ExtractedCaseFacts,
  nowMs: number,
): RankedCaseEvent {
  const reasons: string[] = [];
  let score = 0;

  const currentTypes = new Set(facts.events.map((e) => e.eventType));
  const currentTags = new Set(
    facts.events.flatMap((e) => e.tags.map((t) => t.toLowerCase())),
  );

  if (currentTypes.has(event.eventType) && event.eventType !== "general") {
    score += 0.4;
    reasons.push("event_type_match");
  }

  const eventTags = new Set(event.tags.map((t) => t.toLowerCase()));
  const tagSim = jaccard(currentTags, eventTags);
  if (tagSim > 0) {
    score += 0.35 * tagSim;
    reasons.push(`tag_similarity:${tagSim.toFixed(2)}`);
  }

  const eventHour = new Date(event.timestamp).getHours();
  const nowHour = new Date(nowMs).getHours();
  const nightEvent = eventHour >= 22 || eventHour < 5 || eventTags.has("nighttime");
  const nightNow = nowHour >= 22 || nowHour < 5 || currentTags.has("nighttime");
  if (nightEvent && nightNow) {
    score += 0.15;
    reasons.push("temporal_nighttime");
  } else if (Math.abs(eventHour - nowHour) <= 2) {
    score += 0.08;
    reasons.push("temporal_hour_proximity");
  }

  if (event.outcome?.success || event.intervention?.outcome?.success) {
    score += 0.25;
    reasons.push("successful_outcome");
  } else if (event.outcome && !event.outcome.success) {
    score += 0.05;
    reasons.push("known_failed_outcome");
  }

  const ageDays = (nowMs - new Date(event.timestamp).getTime()) / (1000 * 60 * 60 * 24);
  if (ageDays >= 0 && ageDays < 30) {
    score += 0.05;
    reasons.push("recent");
  }

  if (
    currentTypes.has("wandering") &&
    /blue\s*towel|grounding/i.test(
      `${event.summary} ${event.intervention?.label ?? ""} ${event.tags.join(" ")}`,
    )
  ) {
    score += 0.2;
    reasons.push("wandering_intervention_affinity");
  }

  if (
    currentTypes.has(event.eventType) &&
    event.eventType !== "general" &&
    event.eventType !== "condition_noted"
  ) {
    score += 0.12;
    reasons.push("recurrence_candidate");
  }

  return { event, score: Math.min(1, score), reasons };
}

function classifyStrength(
  topScore: number,
  ranked: RankedCaseEvent[],
  facts: ExtractedCaseFacts,
  caseId: string | undefined,
): PatternMatchStrength {
  if (ranked.length === 0 || topScore < CASE_WEAK_MATCH_THRESHOLD) return "none";

  const primaryType = facts.events[0]?.eventType;
  const hasSameTypePrior = ranked.some(
    (r) => r.event.eventType === primaryType && primaryType !== "general",
  );
  const successful = caseId
    ? findSuccessfulIntervention({
        caseId,
        eventType: primaryType,
        tags: facts.events.flatMap((e) => e.tags),
      })
    : undefined;

  if (hasSameTypePrior && successful?.outcome?.success) {
    return "strong";
  }

  if (topScore >= CASE_STRONG_MATCH_THRESHOLD) return "strong";
  return "weak";
}

/**
 * Rank top 1–5 most relevant past events by similarity, temporal proximity, outcome relevance.
 */
export function rankRelevantEvents(params: {
  facts: ExtractedCaseFacts;
  timeline: readonly CaseEvent[];
  excludeEventIds?: ReadonlySet<string>;
  now?: Date;
  caseId?: string;
}): SelectiveRecallResult {
  const now = params.now ?? new Date();
  const decision = shouldRecall({
    facts: params.facts,
    timeline: params.timeline,
    excludeEventIds: params.excludeEventIds,
  });

  if (!decision.shouldRecall) {
    return {
      shouldRecall: false,
      triggerReasons: decision.triggerReasons,
      ranked: [],
      matchStrength: "none",
    };
  }

  const priors = params.timeline.filter((e) => !params.excludeEventIds?.has(e.id));
  const ranked = priors
    .map((e) => scoreEvent(e, params.facts, now.getTime()))
    .filter((r) => r.score >= CASE_WEAK_MATCH_THRESHOLD * 0.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, CASE_SELECTIVE_RECALL_MAX);

  const topScore = ranked[0]?.score ?? 0;
  const matchStrength = classifyStrength(topScore, ranked, params.facts, params.caseId);

  if (matchStrength === "none") {
    return {
      shouldRecall: false,
      triggerReasons: decision.triggerReasons,
      ranked: [],
      matchStrength: "none",
    };
  }

  return {
    shouldRecall: true,
    triggerReasons: decision.triggerReasons,
    ranked,
    matchStrength,
  };
}
