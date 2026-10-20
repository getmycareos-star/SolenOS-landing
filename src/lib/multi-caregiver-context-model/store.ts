import type { MultiCaregiverCareContext } from "./types";
import type { CanonicalCareEvent } from "../situation-entry/types";
import { DEFAULT_CARE_RECIPIENT_ID } from "./contract-constants";
import {
  livingCareRecordDataDir,
  readDurableJson,
  sanitizeDurableCareKey,
  writeDurableJson,
} from "../living-care-record-persistence/fs-store";
import { createPerson, getPerson, assignRole, findPersonByAlias, resetEntityStore } from "../entities/store";

const recipientContexts = new Map<string, MultiCaregiverCareContext>();
const caregiverToRecipient = new Map<string, string>();
const recipientEvents = new Map<string, CanonicalCareEvent[]>();
let linksHydrated = false;

type LinkMap = Record<string, string>;

function linksPath(): string {
  return livingCareRecordDataDir(
    "care-reality-links",
    "contributor-to-recipient.json",
  );
}

function hydrateLinks(): void {
  if (linksHydrated) return;
  linksHydrated = true;
  const durable = readDurableJson<LinkMap>(linksPath());
  if (!durable) return;
  for (const [contributorId, careRecipientId] of Object.entries(durable)) {
    if (contributorId && careRecipientId) {
      caregiverToRecipient.set(contributorId, careRecipientId);
    }
  }
}

function persistLinks(): void {
  const obj: LinkMap = {};
  for (const [contributorId, careRecipientId] of caregiverToRecipient.entries()) {
    obj[contributorId] = careRecipientId;
  }
  writeDurableJson(linksPath(), obj);
}

/**
 * Link a contributor to a Care Reality (care recipient).
 * Locked B: many contributors → one Living Care Record.
 *
 * CRITICAL: Never infers care recipient identity from contributor ID alone.
 * Care recipient identity must be explicitly provided or resolved.
 */
export function linkCaregiverToRecipient(
  caregiverId: string,
  careRecipientId: string,
): void {
  hydrateLinks();
  if (!careRecipientId || careRecipientId === caregiverId) {
    return;
  }
  caregiverToRecipient.set(caregiverId, careRecipientId);
  persistLinks();
}

/**
 * Ensure this contributor has a Care Reality.
 * - Optional joinCareRecipientId attaches them to an existing shared reality.
 * - Otherwise DO NOT mint a personal care_recipient_id (no silent identity creation).
 * - Returns the existing link or DEFAULT_CARE_RECIPIENT_ID if no link exists.
 */
export function ensureContributorCareReality(
  contributorId: string,
  joinCareRecipientId?: string | null,
): string {
  hydrateLinks();
  const join = joinCareRecipientId?.trim();
  if (join && join !== contributorId) {
    linkCaregiverToRecipient(contributorId, join);
    return join;
  }
  const existing = caregiverToRecipient.get(contributorId);
  if (existing) return existing;

  // CRITICAL: Do not auto-mint a care recipient ID from contributor ID.
  // This was a critical identity assumption that conflated caregiver and care recipient.
  // Return default instead — the care recipient must be explicitly identified.
  return DEFAULT_CARE_RECIPIENT_ID;
}

/**
 * Resolve durable store key for ACS / CRS / CareContext.
 * Accepts contributor id or an existing care_recipient_id (no double-mint).
 *
 * CRITICAL: Never conflates contributor identity with care recipient identity.
 */
export function resolveCareRealityStoreKey(contributorOrRealityId: string): string {
  hydrateLinks();
  for (const recipientId of caregiverToRecipient.values()) {
    if (recipientId === contributorOrRealityId) return contributorOrRealityId;
  }
  const linked = caregiverToRecipient.get(contributorOrRealityId);
  if (linked) return linked;
  if (
    contributorOrRealityId.startsWith("cr_") ||
    contributorOrRealityId === DEFAULT_CARE_RECIPIENT_ID
  ) {
    return contributorOrRealityId;
  }
  // Do not auto-create a care recipient from contributor ID
  return DEFAULT_CARE_RECIPIENT_ID;
}

/** Resolve Care Reality id for a contributor (DO NOT auto-mint). */
export function resolveCareRecipientId(caregiverId: string): string {
  const linked = caregiverToRecipient.get(caregiverId);
  if (linked) return linked;
  return DEFAULT_CARE_RECIPIENT_ID;
}

export function appendRecipientEvents(
  careRecipientId: string,
  events: CanonicalCareEvent[],
): void {
  const prior = recipientEvents.get(careRecipientId) ?? [];
  const byId = new Map(prior.map((e) => [e.id, e]));
  for (const e of events) byId.set(e.id, e);
  recipientEvents.set(careRecipientId, [...byId.values()]);
}

export function getRecipientEvents(careRecipientId: string): CanonicalCareEvent[] {
  return recipientEvents.get(careRecipientId) ?? [];
}

export function getRecipientContext(
  careRecipientId: string,
): MultiCaregiverCareContext {
  const existing = recipientContexts.get(careRecipientId);
  if (existing) return existing;

  const created: MultiCaregiverCareContext = {
    care_recipient_id: careRecipientId,
    care_recipient_label: null,
    caregivers: [],
    attribution_map: [],
    source_confidence_profiles: [],
    conflict_log: [],
  };
  recipientContexts.set(careRecipientId, created);
  return created;
}

export function saveRecipientContext(context: MultiCaregiverCareContext): void {
  recipientContexts.set(context.care_recipient_id, context);
}

export function resetMultiCaregiverContextStore(): void {
  recipientContexts.clear();
  caregiverToRecipient.clear();
  recipientEvents.clear();
  linksHydrated = false;
}

// Backward-compatible reset that also clears entity store
export function resetAllEntityStores(): void {
  resetMultiCaregiverContextStore();
  resetEntityStore();
}
