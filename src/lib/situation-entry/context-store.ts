import { CARE_CONTEXT_ROOT_ID } from "./contract-constants";
import type { CanonicalCareEvent, CareContextRoot } from "./types";
import type { EventTime } from "../time-model";
import {
  applyRetrospectiveUpdate,
  temporalSortKey,
} from "../time-model";
import {
  applyUserFieldEdit,
  invalidateCanonicalEvent,
  supersedeWithUserVersion,
} from "../care-event-integrity";
import { attachPriorityToEvents } from "../care-event-priority";
import {
  getRecipientContext,
  resolveCareRealityStoreKey,
  resolveCareRecipientId,
} from "../multi-caregiver-context-model";
import { recordCareEventCreate, recordAudit } from "../audit-trail-system";
import {
  careContextCache,
  clearCareContextMemoryCache,
  deleteCareContextDurable,
  loadCareContextFromDurable,
  persistCareContextToDurable,
  resetCareContextDurableStore,
} from "./durable-store";

function scopeKey(careRecipientId: string): string {
  return `${CARE_CONTEXT_ROOT_ID}::${careRecipientId}`;
}

function cacheGet(careRecipientId: string): CareContextRoot | undefined {
  return careContextCache().get(scopeKey(careRecipientId));
}

function cacheSet(careRecipientId: string, root: CareContextRoot): void {
  careContextCache().set(scopeKey(careRecipientId), root);
  persistCareContextToDurable(root);
}

/**
 * Resolve Care Reality key for a contributor (Locked B — shared LCR).
 */
function realityKeyForContributor(contributorId: string): string {
  return resolveCareRealityStoreKey(contributorId);
}

/**
 * Load CareContext from memory cache, else durable `.data/` source of truth.
 * Keyed by care_recipient_id (Locked B). Argument may be contributor id.
 */
export function getCareContextRoot(contributorId: string): CareContextRoot | undefined {
  const careRecipientId = realityKeyForContributor(contributorId);
  const cached = cacheGet(careRecipientId);
  if (cached) return cached;

  let durable = loadCareContextFromDurable(careRecipientId);
  // Legacy: file keyed by contributor id
  if (!durable && careRecipientId !== contributorId) {
    durable = loadCareContextFromDurable(contributorId);
    if (durable) {
      const migrated: CareContextRoot = {
        ...durable,
        care_recipient_id: careRecipientId,
      };
      careContextCache().set(scopeKey(careRecipientId), migrated);
      persistCareContextToDurable(migrated);
      return migrated;
    }
  }
  if (!durable) return undefined;

  careContextCache().set(scopeKey(careRecipientId), durable);
  return durable;
}

export function getOrCreateCareContextRoot(contributorId: string): CareContextRoot {
  const existing = getCareContextRoot(contributorId);
  if (existing) {
    // Refresh acting contributor without forking Care Reality.
    if (existing.caregiver_id !== contributorId) {
      const touched: CareContextRoot = {
        ...existing,
        caregiver_id: contributorId,
        updated_at: new Date().toISOString(),
      };
      cacheSet(existing.care_recipient_id, touched);
      return touched;
    }
    return existing;
  }

  const now = new Date().toISOString();
  const careRecipientId = resolveCareRecipientId(contributorId);
  const multiCaregiver = getRecipientContext(careRecipientId);
  const root: CareContextRoot = {
    id: CARE_CONTEXT_ROOT_ID,
    care_recipient_id: careRecipientId,
    caregiver_id: contributorId,
    events: [],
    root_event_id: null,
    created_at: now,
    updated_at: now,
    multi_caregiver: multiCaregiver,
  };
  cacheSet(careRecipientId, root);
  return root;
}

export function appendEventsToContext(
  contributorId: string,
  events: CanonicalCareEvent[],
): CareContextRoot {
  const ctx = getOrCreateCareContextRoot(contributorId);
  const isFirst = ctx.events.length === 0 && events.length > 0;

  const withRoot = events.map((e, i) => {
    // Situation-linked events keep ACS root_event_id (soft updates share one root).
    if (e.situation_id) {
      return {
        ...e,
        situation_id: e.situation_id,
        root_event_id: e.root_event_id,
      };
    }
    return {
      ...e,
      situation_id: e.situation_id ?? null,
      root_event_id:
        e.root_event_id ??
        (isFirst && i === 0 ? null : ctx.root_event_id ?? ctx.events[0]?.id ?? null),
    };
  });

  const updated: CareContextRoot = {
    ...ctx,
    caregiver_id: contributorId,
    events: [...ctx.events, ...withRoot],
    root_event_id:
      ctx.root_event_id ?? (isFirst ? withRoot[0]?.id ?? null : ctx.root_event_id),
    updated_at: new Date().toISOString(),
  };

  if (isFirst && updated.root_event_id) {
    updated.events = updated.events.map((e, idx) => {
      if (e.situation_id) {
        // Preserve situation spine stamps; session root lives on CareContextRoot.
        return e;
      }
      return idx === 0
        ? { ...e, root_event_id: null }
        : { ...e, root_event_id: updated.root_event_id };
    });
  }

  updated.events = attachPriorityToEvents(updated.events);

  updated.multi_caregiver = getRecipientContext(updated.care_recipient_id);

  for (const event of withRoot) {
    recordCareEventCreate({
      event_id: event.id,
      caregiver_id: event.source_attribution?.caregiver_id ?? contributorId,
      care_recipient_id: updated.care_recipient_id,
      timestamp: event.timestamp,
      snapshot: {
        raw_input: event.raw_input,
        status: event.status,
        extracted_type: event.extracted_type,
        timestamp: event.timestamp,
      },
      confidence_after: event.integrity.field_confidence?.extracted_fact
        ? event.integrity.field_confidence.extracted_fact.extraction === "high"
          ? 0.85
          : event.integrity.field_confidence.extracted_fact.extraction === "medium"
            ? 0.65
            : 0.45
        : null,
    });
  }

  cacheSet(updated.care_recipient_id, updated);
  return updated;
}


/** Update event_time only — ingestion_time is immutable. */
export function updateEventTimeInContext(
  caregiverId: string,
  eventId: string,
  newEventTime: EventTime,
): { context: CareContextRoot; correction: ReturnType<typeof applyRetrospectiveUpdate>["correction"] } | null {
  const ctx = getCareContextRoot(caregiverId);
  if (!ctx) return null;

  const idx = ctx.events.findIndex((e) => e.id === eventId);
  if (idx < 0) return null;

  const existing = ctx.events[idx]!;
  const { updated_event_time, correction } = applyRetrospectiveUpdate({
    eventId,
    currentEventTime: existing.event_time,
    newEventTime,
  });

  const updatedEvent: CanonicalCareEvent = {
    ...existing,
    event_time: updated_event_time,
    timestamp: temporalSortKey(updated_event_time, existing.ingestion_time),
  };

  const events = [...ctx.events];
  events[idx] = updatedEvent;

  const updated: CareContextRoot = {
    ...ctx,
    events: attachPriorityToEvents(events),
    updated_at: new Date().toISOString(),
  };
  cacheSet(updated.care_recipient_id, updated);
  return { context: updated, correction };
}

function replaceEventInContext(
  caregiverId: string,
  eventId: string,
  updatedEvent: CanonicalCareEvent,
): CareContextRoot | null {
  const ctx = getCareContextRoot(caregiverId);
  if (!ctx) return null;
  const idx = ctx.events.findIndex((e) => e.id === eventId);
  if (idx < 0) return null;
  const events = [...ctx.events];
  events[idx] = updatedEvent;
  const updated: CareContextRoot = {
    ...ctx,
    events: attachPriorityToEvents(events),
    updated_at: new Date().toISOString(),
  };
  cacheSet(updated.care_recipient_id, updated);
  return updated;
}

/** Soft delete — status invalidated, event preserved in ingestion history. */
export function invalidateEventInContext(
  caregiverId: string,
  eventId: string,
  reason?: string,
): { context: CareContextRoot; event: CanonicalCareEvent } | null {
  const ctx = getCareContextRoot(caregiverId);
  if (!ctx) return null;
  const existing = ctx.events.find((e) => e.id === eventId);
  if (!existing) return null;
  const invalidated = invalidateCanonicalEvent(existing, caregiverId, reason);
  recordAudit({
    actor: { type: "caregiver", id: caregiverId },
    action_type: "delete",
    entity_type: "care_event",
    entity_id: eventId,
    previous_state: { status: existing.status, raw_input: existing.raw_input },
    new_state: { status: invalidated.status },
    reason: "explicit_user_input",
    reason_detail: reason ?? "invalidated",
    care_recipient_id: ctx.care_recipient_id,
    timestamp: existing.timestamp,
    related_events: [eventId],
  });
  const updated = replaceEventInContext(caregiverId, eventId, invalidated);
  if (!updated) return null;
  return { context: updated, event: invalidated };
}

export function applyUserCorrectionInContext(
  caregiverId: string,
  eventId: string,
  fields: Record<string, unknown>,
  reason?: string,
): { context: CareContextRoot; event: CanonicalCareEvent } | null {
  const ctx = getCareContextRoot(caregiverId);
  if (!ctx) return null;
  const existing = ctx.events.find((e) => e.id === eventId);
  if (!existing) return null;
  const corrected = applyUserFieldEdit({ event: existing, caregiverId, fields, reason });
  const updated = replaceEventInContext(caregiverId, eventId, corrected);
  if (!updated) return null;
  return { context: updated, event: corrected };
}

export function supersedeEventInContext(
  caregiverId: string,
  originalEventId: string,
  replacement: CanonicalCareEvent,
  reason?: string,
): { context: CareContextRoot; superseded: CanonicalCareEvent; active: CanonicalCareEvent } | null {
  const ctx = getCareContextRoot(caregiverId);
  if (!ctx) return null;
  const original = ctx.events.find((e) => e.id === originalEventId);
  if (!original) return null;
  const { superseded, active } = supersedeWithUserVersion({
    original,
    replacement: { ...replacement, root_event_id: original.root_event_id },
    caregiverId,
    reason,
  });
  const events = ctx.events.map((e) => (e.id === originalEventId ? superseded : e));
  events.push(active);
  const updated: CareContextRoot = {
    ...ctx,
    events: attachPriorityToEvents(events),
    updated_at: new Date().toISOString(),
  };
  cacheSet(updated.care_recipient_id, updated);
  return { context: updated, superseded, active };
}

/** Clear memory cache + durable CareContext (verify isolation). */
export function resetCareContextRootStore(): void {
  resetCareContextDurableStore();
}

export { clearCareContextMemoryCache, deleteCareContextDurable };
