import type { CanonicalCareEvent } from "../situation-entry/types";
import type { CareEventSourceAttribution, SourceType } from "./types";

export function inferSourceType(event: CanonicalCareEvent): SourceType {
  if (event.status === "provisional" || event.status === "unparsed_raw") {
    return "inferred";
  }
  if (event.source === "document") {
    return "reported";
  }
  if (event.integrity.sources?.includes("user_correction")) {
    return "direct_observation";
  }
  return "direct_observation";
}

export function attachSourceAttribution(
  event: CanonicalCareEvent,
  caregiverId: string,
  careRecipientId: string,
  sourceType?: SourceType,
): CanonicalCareEvent {
  const attribution: CareEventSourceAttribution = {
    caregiver_id: caregiverId,
    care_recipient_id: careRecipientId,
    source_type: sourceType ?? inferSourceType(event),
    observed_at: event.event_time.start ?? event.ingestion_time,
    ingestion_context: typeof event.attributes.source_situation_text === "string"
      ? event.attributes.source_situation_text.slice(0, 200)
      : null,
  };

  return { ...event, source_attribution: attribution };
}

export function attachAttributionToEvents(
  events: CanonicalCareEvent[],
  caregiverId: string,
  careRecipientId: string,
): CanonicalCareEvent[] {
  return events.map((e) => attachSourceAttribution(e, caregiverId, careRecipientId));
}

export function ensureEventHasAttribution(
  event: CanonicalCareEvent,
  fallbackCaregiverId: string,
  fallbackRecipientId: string,
): CanonicalCareEvent {
  if (event.source_attribution) return event;
  return attachSourceAttribution(event, fallbackCaregiverId, fallbackRecipientId);
}
