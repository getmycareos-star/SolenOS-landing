import type { CanonicalCareEvent } from "../situation-entry/types";
import type { DareIngestResult } from "../data-acquisition-resilience/types";
import type { ContinuityLink } from "../care-memory-layers/types";
import type {
  EnrichmentAction,
  EntityMatch,
  EventMatch,
  ResolvedUncertainty,
} from "./types";

function createActionId(): string {
  return `ea_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function createResolutionId(): string {
  return `ru_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

const MOBILITY_PATTERNS = [
  /\bmobility\b/i,
  /\bdeclin(e|ing)\b/i,
  /\bwalking\b/i,
  /\bfell?\b/i,
];

export function attemptUncertaintyResolution(input: {
  newEvents: CanonicalCareEvent[];
  priorUnresolvedQuestions: string[];
  priorEvents: CanonicalCareEvent[];
  existingResolutions: ResolvedUncertainty[];
}): ResolvedUncertainty[] {
  const resolved: ResolvedUncertainty[] = [];
  const alreadyResolved = new Set(input.existingResolutions.map((r) => r.question.toLowerCase()));

  for (const question of input.priorUnresolvedQuestions) {
    if (alreadyResolved.has(question.toLowerCase())) continue;

    for (const event of input.newEvents) {
      const combined = `${event.raw_input} ${event.entities.map((e) => e.label).join(" ")}`;

      if (/mobility|declin|walking/i.test(question) && MOBILITY_PATTERNS.some((p) => p.test(combined))) {
        const dateMatch = event.raw_input.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december|\d{1,2}\/\d{1,2}|\d{4}-\d{2}-\d{2})/i);
        resolved.push({
          id: createResolutionId(),
          question,
          resolution: dateMatch
            ? `Mobility decline context recorded — approximately ${dateMatch[0]}`
            : event.raw_input.slice(0, 120),
          resolved_by_event_id: event.id,
          resolved_at: new Date().toISOString(),
        });
        break;
      }

      if (/when|what time|what date/i.test(question)) {
        if (event.event_time.type === "exact" || event.event_time.type === "approximate") {
          resolved.push({
            id: createResolutionId(),
            question,
            resolution: `Timing clarified: ${event.event_time.start ?? event.timestamp}`,
            resolved_by_event_id: event.id,
            resolved_at: new Date().toISOString(),
          });
          break;
        }
      }

      if (/who|which person/i.test(question)) {
        if (event.entities.some((e) => e.kind === "person")) {
          const person = event.entities.find((e) => e.kind === "person")!;
          resolved.push({
            id: createResolutionId(),
            question,
            resolution: `Person identified: ${person.label}`,
            resolved_by_event_id: event.id,
            resolved_at: new Date().toISOString(),
          });
          break;
        }
      }
    }
  }

  return resolved;
}

export function buildEnrichmentActions(input: {
  newEvents: CanonicalCareEvent[];
  entityMatches: EntityMatch[];
  eventMatches: EventMatch[];
  resolvedUncertainties: ResolvedUncertainty[];
  continuityLinks: ContinuityLink[];
  dare: DareIngestResult | null;
}): EnrichmentAction[] {
  const actions: EnrichmentAction[] = [];
  const now = new Date().toISOString();

  for (const match of input.eventMatches) {
    actions.push({
      id: createActionId(),
      action_type: "link_to_existing_event",
      description: match.match_reason,
      target_event_id: match.existing_event_id,
      source_event_id: match.new_event_id,
      created_at: now,
    });
  }

  for (const entity of input.entityMatches.filter((e) => !e.is_new && e.matched_event_ids.length > 0)) {
    actions.push({
      id: createActionId(),
      action_type: "enrich_entity",
      description: `Entity "${entity.entity_label}" linked to ${entity.matched_event_ids.length} existing event(s)`,
      target_event_id: entity.matched_event_ids[0] ?? null,
      source_event_id: null,
      created_at: now,
    });
  }

  for (const resolution of input.resolvedUncertainties) {
    actions.push({
      id: createActionId(),
      action_type: "resolve_uncertainty",
      description: `Resolved: ${resolution.question.slice(0, 60)} → ${resolution.resolution.slice(0, 60)}`,
      target_event_id: resolution.resolved_by_event_id,
      source_event_id: null,
      created_at: now,
    });
  }

  for (const link of input.continuityLinks.slice(-5)) {
    actions.push({
      id: createActionId(),
      action_type: "strengthen_relationship",
      description: `${link.link_type.replace(/_/g, " ")}: ${link.note}`,
      target_event_id: link.to_event_id,
      source_event_id: link.from_event_id,
      created_at: now,
    });
  }

  for (const event of input.newEvents) {
    if (event.event_time.type !== "unknown") {
      actions.push({
        id: createActionId(),
        action_type: "update_timeline",
        description: `Timeline updated with ${event.extracted_type.replace(/_/g, " ")}`,
        target_event_id: event.id,
        source_event_id: null,
        created_at: now,
      });
    }
  }

  const followUpEvents = input.newEvents.filter((e) => e.extracted_type === "follow_up");
  for (const fu of followUpEvents) {
    const linked = input.eventMatches.find((m) => m.new_event_id === fu.id);
    if (linked) {
      actions.push({
        id: createActionId(),
        action_type: "close_follow_up",
        description: `Follow-up connected to prior event`,
        target_event_id: linked.existing_event_id,
        source_event_id: fu.id,
        created_at: now,
      });
    }
  }

  const seen = new Set<string>();
  return actions.filter((a) => {
    const key = `${a.action_type}:${a.description}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function countNewRelationships(continuityLinks: ContinuityLink[], priorLinkCount: number): number {
  return Math.max(0, continuityLinks.length - priorLinkCount);
}
