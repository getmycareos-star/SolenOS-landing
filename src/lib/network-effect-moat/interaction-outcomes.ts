import type { CanonicalCareEvent } from "../situation-entry/types";
import type {
  EnrichmentAction,
  EntityMatch,
  EventMatch,
  InteractionOutcome,
  ResolvedUncertainty,
} from "./types";

export function deriveInteractionOutcomes(input: {
  newEvents: CanonicalCareEvent[];
  eventMatches: EventMatch[];
  entityMatches: EntityMatch[];
  resolvedUncertainties: ResolvedUncertainty[];
  enrichmentActions: EnrichmentAction[];
  whatChanged: string[];
}): InteractionOutcome[] {
  const outcomes: InteractionOutcome[] = [];
  const now = new Date().toISOString();

  for (const event of input.newEvents) {
    const refined = input.eventMatches.some((m) => m.new_event_id === event.id);
    outcomes.push({
      outcome_type: refined ? "refined_care_event" : "new_care_event",
      description: refined
        ? `Refined existing context: ${event.raw_input.slice(0, 60)}`
        : `New CareEvent: ${event.extracted_type.replace(/_/g, " ")}`,
      event_id: event.id,
      created_at: now,
    });
  }

  for (const resolution of input.resolvedUncertainties) {
    outcomes.push({
      outcome_type: "resolved_uncertainty",
      description: resolution.resolution,
      event_id: resolution.resolved_by_event_id,
      created_at: now,
    });
  }

  for (const action of input.enrichmentActions) {
    if (action.action_type === "strengthen_relationship") {
      outcomes.push({
        outcome_type: "new_relationship",
        description: action.description,
        event_id: action.target_event_id,
        created_at: now,
      });
    }
    if (action.action_type === "close_follow_up") {
      outcomes.push({
        outcome_type: "completed_follow_up",
        description: action.description,
        event_id: action.source_event_id,
        created_at: now,
      });
    }
    if (action.action_type === "update_timeline") {
      outcomes.push({
        outcome_type: "updated_timeline",
        description: action.description,
        event_id: action.target_event_id,
        created_at: now,
      });
    }
  }

  for (const entity of input.entityMatches.filter((e) => e.is_new)) {
    outcomes.push({
      outcome_type: "new_entity",
      description: `New entity: ${entity.entity_label} (${entity.entity_kind})`,
      event_id: null,
      created_at: now,
    });
  }

  if (outcomes.length === 0 && input.whatChanged.length > 0) {
    outcomes.push({
      outcome_type: "updated_timeline",
      description: input.whatChanged[0]!,
      event_id: null,
      created_at: now,
    });
  }

  const seen = new Set<string>();
  return outcomes.filter((o) => {
    const key = `${o.outcome_type}:${o.description}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function assertContextGrew(outcomes: InteractionOutcome[]): boolean {
  return outcomes.length > 0;
}

export function countIsolatedRecords(
  newEvents: CanonicalCareEvent[],
  eventMatches: EventMatch[],
  enrichmentActions: EnrichmentAction[],
): number {
  let isolated = 0;
  for (const event of newEvents) {
    const linked =
      eventMatches.some((m) => m.new_event_id === event.id) ||
      enrichmentActions.some(
        (a) => a.source_event_id === event.id || a.target_event_id === event.id,
      ) ||
      event.root_event_id !== null ||
      event.entities.length > 0;
    if (!linked) isolated += 1;
  }
  return isolated;
}
