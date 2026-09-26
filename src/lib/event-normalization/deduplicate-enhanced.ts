import type { NormalizedAtomicEvent } from "./types";
import {
  resolveEventIdentity,
  createEventIdentityContext,
  type IncomingEvidence,
  type ExistingEvent,
  type BatchIdentityResolution,
} from "../event-identity";

/**
 * Enhanced deduplication using Category 9 Event Identity resolution.
 * This replaces the simple text-based deduplicateEvents with full identity reasoning.
 */

function convertNormalizedToIncoming(event: NormalizedAtomicEvent): IncomingEvidence {
  return {
    id: event.id,
    content: event.source_text,
    source_id: event.raw_input_id,
    source_type: "document", // Default, could be inferred from context
    captured_at: event.ingestion_time,
    person_id: event.entities[0] ?? "unknown", // Would need person resolution
    extracted_type: event.atomic_type,
    entities: event.entities,
    attributes: event.attributes,
    document_id: event.attributes.document_id as string,
    document_version: event.attributes.document_version as number,
    metadata: {
      confidence: event.confidence,
      uncertainty: event.uncertainty,
    },
  };
}

function convertNormalizedToExisting(event: NormalizedAtomicEvent): ExistingEvent {
  return {
    id: event.id,
    event_type: event.atomic_type,
    label: event.label,
    content: event.source_text,
    occurred_at: event.event_time ? JSON.stringify(event.event_time) : null,
    created_at: event.ingestion_time,
    person_id: event.entities[0] ?? "unknown",
    source_id: event.raw_input_id,
    source_type: "document",
    entities: event.entities,
    attributes: event.attributes,
    evidence_ids: event.merged_from_ids.length > 0 ? [...event.merged_from_ids, event.id] : [event.id],
    document_id: event.attributes.document_id as string,
    document_version: event.attributes.document_version as number,
    status: event.status,
    confidence: event.confidence,
    uncertainty: event.uncertainty.map(u => u.field),
    recurrence_count: event.attributes.recurrence_count as number,
    superseded_by: event.attributes.superseded_by_id as string,
    supersedes: event.updated_event_id,
  };
}

/**
 * Enhanced deduplication with full Category 9 identity resolution.
 * Returns both the traditional format and the new identity resolution results.
 */
export function deduplicateEventsWithIdentity(
  incoming: NormalizedAtomicEvent[],
  existing: NormalizedAtomicEvent[],
): {
  toCommit: NormalizedAtomicEvent[];
  merged: { kept: NormalizedAtomicEvent; mergedId: string; description: string }[];
  identityResults: BatchIdentityResolution;
} {
  // Convert to identity types
  const incomingEvidence = incoming.map(convertNormalizedToIncoming);
  const existingEvents = existing.map(convertNormalizedToExisting);

  // Create context
  const personId = incomingEvidence[0]?.person_id ?? "unknown";
  const context = createEventIdentityContext(personId, existingEvents);

  // Run batch identity resolution
  const identityResults = resolveEventIdentitiesBatch(incomingEvidence, context);

  // Convert back to NormalizedAtomicEvent format for compatibility
  const toCommit: NormalizedAtomicEvent[] = [];
  const merged: { kept: NormalizedAtomicEvent; mergedId: string; description: string }[] = [];

  for (const result of identityResults.resolutions) {
    const incomingEvent = incoming.find(e => e.id === result.incoming_id);
    if (!incomingEvent) continue;

    switch (result.resolution) {
      case "duplicate_evidence":
      case "duplicate_event":
        if (result.matched_event_id) {
          const existingEvent = existing.find(e => e.id === result.matched_event_id);
          if (existingEvent) {
            const kept: NormalizedAtomicEvent = {
              ...existingEvent,
              confidence: Math.max(existingEvent.confidence, incomingEvent.confidence),
              merged_from_ids: [...existingEvent.merged_from_ids, incomingEvent.id],
              attributes: { ...existingEvent.attributes, ...incomingEvent.attributes },
            };
            merged.push({
              kept,
              mergedId: incomingEvent.id,
              description: result.reasoning,
            });
          }
        }
        break;

      case "update_existing":
        if (result.matched_event_id) {
          const existingEvent = existing.find(e => e.id === result.matched_event_id);
          if (existingEvent) {
            const kept: NormalizedAtomicEvent = {
              ...existingEvent,
              status: "updated",
              updated_event_id: existingEvent.id,
              confidence: Math.max(existingEvent.confidence, incomingEvent.confidence),
              attributes: { ...existingEvent.attributes, ...incomingEvent.attributes },
            };
            merged.push({
              kept,
              mergedId: incomingEvent.id,
              description: `Updated: ${result.reasoning}`,
            });
          }
        }
        break;

      case "new_event":
      case "recurrence":
      case "ongoing_state":
      case "ambiguous_insufficient_evidence":
      case "unresolved_duplicate":
        toCommit.push(incomingEvent);
        break;
    }
  }

  return { toCommit, merged, identityResults };
}

/**
 * Quick identity check for a single incoming event against existing.
 * Returns the identity resolution without full batch processing.
 */
export function checkEventIdentity(
  incoming: NormalizedAtomicEvent,
  existing: NormalizedAtomicEvent[],
): {
  resolution: "new" | "duplicate" | "update" | "ongoing" | "recurrence" | "ambiguous";
  matchedEventId: string | null;
  confidence: number;
  reasoning: string;
} {
  const incomingEvidence = convertNormalizedToIncoming(incoming);
  const existingEvents = existing.map(convertNormalizedToExisting);
  const personId = incomingEvidence.person_id;
  const context = createEventIdentityContext(personId, existingEvents);

  const result = resolveEventIdentity(incomingEvidence, context);

  let resolution: "new" | "duplicate" | "update" | "ongoing" | "recurrence" | "ambiguous";
  switch (result.resolution) {
    case "duplicate_evidence":
    case "duplicate_event":
      resolution = "duplicate";
      break;
    case "update_existing":
      resolution = "update";
      break;
    case "ongoing_state":
      resolution = "ongoing";
      break;
    case "recurrence":
      resolution = "recurrence";
      break;
    case "ambiguous_insufficient_evidence":
      resolution = "ambiguous";
      break;
    default:
      resolution = "new";
  }

  return {
    resolution,
    matchedEventId: result.matched_event_id,
    confidence: result.confidence,
    reasoning: result.reasoning,
  };
}