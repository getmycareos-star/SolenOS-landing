import { structureCareInput } from "../care-record/structure-input";
import { inferEventType } from "./classify";
import { tryPersistCareEvent } from "./postgres-store";
import { createCareEvent, getCareEvent, updateCareEventMetadata } from "./store";
import type { CreateCareEventInput, CreateCareEventResult } from "./types";

function enrichWithStructured(input: CreateCareEventInput): CreateCareEventInput {
  const documentRefs = Array.isArray(input.metadata?.document_refs)
    ? (input.metadata!.document_refs as {
        id: string;
        name: string;
        mime_type?: string;
        extracted_preview?: string;
      }[])
    : [];

  const structured = structureCareInput({
    content: input.content,
    occurred_at: input.occurred_at,
    document_refs: documentRefs,
  });

  return {
    ...input,
    event_type: input.event_type ?? inferEventType(input.content),
    metadata: {
      ...(input.metadata ?? {}),
      structured,
      continuous_care_record: true,
    },
  };
}

/**
 * Record a CareEvent — structured for continuous care record, in-memory + Postgres.
 */
export async function recordCareEvent(input: CreateCareEventInput): Promise<CreateCareEventResult> {
  const enriched = enrichWithStructured(input);
  const inMemory = createCareEvent(enriched);

  const persisted = await tryPersistCareEvent(enriched);
  if (persisted) {
    return { care_event: persisted };
  }

  return inMemory;
}

export async function recordCareEventWithContext(
  input: CreateCareEventInput,
): Promise<
  CreateCareEventResult & {
    historical_context?: import("../care-record/types").HistoricalContextResult;
  }
> {
  const result = await recordCareEvent(input);

  const { listCareEventsForCaregiver } = await import("./store");
  const { retrieveHistoricalContext } = await import("../care-record/retrieve");

  const caregiverId = input.created_by ?? "default_caregiver";
  const prior = listCareEventsForCaregiver(caregiverId).filter(
    (e) => e.id !== result.care_event.id,
  );

  const historical_context =
    prior.length > 0
      ? retrieveHistoricalContext(prior, input.content, 5)
      : { query: input.content, matches: [], evidence_backed: true as const };

  if (historical_context.matches.length > 0) {
    const relatedIds = historical_context.matches.map((m) => m.event_id);
    updateCareEventMetadata(result.care_event.id, {
      related_event_ids: relatedIds,
    });
    const refreshed = getCareEvent(result.care_event.id);
    if (refreshed) {
      return { care_event: refreshed, historical_context };
    }
  }

  return { ...result, historical_context };
}
