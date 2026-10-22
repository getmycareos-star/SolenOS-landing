/**
 * SolenOS Intelligence Layer — durable memory retrieval.
 *
 * Prior care events are loaded from Postgres. Database errors propagate; they
 * are never converted into an empty history. In-memory state is not treated as
 * the authoritative care record.
 */

import type {
  ActiveCareSituation,
  CanonicalCareEvent,
  CareRealityState,
  ContinuityDecision,
} from "../situation-entry";
import { getCareRealityState } from "../care-reality-state";
import { getActiveCareSituation } from "../active-care-situation";
import { getCareContextRoot } from "../situation-entry/context-store";
import { detectContinuity } from "../care-identity/continuity-detection";
import { tryLoadCareEventsForCaregiver } from "../care-events/postgres-store";
import type { CareEventRecord } from "../care-events/types";
import type { SolenOSInput, SolenOSMemory } from "./types";

function readCanonicalEvent(record: CareEventRecord): CanonicalCareEvent | null {
  const value = record.metadata?.canonical_care_event;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.raw_input !== "string" ||
    typeof candidate.extracted_type !== "string" ||
    typeof candidate.source !== "string" ||
    typeof candidate.ingestion_time !== "string" ||
    !Array.isArray(candidate.entities) ||
    !Array.isArray(candidate.uncertainty) ||
    !candidate.attributes ||
    typeof candidate.attributes !== "object"
  ) {
    return null;
  }
  return candidate as unknown as CanonicalCareEvent;
}

export async function retrieveMemory(input: SolenOSInput): Promise<SolenOSMemory> {
  const careRecipientId = input.careRecipientId?.trim();
  if (!careRecipientId || careRecipientId === "default" || careRecipientId === "default_caregiver") {
    throw new Error("Care-recipient identity is required for memory retrieval; caregiver identity is not a substitute.");
  }

  const careRealityState: CareRealityState | null = getCareRealityState(careRecipientId);
  // Active situations are keyed by authenticated caregiver identity in this store.
  const activeSituation: ActiveCareSituation | null = getActiveCareSituation(input.caregiverId);

  const continuityDecision: ContinuityDecision | null = detectContinuity({
    caregiverId: input.caregiverId,
    careRecipientId,
    rawText: input.raw,
  });

  const contextRoot = getCareContextRoot(input.caregiverId);
  const persistedEvents = await tryLoadCareEventsForCaregiver(input.caregiverId);
  const recentEvents = persistedEvents
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 20)
    .map(readCanonicalEvent)
    .filter((event): event is CanonicalCareEvent => event !== null);

  const recentEventsStatus =
    persistedEvents.length === 0
      ? "no_recorded_events"
      : recentEvents.length === persistedEvents.slice(0, 20).length
        ? "available"
        : "partial";

  // Context root is read here to ensure the store is reachable; the pipeline
  // separately refuses to create a synthetic root when it is absent.
  void contextRoot;

  return {
    careRealityState,
    activeSituation,
    continuityDecision,
    recentEvents,
    recentEventsStatus,
  };
}
