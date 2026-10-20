import type { CanonicalCareEvent } from "../situation-entry/types";
import type { ContinuityLink, StructuredContinuityLayer } from "./types";

function createLinkId(): string {
  return `cl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Layer 2 — connect raw events into working continuity relationships. */
export function buildContinuityLinks(
  events: CanonicalCareEvent[],
  existing: ContinuityLink[] = [],
): ContinuityLink[] {
  const links = [...existing];
  const byId = new Map(events.map((e) => [e.id, e]));

  for (const event of events) {
    if (event.root_event_id && byId.has(event.root_event_id)) {
      links.push({
        id: createLinkId(),
        from_event_id: event.root_event_id,
        to_event_id: event.id,
        link_type: "follow_up",
        note: "Follow-up in chain",
        created_at: new Date().toISOString(),
      });
    }

    if (event.document_id) {
      const related = events.filter(
        (e) => e.id !== event.id && e.document_id === event.document_id,
      );
      for (const rel of related) {
        if (links.some((l) => l.from_event_id === rel.id && l.to_event_id === event.id)) continue;
        links.push({
          id: createLinkId(),
          from_event_id: rel.id,
          to_event_id: event.id,
          link_type: "document",
          note: "Same document source",
          created_at: new Date().toISOString(),
        });
      }
    }

    if (event.extracted_type === "follow_up") {
      const prior = events.find(
        (e) =>
          e.id !== event.id &&
          Math.abs(new Date(e.timestamp).getTime() - new Date(event.timestamp).getTime()) <
            14 * 86400000,
      );
      if (prior) {
        links.push({
          id: createLinkId(),
          from_event_id: prior.id,
          to_event_id: event.id,
          link_type: "decision_chain",
          note: "Decision or follow-up chain",
          created_at: new Date().toISOString(),
        });
      }
    }

    const sameType = events.filter(
      (e) =>
        e.id !== event.id &&
        e.extracted_type === event.extracted_type &&
        Math.abs(new Date(e.timestamp).getTime() - new Date(event.timestamp).getTime()) <
          30 * 86400000,
    );
    for (const rel of sameType.slice(0, 2)) {
      if (links.some((l) => l.from_event_id === rel.id && l.to_event_id === event.id)) continue;
      links.push({
        id: createLinkId(),
        from_event_id: rel.id,
        to_event_id: event.id,
        link_type: "recurring_issue",
        note: `Recurring ${event.extracted_type.replace(/_/g, " ")}`,
        created_at: new Date().toISOString(),
      });
    }
  }

  return dedupeLinks(links);
}

function dedupeLinks(links: ContinuityLink[]): ContinuityLink[] {
  const seen = new Set<string>();
  return links.filter((l) => {
    const key = `${l.from_event_id}::${l.to_event_id}::${l.link_type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildStructuredContinuityLayer(
  caregiverId: string,
  events: CanonicalCareEvent[],
  existing?: StructuredContinuityLayer,
): StructuredContinuityLayer {
  const root = events.find((e) => e.root_event_id === null) ?? events[0];
  return {
    layer: "structured_continuity",
    caregiver_id: caregiverId,
    links: buildContinuityLinks(events, existing?.links ?? []),
    root_event_id: root?.id ?? null,
    updated_at: new Date().toISOString(),
  };
}
