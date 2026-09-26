import {
  EVENT_IDENTITY_RESOLUTIONS,
  EVENT_IDENTITY_FAILURE_LABELS,
  EVIDENCE_RELATIONS,
  IDENTITY_CONFIDENCE,
} from "./contract-constants";
import type {
  IncomingEvidence,
  ExistingEvent,
  IdentityResolutionResult,
  BatchIdentityResolution,
  EventIdentityContext,
} from "./types";
import { detectExactDuplicates } from "./detect-exact-duplicates";
import { detectSemanticSameEvent } from "./detect-semantic-same";
import { detectGenuinelySeparateEvents } from "./detect-separate-events";
import { detectRepeatedObservations } from "./detect-repeated-observations";
import { detectDocumentVersions } from "./detect-document-versions";
import { detectDuplicateVsUpdate } from "./detect-duplicate-vs-update";

/** Main event identity resolution orchestrator */
export function resolveEventIdentity(
  incoming: IncomingEvidence,
  context: EventIdentityContext,
): IdentityResolutionResult {
  const { existingEvents, recentEvidence } = context;

  // Priority order: exact duplicates first, then document versions, 
  // then genuinely separate events (clear recurrence), then semantic same, 
  // then duplicate vs update (includes ambiguous), then repeated observations
  const detectors = [
    { name: "exact_duplicates", fn: detectExactDuplicates },
    { name: "document_versions", fn: detectDocumentVersions },
    { name: "genuinely_separate", fn: detectGenuinelySeparateEvents },
    { name: "semantic_same_event", fn: detectSemanticSameEvent },
    { name: "duplicate_vs_update", fn: detectDuplicateVsUpdate },
    { name: "repeated_observations", fn: detectRepeatedObservations },
  ];

  for (const detector of detectors) {
    const result = detector.fn(incoming, existingEvents);
    if (result) {
      // Add context about which detector fired
      return {
        ...result,
        reasoning: `[${detector.name}] ${result.reasoning}`,
      };
    }
  }

  // No match found - genuinely new event
  return {
    incoming_id: incoming.id,
    resolution: "new_event",
    confidence: IDENTITY_CONFIDENCE.medium,
    matched_event_id: null,
    evidence_relation: null,
    reasoning: "No matching existing event found. Creating new event.",
    failure_labels: [],
    requires_clarification: false,
    combined_evidence: [incoming.id],
  };
}

/** Batch resolve multiple incoming evidence items */
export function resolveEventIdentitiesBatch(
  incomingItems: IncomingEvidence[],
  context: EventIdentityContext,
): BatchIdentityResolution {
  const resolutions: IdentityResolutionResult[] = [];
  const newEvents: IncomingEvidence[] = [];
  const updatedEvents: { event_id: string; enriched_fields: string[] }[] = [];
  const mergedEvents: { kept_id: string; merged_ids: string[] }[] = [];
  const ambiguousItems: { incoming_id: string; question: string }[] = [];
  const failureInstances: { label: (typeof EVENT_IDENTITY_FAILURE_LABELS)[number]; context: string }[] = [];

  // Process in order, updating context as we go
  let currentEvents = [...context.existingEvents];
  let currentEvidence = [...context.recentEvidence];

  for (const item of incomingItems) {
    const result = resolveEventIdentity(item, {
      ...context,
      existingEvents: currentEvents,
      recentEvidence: currentEvidence,
    });

    resolutions.push(result);

    // Collect failures
    for (const label of result.failure_labels) {
      failureInstances.push({ label, context: result.reasoning });
    }

    // Handle based on resolution
    switch (result.resolution) {
      case "new_event":
        newEvents.push(item);
        // Add to current events for subsequent items to match against
        currentEvents.push({
          id: item.id,
          event_type: item.extracted_type ?? "observation",
          label: item.content.slice(0, 100),
          content: item.content,
          occurred_at: item.attributes?.occurred_at as string ?? null,
          created_at: item.captured_at,
          person_id: item.person_id,
          source_id: item.source_id,
          source_type: item.source_type,
          entities: item.entities ?? [],
          attributes: item.attributes ?? {},
          evidence_ids: [item.id],
          document_id: item.document_id,
          document_version: item.document_version,
          status: "committed",
          confidence: result.confidence,
        });
        break;

      case "duplicate_evidence":
      case "duplicate_event":
        if (result.matched_event_id) {
          const matchedEvent = currentEvents.find(e => e.id === result.matched_event_id);
          if (matchedEvent) {
            matchedEvent.evidence_ids = [...matchedEvent.evidence_ids, item.id];
            matchedEvent.confidence = Math.max(matchedEvent.confidence, result.confidence);
          }
        }
        break;

      case "update_existing":
        if (result.matched_event_id && result.enriched_fields) {
          updatedEvents.push({ event_id: result.matched_event_id, enriched_fields: result.enriched_fields });
          const matchedEvent = currentEvents.find(e => e.id === result.matched_event_id);
          if (matchedEvent) {
            matchedEvent.evidence_ids = [...matchedEvent.evidence_ids, item.id];
            matchedEvent.confidence = Math.max(matchedEvent.confidence, result.confidence);
            // Merge enriched fields
            for (const field of result.enriched_fields) {
              matchedEvent.attributes[field] = item.attributes?.[field] ?? "enriched_from_evidence";
            }
          }
        }
        break;

      case "ongoing_state":
      case "recurrence":
        if (result.matched_event_id) {
          const matchedEvent = currentEvents.find(e => e.id === result.matched_event_id);
          if (matchedEvent) {
            matchedEvent.evidence_ids = [...matchedEvent.evidence_ids, item.id];
            if (result.resolution === "recurrence") {
              matchedEvent.recurrence_count = (matchedEvent.recurrence_count ?? 0) + 1;
            }
          }
        }
        break;

      case "ambiguous_insufficient_evidence":
        if (result.clarification_question) {
          ambiguousItems.push({ incoming_id: item.id, question: result.clarification_question });
        }
        // Still add as provisional
        newEvents.push(item);
        break;

      case "unresolved_duplicate":
        // Keep as separate but flagged
        newEvents.push(item);
        break;
    }

    currentEvidence.push(item);
  }

  return {
    resolutions,
    new_events: newEvents,
    updated_events: updatedEvents,
    merged_events: mergedEvents,
    ambiguous_items: ambiguousItems,
    failure_instances: failureInstances,
    updated_existing_events: currentEvents,
  };
}

/** Create identity context from existing data */
export function createEventIdentityContext(
  personId: string,
  existingEvents: ExistingEvent[],
  recentEvidence: IncomingEvidence[] = [],
): EventIdentityContext {
  return {
    person_id: personId,
    existingEvents,
    recentEvidence,
    documentVersions: new Map(),
    caregiverReports: new Map(),
  };
}

/** Get event count for a person (reality count, not mention count) */
export function getEventRealityCount(
  events: ExistingEvent[],
  eventType?: string,
): number {
  let filtered = events.filter(e => e.status !== "invalidated" && e.status !== "superseded");
  if (eventType) {
    filtered = filtered.filter(e => e.event_type === eventType);
  }
  // Count unique events (not evidence)
  return filtered.length;
}

/** Get evidence count for an event */
export function getEvidenceCountForEvent(
  events: ExistingEvent[],
  eventId: string,
): number {
  const event = events.find(e => e.id === eventId);
  return event?.evidence_ids.length ?? 0;
}