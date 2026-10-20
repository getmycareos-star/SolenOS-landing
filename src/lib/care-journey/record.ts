import {
  createCareJourneyEvent,
  listCareJourneyEventsForCaregiver,
  searchCareJourneyEvents,
} from "./store";
import { tryLoadCareJourneyEvents, trySaveCareJourneyEvent } from "./postgres-store";
import type {
  CareJourneyEvent,
  CareJourneySearchResult,
  CareJourneyTimelineEntry,
  CreateCareJourneyEventInput,
} from "./types";

export async function recordCareJourneyEvent(
  input: CreateCareJourneyEventInput,
): Promise<CareJourneyEvent> {
  const persisted = await trySaveCareJourneyEvent(input);
  if (persisted) return persisted;
  return createCareJourneyEvent(input);
}

export async function loadCareJourneyTimeline(
  caregiverId: string,
): Promise<CareJourneyTimelineEntry[]> {
  const fromPostgres = await tryLoadCareJourneyEvents(caregiverId);
  if (fromPostgres) return fromPostgres;
  return listCareJourneyEventsForCaregiver(caregiverId);
}

export async function searchCareJourney(
  caregiverId: string,
  query: string,
): Promise<CareJourneySearchResult> {
  const timeline = await loadCareJourneyTimeline(caregiverId);
  const q = query.trim().toLowerCase();

  if (!q) {
    return { query: q, matches: timeline, total: timeline.length };
  }

  const matches = timeline.filter((event) => {
    const haystack = [
      event.title,
      event.description,
      event.category,
      event.source,
      ...event.attachments.map((a) => a.name),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });

  return { query: q, matches, total: timeline.length };
}

/** Bridge from unified care-events capture into care journey timeline. */
export async function recordJourneyEventFromCareCapture(params: {
  description: string;
  caregiver_id?: string;
  case_id?: string | null;
  source?: string;
  event_date?: string;
  attachments?: CreateCareJourneyEventInput["attachments"];
  metadata?: Record<string, unknown>;
  care_event_id?: string;
}): Promise<CareJourneyEvent> {
  return recordCareJourneyEvent({
    description: params.description,
    caregiver_id: params.caregiver_id,
    case_id: params.case_id,
    source: params.source ?? "caregiver_input",
    event_date: params.event_date,
    attachments: params.attachments,
    metadata: {
      ...(params.metadata ?? {}),
      ...(params.care_event_id ? { care_event_id: params.care_event_id } : {}),
    },
  });
}

export { searchCareJourneyEvents, listCareJourneyEventsForCaregiver };
