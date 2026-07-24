import { runDecisionGate } from "../risk-uncertainty-engine/decision-gate";
import { assessContinuity } from "./continuity-assess";
import { detectRelationships, relatedEventIds } from "./detect-relationships";
import {
  addEventToGraph,
  createGraphEventId,
  getOrCreateGraph,
} from "./graph-store";
import { trySaveGraphEvent } from "./postgres-store";
import { extractPipelineFacts, structureJourneyEvent } from "./structure-event";
import type { CareJourneyPipelineResult, IngestJourneyInputParams } from "./types";

/**
 * Mandatory Care Journey pipeline — update graph before reasoning.
 *
 * Caregiver Input → Extract Facts → Classify → Completeness →
 * Detect Relationships → Link Events → Update Graph → Assess Continuity
 */
export function processCareJourneyInput(
  input: IngestJourneyInputParams,
): CareJourneyPipelineResult {
  const caregiverId = input.caregiver_id ?? "default_caregiver";
  const caseId = input.case_id ?? null;

  const { facts_only_summary, completeness_status, missing_signals } = extractPipelineFacts(
    input.description,
  );

  const gate = runDecisionGate(completeness_status);
  const reasoning_ready = !gate.blocked;

  const graph = getOrCreateGraph(caregiverId, caseId);
  const eventId = createGraphEventId();

  const openQuestions = missing_signals.map((m) => `Can you clarify: ${m}?`).slice(0, 5);

  const draftEvent = structureJourneyEvent({
    input,
    journey_id: graph.journey_id,
    event_id: eventId,
    open_questions: openQuestions,
  });

  const relationships = detectRelationships(draftEvent, graph.events);
  const relatedIds = relatedEventIds(relationships, eventId);

  const event = structureJourneyEvent({
    input,
    journey_id: graph.journey_id,
    event_id: eventId,
    related_event_ids: relatedIds,
    open_questions: openQuestions,
  });

  const updatedGraph = addEventToGraph(graph, event, relationships);

  const continuity = assessContinuity({
    newEvent: event,
    priorEvents: graph.events,
    relationships,
    completeness_status,
    missing_signals,
  });

  return {
    graph: updatedGraph,
    event,
    new_relationships: relationships,
    continuity,
    completeness_status,
    facts_only_summary,
    reasoning_ready,
  };
}

/** Persist graph event to Postgres when DATABASE_URL is set (non-blocking for callers). */
export async function processCareJourneyInputAsync(
  input: IngestJourneyInputParams,
): Promise<CareJourneyPipelineResult> {
  const result = processCareJourneyInput(input);
  await trySaveGraphEvent(result.event, result.new_relationships);
  return result;
}

export function getCareJourneyGraphForCaregiver(
  caregiverId: string,
  caseId: string | null = null,
) {
  return getOrCreateGraph(caregiverId, caseId);
}
