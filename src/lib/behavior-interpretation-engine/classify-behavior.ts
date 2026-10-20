import type { CanonicalCareEvent } from "../situation-entry/types";
import { matchBehaviorTaxonomy } from "./taxonomy";
import type { ObservedBehavior } from "./types";

function eventTextForClassification(event: CanonicalCareEvent): string {
  const attrText = Object.values(event.attributes)
    .flatMap((v) => (typeof v === "string" ? [v] : Array.isArray(v) ? v.filter((x) => typeof x === "string") : []))
    .join(" ");
  const entities = event.entities.map((e) => e.label).join(" ");
  return `${event.raw_input} ${entities} ${attrText}`.trim();
}

export function classifyObservedBehaviors(events: CanonicalCareEvent[]): ObservedBehavior[] {
  const observed: ObservedBehavior[] = [];

  for (const event of events) {
    if (event.status === "invalidated" || event.status === "superseded") continue;
    const text = eventTextForClassification(event);
    const sourceSnippet = event.attributes.source_situation_text;
    const combined =
      typeof sourceSnippet === "string" ? `${text} ${sourceSnippet}` : text;
    const matches = matchBehaviorTaxonomy(combined);
    for (const entry of matches) {
      observed.push({
        behavior_id: entry.id,
        label: entry.label,
        group: entry.group,
        source_event_id: event.id,
        observed_at: event.ingestion_time,
        raw_observation: event.raw_input.slice(0, 200),
      });
    }
  }

  const seen = new Set<string>();
  return observed.filter((o) => {
    const key = `${o.behavior_id}:${o.source_event_id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function detectBehavioralChange(
  observed: ObservedBehavior[],
  priorEvents: CanonicalCareEvent[],
): boolean {
  if (observed.length === 0) return false;

  for (const behavior of observed) {
    const priorSameGroup = priorEvents.filter((e) => {
      const priorMatches = matchBehaviorTaxonomy(eventTextForClassification(e));
      return priorMatches.some((m) => m.id === behavior.behavior_id);
    });
    if (priorSameGroup.length === 0 && behavior.group === "medication") {
      return true;
    }
  }

  const priorMedAdherence = priorEvents.some((e) =>
    /\b(took|given|medication\s+on\s+time)\b/i.test(e.raw_input),
  );
  const nowRefusal = observed.some((b) => b.behavior_id === "refuses_medication");
  return priorMedAdherence && nowRefusal;
}
