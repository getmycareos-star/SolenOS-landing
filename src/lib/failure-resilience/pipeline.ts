import type { DareIngestResult } from "../data-acquisition-resilience/types";
import type { CanonicalCareEvent } from "../situation-entry/types";
import {
  buildConfidenceForEvent,
  buildConfidenceFromDare,
} from "./confidence-model";
import {
  classifyFailures,
  countOutcomes,
  deriveProcessingStatus,
} from "./classify-failures";
import { FAILURE_RESILIENCE_IDENTITY } from "./contract-constants";
import { markEventRelationshipStatus } from "./graph-linking";
import {
  enqueuePendingProcessing,
  getPendingProcessing,
} from "./processing-queue";
import { deriveRecoveryActions } from "./recovery";
import type { FailureResilienceResult } from "./types";

export { FAILURE_RESILIENCE_IDENTITY };

export function processFailureResilience(input: {
  caregiver_id: string;
  dare: DareIngestResult | null;
  events_created: CanonicalCareEvent[];
  prior_events: CanonicalCareEvent[];
  raw_input: string;
  processing_error?: string | null;
}): FailureResilienceResult {
  const failures = classifyFailures({
    dare: input.dare,
    events_created: input.events_created,
    prior_events: input.prior_events,
    raw_input: input.raw_input,
    processing_error: input.processing_error,
  });

  for (const failure of failures) {
    if (failure.category === "processing_failure" && input.dare?.raw_input.id) {
      enqueuePendingProcessing({
        caregiver_id: input.caregiver_id,
        raw_input_id: input.dare.raw_input.id,
        content_preview: input.raw_input || input.dare.raw_input.content,
        failure_category: failure.category,
        error_message: failure.not_understood[0] ?? null,
      });
    }
  }

  const confidence_summaries = [
    ...input.events_created.map(buildConfidenceForEvent),
    ...(input.dare ? buildConfidenceFromDare(input.dare) : []),
  ];

  const dedupedConfidence = confidence_summaries.filter(
    (c, i, arr) => arr.findIndex((x) => x.object_id === c.object_id) === i,
  );

  const processing_status = deriveProcessingStatus(failures, input.events_created);
  const recovery_actions = deriveRecoveryActions(failures);

  return {
    failures,
    confidence_summaries: dedupedConfidence,
    pending_processing: getPendingProcessing(input.caregiver_id),
    outcomes_applied: countOutcomes(failures),
    processing_status,
    recovery_actions,
    continuity_preserved: true,
  };
}

/** Apply relationship status markers to events affected by linking failures. */
export function applyFailureMarkersToEvents(
  events: CanonicalCareEvent[],
  failures: FailureResilienceResult["failures"],
): CanonicalCareEvent[] {
  const linkingFailures = failures.filter(
    (f) =>
      f.category === "graph_linking_failure" ||
      f.category === "ambiguous_interpretation",
  );

  if (linkingFailures.length === 0) return events;

  return events.map((event) => {
    const related = linkingFailures.find((f) => f.event_id === event.id);
    if (!related?.relationship_status) return event;
    return markEventRelationshipStatus(event, related.relationship_status);
  });
}

export function tagEventsWithProcessingStatus(
  events: CanonicalCareEvent[],
  status: FailureResilienceResult["processing_status"],
): CanonicalCareEvent[] {
  return events.map((event) => ({
    ...event,
    attributes: {
      ...event.attributes,
      processing_status: status,
    },
  }));
}
