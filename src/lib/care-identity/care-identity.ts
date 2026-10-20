/**
 * Care Identity — structured lifecycle for the person being cared for.
 *
 * Before this module, Care Identity was implicit: a display_name string on
 * CareRecipientIdentity and a subject_label on ActiveCareSituation.
 * No entity tracked whether this caregiver was new or returning, or what the
 * identity lifecycle state was.
 *
 * This module provides:
 * - CareIdentityRecord with lifecycle states
 * - CRUD (create, activate, resolve, get, list for caregiver)
 * - New vs returning caregiver detection
 * - Durable JSON storage (same pattern as care-reality-state)
 *
 * Hierarchy:
 *   Caregiver (careKey)
 *     ↓
 *   Care Identity (care_recipient_id)
 *     ↓
 *   Care Reality State (CRS)
 *     ↓
 *   Care Reality Memory (events, observations, decisions, unknowns)
 *     ↓
 *   Care Outcomes (resolved through CRS revisions)
 */

import {
  livingCareRecordDataDir,
  readDurableJson,
  sanitizeDurableCareKey,
  writeDurableJson,
  clearDurableDirectory,
} from "../living-care-record-persistence/fs-store";
import { resolveCareRealityStoreKey } from "../multi-caregiver-context-model";
import { getCareRealityState } from "../care-reality-state";
import { getCareRecipientIdentity } from "../care-recipient-identity";

// ─── Types ────────────────────────────────────────────────────────────────

/**
 * Lifecycle of a Care Identity.
 *
 * - potential: Care recipient mentioned (kinship cue or display_name)
 *              but no care events have been recorded yet.
 * - established: Care identity confirmed with at least one care event.
 * - active_care: Ongoing care situation is active (CRS has current_understanding).
 * - resolved: Care identity is known but no longer active (care situation resolved).
 * - ended: Care relationship has ended (e.g., care recipient passed away).
 */
export type CareIdentityLifecycle =
  | "potential"
  | "established"
  | "active_care"
  | "resolved"
  | "ended";

export type CareIdentityRecord = {
  /** Care reality store key (same as care_recipient_id on CRS/ACS). */
  care_recipient_id: string;
  /** Primary caregiver key (who first created this identity). */
  caregiver_id: string;
  /** Display name (ask-once, never silently inferred). */
  display_name: string | null;
  /** Relationship descriptor (e.g., "mother", "father"). */
  relationship: string | null;
  /** Current lifecycle state. */
  lifecycle: CareIdentityLifecycle;
  /** CRS id when active_care (nullable for potential/ended). */
  care_reality_state_id: string | null;
  /** Number of care events recorded under this identity. */
  event_count: number;
  /** Number of interaction sessions since last return. */
  session_count: number;
  created_at: string;
  updated_at: string;
  first_seen_at: string;
  last_active_at: string;
};

export type CareIdentitySummary = {
  care_recipient_id: string;
  display_name: string | null;
  relationship: string | null;
  lifecycle: CareIdentityLifecycle;
  has_active_care: boolean;
  last_active_at: string;
};

export type ContinuityType =
  /** First-ever interaction — no caregiver history, no Care Identity, no previous events. */
  | "new_caregiver"
  /** Caregiver has history but this is a new care recipient. */
  | "new_care_recipient"
  /** Same caregiver, same care recipient, returning to an existing Care Reality. */
  | "returning"
  /** Same caregiver, same care recipient, continuing from a previous session. */
  | "continuation";

export type ContinuityContext = {
  continuity_type: ContinuityType;
  identity: CareIdentityRecord | null;
  prior_events_exist: boolean;
  prior_decisions_exist: boolean;
  prior_unknowns_exist: boolean;
  prior_observations_exist: boolean;
  open_uncertainties: string[];
  continuity_hooks: string[];
  care_reality_state_summary: string[] | null;
  prior_decisions: string[];
};

// ─── Constants ────────────────────────────────────────────────────────────

export const CARE_IDENTITY_PURPOSE =
  "Track the identity lifecycle of each care recipient — enabling SolenOS to distinguish new vs returning caregivers.";

const IDENTITY_FILE_PREFIX = "care-identity";

// ─── Internal Storage ─────────────────────────────────────────────────────

const identityCache = new Map<string, CareIdentityRecord>();

function identityDir(...parts: string[]): string {
  return livingCareRecordDataDir(IDENTITY_FILE_PREFIX, ...parts);
}

function filePath(careRecipientId: string): string {
  return identityDir(`${sanitizeDurableCareKey(careRecipientId)}.json`);
}

function loadIdentity(careRecipientId: string): CareIdentityRecord | null {
  const cached = identityCache.get(careRecipientId);
  if (cached) return cached;
  const durable = readDurableJson<CareIdentityRecord>(filePath(careRecipientId));
  if (durable?.care_recipient_id) {
    identityCache.set(careRecipientId, durable);
    return durable;
  }
  return null;
}

function saveIdentity(record: CareIdentityRecord): void {
  const key = record.care_recipient_id;
  identityCache.set(key, record);
  writeDurableJson(filePath(key), record);
}

// ─── Identity Lifecycle Helpers ──────────────────────────────────────────

/**
 * Create a new Care Identity record.
 * Starts in "potential" lifecycle until the first care event is recorded.
 */
export function createCareIdentity(params: {
  caregiverId: string;
  careRecipientId: string;
  displayName?: string | null;
  relationship?: string | null;
}): CareIdentityRecord {
  const id = resolveCareRealityStoreKey(params.careRecipientId);
  const now = new Date().toISOString();

  const record: CareIdentityRecord = {
    care_recipient_id: id,
    caregiver_id: params.caregiverId,
    display_name: params.displayName?.trim() ?? null,
    relationship: params.relationship?.trim() ?? null,
    lifecycle: "potential",
    care_reality_state_id: null,
    event_count: 0,
    session_count: 1,
    created_at: now,
    updated_at: now,
    first_seen_at: now,
    last_active_at: now,
  };

  saveIdentity(record);
  return record;
}

/**
 * Transition a Care Identity to the next lifecycle stage.
 */
export function transitCareIdentityLifecycle(
  careRecipientId: string,
  targetLifecycle: CareIdentityLifecycle,
): CareIdentityRecord | null {
  const id = resolveCareRealityStoreKey(careRecipientId);
  const record = loadIdentity(id);
  if (!record) return null;

  const now = new Date().toISOString();

  // Get CRS id if transitioning to active_care
  let careRealityStateId = record.care_reality_state_id;
  if (targetLifecycle === "active_care") {
    const crs = getCareRealityState(id);
    if (crs) {
      careRealityStateId = crs.id;
    }
  }

  const updated: CareIdentityRecord = {
    ...record,
    lifecycle: targetLifecycle,
    care_reality_state_id: careRealityStateId,
    updated_at: now,
    last_active_at: now,
  };

  saveIdentity(updated);
  return updated;
}

/**
 * Record a care event for this identity.
 * Automatically transitions from "potential" to "established" on first event,
 * or to "active_care" when events are ongoing.
 */
export function recordCareEvent(
  careRecipientId: string,
): CareIdentityRecord | null {
  const id = resolveCareRealityStoreKey(careRecipientId);
  const record = loadIdentity(id);
  if (!record) return null;

  const now = new Date().toISOString();
  const newCount = record.event_count + 1;

  let lifecycle = record.lifecycle;
  if (lifecycle === "potential") {
    lifecycle = "established";
  }
  if (lifecycle === "established" && newCount >= 2) {
    lifecycle = "active_care";
  }

  const updated: CareIdentityRecord = {
    ...record,
    lifecycle,
    event_count: newCount,
    updated_at: now,
    last_active_at: now,
  };

  saveIdentity(updated);
  return updated;
}

/**
 * Increment session count for this identity (used on return).
 */
export function incrementSessionCount(
  careRecipientId: string,
): CareIdentityRecord | null {
  const id = resolveCareRealityStoreKey(careRecipientId);
  const record = loadIdentity(id);
  if (!record) return null;

  const now = new Date().toISOString();
  const updated: CareIdentityRecord = {
    ...record,
    session_count: record.session_count + 1,
    updated_at: now,
    last_active_at: now,
  };

  saveIdentity(updated);
  return updated;
}

// ─── Query Helpers ────────────────────────────────────────────────────────

/**
 * Get the Care Identity for a specific care recipient.
 */
export function getCareIdentity(
  careRecipientId: string,
): CareIdentityRecord | null {
  const id = resolveCareRealityStoreKey(careRecipientId);
  return loadIdentity(id);
}

/**
 * Get all Care Identities associated with a caregiver.
 * Searches durable storage for all identities matching the caregiver_id.
 */
export function listCareIdentitiesForCaregiver(
  caregiverId: string,
): CareIdentityRecord[] {
  // Check cache first
  const cached: CareIdentityRecord[] = [];
  for (const record of identityCache.values()) {
    if (record.caregiver_id === caregiverId) {
      cached.push(record);
    }
  }
  return cached;
}

/**
 * List all Care Identities (global — for admin/ops).
 */
export function listAllCareIdentities(): CareIdentityRecord[] {
  return [...identityCache.values()];
}

/**
 * Get a summary of the identity for API responses.
 */
export function getCareIdentitySummary(
  careRecipientId: string,
): CareIdentitySummary | null {
  const id = resolveCareRealityStoreKey(careRecipientId);
  const record = loadIdentity(id);
  if (!record) return null;

  return {
    care_recipient_id: record.care_recipient_id,
    display_name: record.display_name,
    relationship: record.relationship,
    lifecycle: record.lifecycle,
    has_active_care:
      record.lifecycle === "active_care" || record.lifecycle === "established",
    last_active_at: record.last_active_at,
  };
}

/**
 * Check if a caregiver is new (no prior identities).
 */
export function isNewCaregiver(caregiverId: string): boolean {
  const identities = listCareIdentitiesForCaregiver(caregiverId);
  if (identities.length === 0) return true;

  // If any identity has active care, the caregiver is returning
  return !identities.some(
    (id) => id.lifecycle === "active_care" || id.lifecycle === "established",
  );
}

/**
 * Check if this is a returning caregiver for a specific care recipient.
 */
export function isReturningCaregiver(
  caregiverId: string,
  careRecipientId: string,
): boolean {
  const id = resolveCareRealityStoreKey(careRecipientId);
  const identity = loadIdentity(id);
  if (!identity) return false;
  if (identity.caregiver_id !== caregiverId) return false;
  return (
    identity.lifecycle === "active_care" ||
    identity.lifecycle === "established" ||
    identity.event_count > 0
  );
}

/**
 * Resolve the care_recipient_id for a caregiver's current identity.
 * Returns the most recently active identity.
 */
export function resolveActiveCareRecipientId(
  caregiverId: string,
): string | null {
  const identities = listCareIdentitiesForCaregiver(caregiverId);
  if (identities.length === 0) return null;

  // Most recently active identity with active care or established
  const sorted = identities
    .filter(
      (id) =>
        id.lifecycle === "active_care" || id.lifecycle === "established",
    )
    .sort(
      (a, b) =>
        new Date(b.last_active_at).getTime() -
        new Date(a.last_active_at).getTime(),
    );

  return sorted[0]?.care_recipient_id ?? null;
}

// ─── Test Helpers ─────────────────────────────────────────────────────────

/**
 * Reset all care identity data (for tests).
 */
export function resetCareIdentityStore(): void {
  identityCache.clear();
  clearDurableDirectory(identityDir());
}

// ─── Care Context Loader (for continuity detection) ──────────────────────

/**
 * Load full care context for a returning caregiver.
 * Gathers CRS state, Care Reality Memory summary, and open questions.
 */
export function loadCareContextForIdentity(params: {
  careRecipientId: string;
  caregiverId: string;
}): ContinuityContext {
  const careRecipientId = resolveCareRealityStoreKey(params.careRecipientId);
  const identity = getCareIdentity(careRecipientId);
  const crs = getCareRealityState(careRecipientId);

  const priorEventsExist = (identity?.event_count ?? 0) > 0;
  const priorDecisionsExist =
    (crs?.current_understanding ?? []).length > 0 &&
    (crs?.understanding_revisions ?? []).length > 0;
  const priorUnknownsExist = (crs?.open_uncertainties ?? []).length > 0;
  const priorObservationsExist = (crs?.observation_count ?? 0) > 0;

  // Determine continuity type
  let continuityType: ContinuityType = "new_caregiver";
  if (!identity) {
    // If no identity exists but caregiver has other identities, it's a new recipient
    const otherIdentities = listCareIdentitiesForCaregiver(params.caregiverId);
    if (otherIdentities.length > 0) {
      continuityType = "new_care_recipient";
    } else {
      continuityType = "new_caregiver";
    }
  } else if (
    identity.caregiver_id === params.caregiverId &&
    priorEventsExist &&
    identity.session_count > 1
  ) {
    continuityType = "returning";
  } else if (
    identity.caregiver_id === params.caregiverId &&
    priorEventsExist
  ) {
    continuityType = "continuation";
  }

  return {
    continuity_type: continuityType,
    identity,
    prior_events_exist: priorEventsExist,
    prior_decisions_exist: priorDecisionsExist,
    prior_unknowns_exist: priorUnknownsExist,
    prior_observations_exist: priorObservationsExist,
    open_uncertainties: crs?.open_uncertainties ?? [],
    continuity_hooks: crs?.continuity_hooks ?? [],
    care_reality_state_summary: crs?.current_understanding ?? null,
    prior_decisions:
      crs?.understanding_revisions
        ?.filter((r) =>
          r.summary.toLowerCase().includes("decision") ||
          r.summary.toLowerCase().includes("decided") ||
          r.summary.toLowerCase().includes("chose"),
        )
        .map((r) => r.summary) ?? [],
  };
}

