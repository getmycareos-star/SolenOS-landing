import { inferCareJourneyCategory, inferCareJourneyTitle } from "./classify";
import type {
  CareJourneyAttachment,
  CareJourneyEvent,
  CreateCareJourneyEventInput,
} from "./types";

const events = new Map<string, CareJourneyEvent>();
const caregiverIndex = new Map<string, string[]>();
const caseIndex = new Map<string, string[]>();

export function createJourneyEventId(): string {
  return `cje_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function indexEvent(event: CareJourneyEvent): void {
  const cgIds = caregiverIndex.get(event.caregiver_id) ?? [];
  cgIds.push(event.event_id);
  caregiverIndex.set(event.caregiver_id, cgIds);

  if (event.case_id) {
    const caseIds = caseIndex.get(event.case_id) ?? [];
    caseIds.push(event.event_id);
    caseIndex.set(event.case_id, caseIds);
  }
}

export function createCareJourneyEvent(input: CreateCareJourneyEventInput): CareJourneyEvent {
  const now = new Date().toISOString();
  const description = input.description.trim();
  const category = input.category ?? inferCareJourneyCategory(description);
  const caregiverId = input.caregiver_id ?? "default_caregiver";

  const event: CareJourneyEvent = {
    event_id: createJourneyEventId(),
    case_id: input.case_id ?? null,
    caregiver_id: caregiverId,
    category,
    title: input.title?.trim() || inferCareJourneyTitle(description, category),
    description,
    event_date: input.event_date ?? now,
    source: input.source ?? "caregiver",
    attachments: input.attachments ?? [],
    metadata: input.metadata ?? {},
    created_at: now,
  };

  events.set(event.event_id, event);
  indexEvent(event);
  return event;
}

export function getCareJourneyEvent(eventId: string): CareJourneyEvent | undefined {
  return events.get(eventId);
}

export function listCareJourneyEventsForCaregiver(caregiverId: string): CareJourneyEvent[] {
  const ids = caregiverIndex.get(caregiverId) ?? [];
  return ids
    .map((id) => events.get(id))
    .filter((e): e is CareJourneyEvent => e !== undefined)
    .sort((a, b) => b.event_date.localeCompare(a.event_date));
}

export function listCareJourneyEventsForCase(caseId: string): CareJourneyEvent[] {
  const ids = caseIndex.get(caseId) ?? [];
  return ids
    .map((id) => events.get(id))
    .filter((e): e is CareJourneyEvent => e !== undefined)
    .sort((a, b) => b.event_date.localeCompare(a.event_date));
}

export function searchCareJourneyEvents(
  caregiverId: string,
  query: string,
): CareJourneyEvent[] {
  const q = query.trim().toLowerCase();
  if (!q) return listCareJourneyEventsForCaregiver(caregiverId);

  return listCareJourneyEventsForCaregiver(caregiverId).filter((event) => {
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
}

export function resetCareJourneyStore(): void {
  events.clear();
  caregiverIndex.clear();
  caseIndex.clear();
}

export function attachmentsFromDocumentRefs(
  refs: { id: string; name: string; mime_type?: string }[],
): CareJourneyAttachment[] {
  return refs.map((r) => ({ id: r.id, name: r.name, mime_type: r.mime_type }));
}
