import type { JourneyGraphEvent, JourneyRelationship } from "../care-journey-graph/types";
import { eventTypesForConcepts } from "./concept-patterns";
import type { MemoryConcept, ParsedMemoryQuery } from "./types";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

function eventMatchesConcept(event: JourneyGraphEvent, concepts: MemoryConcept[]): boolean {
  if (concepts.length === 0) return true;

  const haystack = `${event.title} ${event.description}`.toLowerCase();
  const allowedTypes = eventTypesForConcepts(concepts);

  for (const concept of concepts) {
    const keywordMatch = concept.keywords.some((kw) => haystack.includes(kw.toLowerCase()));
    const typeMatch =
      concept.event_types.length === 0 || concept.event_types.includes(event.event_type);
    const broadTypeMatch =
      allowedTypes.length > 0 && allowedTypes.includes(event.event_type) && keywordMatch;

    if (keywordMatch && (typeMatch || concept.id === "custom")) return true;
    if (broadTypeMatch) return true;
  }

  return false;
}

export function aggregateRelevantEvents(
  events: JourneyGraphEvent[],
  parsed: ParsedMemoryQuery,
): JourneyGraphEvent[] {
  const matched = events.filter((e) => eventMatchesConcept(e, parsed.concepts));
  return [...matched].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

export function expandCausalChain(
  seedEvents: JourneyGraphEvent[],
  allEvents: JourneyGraphEvent[],
  relationships: JourneyRelationship[],
): { events: JourneyGraphEvent[]; chainNotes: string[] } {
  const ids = new Set(seedEvents.map((e) => e.id));
  const chainNotes: string[] = [];

  for (const rel of relationships) {
    const involvesSeed = ids.has(rel.from_event_id) || ids.has(rel.to_event_id);
    if (!involvesSeed) continue;

    ids.add(rel.from_event_id);
    ids.add(rel.to_event_id);

    const from = allEvents.find((e) => e.id === rel.from_event_id);
    const to = allEvents.find((e) => e.id === rel.to_event_id);
    if (from && to) {
      chainNotes.push(
        `${formatDate(from.timestamp)} ${from.title} ${rel.relationship_type.replace(/_/g, " ")} ${formatDate(to.timestamp)} ${to.title}`,
      );
    }
  }

  const expanded = allEvents.filter((e) => ids.has(e.id));
  return {
    events: [...expanded].sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
    chainNotes: [...new Set(chainNotes)],
  };
}

export function detectContinuityGaps(
  events: JourneyGraphEvent[],
  gapDays = 30,
): string[] {
  if (events.length < 2) return [];
  const gaps: string[] = [];

  for (let i = 1; i < events.length; i++) {
    const prev = events[i - 1]!;
    const curr = events[i]!;
    const days =
      (new Date(curr.timestamp).getTime() - new Date(prev.timestamp).getTime()) /
      (1000 * 60 * 60 * 24);
    if (days > gapDays) {
      gaps.push(
        `No recorded events between ${formatDate(prev.timestamp)} and ${formatDate(curr.timestamp)} (${Math.round(days)} days).`,
      );
    }
  }

  return gaps.slice(0, 3);
}

export function findCorrelatedEvents(
  primaryEvents: JourneyGraphEvent[],
  allEvents: JourneyGraphEvent[],
  relationships: JourneyRelationship[],
): string[] {
  if (primaryEvents.length === 0) return [];

  const primaryIds = new Set(primaryEvents.map((e) => e.id));
  const firstTime = primaryEvents[0]!.timestamp;
  const correlated: string[] = [];

  for (const rel of relationships) {
    const linksPrimary =
      primaryIds.has(rel.from_event_id) || primaryIds.has(rel.to_event_id);
    if (!linksPrimary) continue;

    const otherId = primaryIds.has(rel.from_event_id)
      ? rel.to_event_id
      : rel.from_event_id;
    const other = allEvents.find((e) => e.id === otherId);
    if (!other || primaryIds.has(other.id)) continue;

    if (other.timestamp <= firstTime) {
      correlated.push(
        `${formatDate(other.timestamp)}: ${other.title} (${rel.relationship_type.replace(/_/g, " ")})`,
      );
    }
  }

  for (const event of allEvents) {
    if (primaryIds.has(event.id)) continue;
    if (event.timestamp > firstTime) continue;
    if (
      ["medication_started", "medication_stopped", "diagnosis", "hospital_visit"].includes(
        event.event_type,
      ) &&
      primaryEvents.some((p) =>
        event.related_event_ids.includes(p.id) || p.related_event_ids.includes(event.id),
      )
    ) {
      correlated.push(`${formatDate(event.timestamp)}: ${event.title}`);
    }
  }

  return [...new Set(correlated)].slice(0, 5);
}

export function currentStateFromEvents(events: JourneyGraphEvent[]): string | null {
  if (events.length === 0) return null;
  const last = events[events.length - 1]!;
  return `${formatDate(last.timestamp)}: ${last.title}`;
}

export { formatDate };
