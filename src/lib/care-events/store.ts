import { deriveConfidence, deriveUncertaintyLevel, inferEventType } from "./classify";
import type {
  CareEventRecord,
  CreateCareEventInput,
  CreateCareEventResult,
  EventSourceRecord,
  InputProvenance,
} from "./types";

const careEvents = new Map<string, CareEventRecord>();
const eventSources = new Map<string, EventSourceRecord>();
const careRecordIndex = new Map<string, string[]>();
const caregiverIndex = new Map<string, string[]>();

function indexEvent(careEvent: CareEventRecord): void {
  if (careEvent.care_record_id) {
    const ids = careRecordIndex.get(careEvent.care_record_id) ?? [];
    ids.push(careEvent.id);
    careRecordIndex.set(careEvent.care_record_id, ids);
  }
  if (careEvent.created_by) {
    const ids = caregiverIndex.get(careEvent.created_by) ?? [];
    ids.push(careEvent.id);
    caregiverIndex.set(careEvent.created_by, ids);
  }
}

function resolveSourceType(provenance: InputProvenance): CareEventRecord["source_type"] {
  if (provenance.input_type === "voice") return "voice";
  if (provenance.input_type === "document") return "document";
  return "text";
}

export function createCareEventId(): string {
  return `ce_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createEventSourceId(): string {
  return `es_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function buildSourceMetadata(provenance: InputProvenance): Record<string, unknown> {
  const meta: Record<string, unknown> = {
    input_type: provenance.input_type,
  };
  // entry_method = evidence attribution only — never used for reasoning branches
  if (provenance.entry_method) {
    meta.entry_method = provenance.entry_method;
  }
  if (provenance.input_type === "voice") {
    meta.captured_at = provenance.captured_at;
    meta.recognition_confidence = provenance.recognition_confidence ?? null;
    meta.transcript_uncertain = provenance.transcript_uncertain ?? false;
  }
  return meta;
}

export function createCareEvent(input: CreateCareEventInput): CreateCareEventResult {
  const now = new Date().toISOString();
  const content = input.content.trim();
  const provenance = input.provenance;
  const sourceType = resolveSourceType(provenance);
  const capturedAt = provenance.captured_at ?? now;

  const careEventId = createCareEventId();
  const sourceId = createEventSourceId();

  const source: EventSourceRecord = {
    id: sourceId,
    care_event_id: careEventId,
    source_type: sourceType,
    captured_at: capturedAt,
    recognition_confidence:
      provenance.input_type === "voice" ? (provenance.recognition_confidence ?? null) : null,
    transcript_uncertain:
      provenance.input_type === "voice" ? (provenance.transcript_uncertain ?? false) : false,
    metadata: buildSourceMetadata(provenance),
    created_at: now,
  };

  const careEvent: CareEventRecord = {
    id: careEventId,
    care_record_id: input.care_record_id ?? null,
    event_type: input.event_type ?? inferEventType(content),
    content,
    occurred_at: input.occurred_at ?? null,
    created_at: now,
    source_type: sourceType,
    confidence: deriveConfidence(provenance),
    uncertainty_level: deriveUncertaintyLevel(provenance),
    created_by: input.created_by ?? null,
    metadata: {
      ...buildSourceMetadata(provenance),
      ...(input.metadata ?? {}),
    },
    source,
  };

  careEvents.set(careEventId, careEvent);
  eventSources.set(sourceId, source);
  indexEvent(careEvent);

  return { care_event: careEvent };
}

export function updateCareEventMetadata(
  id: string,
  patch: Record<string, unknown>,
): CareEventRecord | undefined {
  const event = careEvents.get(id);
  if (!event) return undefined;
  const updated: CareEventRecord = {
    ...event,
    metadata: { ...event.metadata, ...patch },
  };
  careEvents.set(id, updated);
  return updated;
}

export function listCareEventsForCaregiver(caregiverId: string): CareEventRecord[] {
  const ids = caregiverIndex.get(caregiverId) ?? [];
  return ids
    .map((id) => getCareEvent(id))
    .filter((e): e is CareEventRecord => e !== undefined)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function getCareEvent(id: string): CareEventRecord | undefined {
  const event = careEvents.get(id);
  if (!event) return undefined;
  const source = [...eventSources.values()].find((s) => s.care_event_id === id);
  return source ? { ...event, source } : event;
}

export function listCareEventsForRecord(careRecordId: string): CareEventRecord[] {
  const ids = careRecordIndex.get(careRecordId) ?? [];
  return ids
    .map((id) => getCareEvent(id))
    .filter((e): e is CareEventRecord => e !== undefined)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function resetCareEventStore(): void {
  careEvents.clear();
  eventSources.clear();
  careRecordIndex.clear();
  caregiverIndex.clear();
}

export const careEventStoreSchema = {
  care_events: {
    table: "care_events",
    columns: [
      "id",
      "care_record_id",
      "event_type",
      "content",
      "occurred_at",
      "created_at",
      "source_type",
      "confidence",
      "uncertainty_level",
      "created_by",
      "metadata",
    ] as const,
  },
  event_sources: {
    table: "event_sources",
    columns: [
      "id",
      "care_event_id",
      "source_type",
      "captured_at",
      "recognition_confidence",
      "transcript_uncertain",
      "metadata",
      "created_at",
    ] as const,
  },
} as const;
