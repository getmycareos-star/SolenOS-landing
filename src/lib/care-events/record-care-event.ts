import { structureCareInput } from "../care-record/structure-input";
import { inferEventType } from "./classify";
import { retrieveHistoricalContext } from "../care-record/retrieve";
import { tryLoadCareEventsForCaregiver, tryPersistCareEvent } from "./postgres-store";
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
 * Record a CareEvent — only reports success after the event and source are durably stored.
 */
export async function recordCareEvent(input: CreateCareEventInput): Promise<CreateCareEventResult> {
  const caregiverId = input.created_by?.trim();
  if (!caregiverId || caregiverId === "default_caregiver") throw new Error("Authenticated caregiver attribution is required; care event was not recorded.");
  const enriched = enrichWithStructured(input);
  const persisted = await tryPersistCareEvent(enriched);
  return { care_event: persisted };
}

export async function recordCareEventWithContext(
  input: CreateCareEventInput,
): Promise<
  CreateCareEventResult & {
    historical_context?: import("../care-record/types").HistoricalContextResult;
  }
> {
  const result = await recordCareEvent(input);

  const caregiverId = input.created_by?.trim();
  if (!caregiverId || caregiverId === "default_caregiver") {
    throw new Error("Authenticated caregiver attribution is required to retrieve historical context.");
  }

  let historical_context: import("../care-record/types").HistoricalContextResult;
  try {
    const prior = (await tryLoadCareEventsForCaregiver(caregiverId)).filter(
      (event) => event.id !== result.care_event.id,
    );
    historical_context = retrieveHistoricalContext(prior, input.content, 5);
  } catch {
    historical_context = {
      query: input.content,
      matches: [],
      evidence_backed: false,
      status: "unavailable",
    };
  }

  return { ...result, historical_context };
}
