import type { CaseEvent, CaseRiskLevel, ExtractedCaseFacts } from "./types";

export type ShouldRecallParams = {
  facts: ExtractedCaseFacts;
  timeline: readonly CaseEvent[];
  /** Exclude events just written in this turn from "prior" matching. */
  excludeEventIds?: ReadonlySet<string>;
  inputRisk?: CaseRiskLevel;
};

/**
 * Selective Case Recall triggers — NOT exhaustive history dump.
 * Recall ONLY when one of the listed conditions holds.
 */
export function shouldRecall(params: ShouldRecallParams): {
  shouldRecall: boolean;
  triggerReasons: string[];
} {
  const { facts, timeline, excludeEventIds, inputRisk } = params;
  const priors = timeline.filter((e) => !excludeEventIds?.has(e.id));
  const reasons: string[] = [];

  if (priors.length === 0) {
    return { shouldRecall: false, triggerReasons: [] };
  }

  const currentTypes = new Set(facts.events.map((e) => e.eventType));
  const currentTags = new Set(facts.events.flatMap((e) => e.tags));

  // Same / similar event before
  for (const prior of priors) {
    if (currentTypes.has(prior.eventType) && prior.eventType !== "general" && prior.eventType !== "condition_noted") {
      reasons.push(`same_event_type:${prior.eventType}`);
      break;
    }
  }

  // Same symptom / behavior / condition
  for (const prior of priors) {
    if (prior.tags.some((t) => currentTags.has(t))) {
      reasons.push(`shared_tag:${prior.tags.find((t) => currentTags.has(t))}`);
      break;
    }
  }
  for (const c of facts.conditions) {
    if (priors.some((p) => p.summary.toLowerCase().includes(c.name.toLowerCase()) || p.tags.includes(c.name.toLowerCase().replace(/[^a-z0-9]+/g, "_")))) {
      reasons.push(`same_condition:${c.name}`);
      break;
    }
  }

  // Time-based recurrence (same hour / day-of-week) — soft signal when history has nighttime + current nighttime
  const now = new Date();
  const hour = now.getHours();
  const nightLike = hour >= 22 || hour < 5 || currentTags.has("nighttime") || currentTags.has("night");
  if (nightLike && priors.some((p) => p.tags.includes("nighttime") || p.tags.includes("night"))) {
    reasons.push("time_based_recurrence:nighttime");
  }
  const day = now.getDay();
  if (
    priors.some((p) => {
      const d = new Date(p.timestamp).getDay();
      return d === day && currentTypes.has(p.eventType) && p.eventType !== "general";
    })
  ) {
    reasons.push("time_based_recurrence:same_weekday");
  }

  // Risk level medium or high
  const risk =
    inputRisk ??
    facts.events.map((e) => e.riskLevel).find((r) => r === "high" || r === "medium");
  if (risk === "medium" || risk === "high") {
    reasons.push(`risk_level:${risk}`);
  }

  // Input matches prior intervention context
  const interventionLabels = facts.interventions.map((i) => i.label.toLowerCase());
  const techniqueHints = facts.interventions.map((i) => (i.technique ?? "").toLowerCase()).filter(Boolean);
  for (const prior of priors) {
    if (prior.intervention) {
      const label = prior.intervention.label.toLowerCase();
      if (
        interventionLabels.some((l) => label.includes(l) || l.includes(label)) ||
        techniqueHints.some((t) => label.includes(t)) ||
        (currentTypes.has("wandering") && /towel|grounding|redirect/i.test(label))
      ) {
        reasons.push("prior_intervention_context");
        break;
      }
    }
    if (
      currentTypes.has("wandering") &&
      prior.outcome?.success &&
      /towel|grounding|redirect/i.test(prior.summary + (prior.intervention?.label ?? ""))
    ) {
      reasons.push("prior_intervention_context");
      break;
    }
  }

  // "again" language + any overlapping type is enough with a prior of that type
  if (/\bagain\b/i.test(facts.events[0]?.summary ?? "") && reasons.some((r) => r.startsWith("same_event"))) {
    reasons.push("recurrence_language");
  }

  // Deduplicate while preserving order
  const unique = [...new Set(reasons)];

  // Risk alone without any similarity should not dump history — require at least one similarity-ish trigger OR intervention context
  const hasSimilarity = unique.some(
    (r) =>
      r.startsWith("same_event") ||
      r.startsWith("shared_tag") ||
      r.startsWith("same_condition") ||
      r.startsWith("time_based") ||
      r === "prior_intervention_context" ||
      r === "recurrence_language",
  );

  if (!hasSimilarity) {
    return { shouldRecall: false, triggerReasons: unique.filter((r) => r.startsWith("risk_level")) };
  }

  return { shouldRecall: unique.length > 0, triggerReasons: unique };
}
