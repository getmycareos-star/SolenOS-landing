import {
  BASELINE_MIN_OBSERVATIONS,
  BASELINE_PATTERNS,
} from "./contract-constants";
import type { BaselineDomain, BaselineFact, BaselineDeviation } from "./types";
import type { CanonicalCareEvent } from "../situation-entry/types";

function domainForText(text: string): BaselineDomain | null {
  for (const { domain, pattern } of BASELINE_PATTERNS) {
    if (pattern.test(text)) return domain;
  }
  return null;
}

function confidenceFromCount(count: number): BaselineFact["confidence"] {
  if (count >= 5) return "high";
  if (count >= BASELINE_MIN_OBSERVATIONS) return "medium";
  return "low";
}

export function computeDomainTrajectory(
  domainEvents: { raw_input: string; timestamp: string }[],
): "stable" | "worsening" | "improving" | "unknown" {
  if (domainEvents.length < 2) return "unknown";
  const recent = domainEvents.slice(-3);
  const worseningCount = recent.filter((e) => /\b(worse|worsening|declin|less|reduced|not eating|not sleeping|more confused|more agitated)\b/i.test(e.raw_input)).length;
  const improvingCount = recent.filter((e) => /\b(better|improved|improving|recovering|calmer|eating better|sleeping better|back to normal)\b/i.test(e.raw_input)).length;
  if (worseningCount > improvingCount && worseningCount >= 2) return "worsening";
  if (improvingCount > worseningCount && improvingCount >= 2) return "improving";
  return "stable";
}

export function computeRecencyWeight(timestamp: string, now: Date): number {
  const observed = new Date(timestamp);
  const diffMs = now.getTime() - observed.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays <= 1) return 1.0;
  if (diffDays <= 7) return 0.8;
  if (diffDays <= 30) return 0.5;
  return 0.3;
}

export function deriveBaselineFacts(
  events: CanonicalCareEvent[],
  excludeEventIds: Set<string> = new Set(),
): BaselineFact[] {
  const byDomain = new Map<
    BaselineDomain,
    { labels: string[]; eventIds: string[]; timestamps: string[] }
  >();

  for (const event of events) {
    if (excludeEventIds.has(event.id)) continue;
    if (event.status === "invalidated" || event.status === "superseded") continue;

    const domain = domainForText(event.raw_input);
    if (!domain) continue;

    const entry = byDomain.get(domain) ?? { labels: [], eventIds: [], timestamps: [] };
    entry.labels.push(event.raw_input.slice(0, 120));
    entry.eventIds.push(event.id);
    entry.timestamps.push(event.ingestion_time);
    byDomain.set(domain, entry);
  }

  const facts: BaselineFact[] = [];
  const now = new Date();
  for (const [domain, data] of byDomain) {
    if (data.eventIds.length < BASELINE_MIN_OBSERVATIONS) continue;
    const sorted = [...data.timestamps].sort();
    const domainEvents = data.timestamps
      .map((ts, i) => ({ raw_input: data.labels[i], timestamp: ts }))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    facts.push({
      domain,
      label: `Established ${domain.replace(/_/g, " ")} pattern from ${data.eventIds.length} observations`,
      source_event_ids: [...new Set(data.eventIds)],
      first_observed_at: sorted[0]!,
      last_observed_at: sorted[sorted.length - 1]!,
      observation_count: data.eventIds.length,
      confidence: confidenceFromCount(data.eventIds.length),
      trajectory: computeDomainTrajectory(domainEvents),
      recency_weight: computeRecencyWeight(sorted[sorted.length - 1]!, now),
    });
  }

  return facts;
}

export function detectDeviations(input: {
  baseline_facts: BaselineFact[];
  events_created: CanonicalCareEvent[];
  all_events: CanonicalCareEvent[];
}): import("./types").BaselineDeviation[] {
  const deviations: import("./types").BaselineDeviation[] = [];
  const baselineDomains = new Set(input.baseline_facts.map((f) => f.domain));
  const deviationType = (fact: BaselineFact, eventText: string): "escalation" | "improvement" | "pattern_shift" => {
    const worsening = /\b(worse|worsening|declin|less|reduced|not eating|not sleeping|more confused|more agitated)\b/i.test(eventText);
    const improving = /\b(better|improved|improving|recovering|calmer|eating better|sleeping better|back to normal)\b/i.test(eventText);
    if (worsening && !improving) return "escalation";
    if (improving && !worsening) return "improvement";
    return "pattern_shift";
  };

  for (const event of input.events_created) {
    const domain = domainForText(event.raw_input);
    if (!domain) continue;

    const baseline = input.baseline_facts.find((f) => f.domain === domain);
    const priorSameDomain = input.all_events.filter(
      (e) =>
        e.id !== event.id &&
        e.status !== "invalidated" &&
        e.status !== "superseded" &&
        domainForText(e.raw_input) === domain,
    );

    if (!baseline && priorSameDomain.length === 0) {
      deviations.push({
        domain,
        observation: event.raw_input.slice(0, 150),
        deviation_type: "new",
        compared_to_baseline: "Not previously recorded for this person",
        source_event_id: event.id,
        is_unusual_for_person: true,
        confidence: "medium",
        deviation_direction: "unknown",
      });
      continue;
    }

    if (baseline) {
      const deviationDirection = deviationType(baseline, event.raw_input);
      deviations.push({
        domain,
        observation: event.raw_input.slice(0, 150),
        deviation_type: deviationDirection,
        compared_to_baseline: baseline.label,
        source_event_id: event.id,
        is_unusual_for_person: deviationDirection === "escalation" || !baselineDomains.has(domain),
        confidence: baseline.confidence === "high" ? "high" : "medium",
        deviation_direction: deviationDirection === "improvement" ? "improvement" : deviationDirection === "escalation" ? "escalation" : "unknown",
      });
    }
  }

  return deviations;
}
