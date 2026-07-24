import {
  BASELINE_MIN_OBSERVATIONS,
  BASELINE_PATTERNS,
} from "./contract-constants";
import type { BaselineDomain, BaselineFact } from "./types";
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
  for (const [domain, data] of byDomain) {
    if (data.eventIds.length < BASELINE_MIN_OBSERVATIONS) continue;
    const sorted = [...data.timestamps].sort();
    facts.push({
      domain,
      label: `Established ${domain.replace(/_/g, " ")} pattern from ${data.eventIds.length} observations`,
      source_event_ids: [...new Set(data.eventIds)],
      first_observed_at: sorted[0]!,
      last_observed_at: sorted[sorted.length - 1]!,
      observation_count: data.eventIds.length,
      confidence: confidenceFromCount(data.eventIds.length),
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
      });
      continue;
    }

    if (baseline) {
      const isEscalation = /\b(worse|more|increased|refus|again today|every \d+ minutes)\b/i.test(
        event.raw_input,
      );
      deviations.push({
        domain,
        observation: event.raw_input.slice(0, 150),
        deviation_type: isEscalation ? "escalation" : "pattern_shift",
        compared_to_baseline: baseline.label,
        source_event_id: event.id,
        is_unusual_for_person: isEscalation || !baselineDomains.has(domain),
        confidence: baseline.confidence === "high" ? "high" : "medium",
      });
    }
  }

  return deviations;
}
