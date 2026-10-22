import {
  DEFAULT_CAREGIVER_SELF_PROFILE,
  type CaregiverSelfProfileData,
  type CaregiverSelfProfileRecord,
  type ResolvedItemRecord,
  type CapacityLevel,
} from "../types";

const profiles = new Map<string, CaregiverSelfProfileRecord>();

function cloneProfileData(profile: CaregiverSelfProfileData): CaregiverSelfProfileData {
  return {
    caregiver_basics: profile.caregiver_basics,
    known_conditions: [...profile.known_conditions],
    current_medications: [...profile.current_medications],
    key_dates: profile.key_dates.map((item) => ({ ...item })),
    care_team: profile.care_team.map((item) => ({ ...item })),
    tagged_event_log: profile.tagged_event_log.map((item) => ({ ...item })),
    open_item_descriptions: [...profile.open_item_descriptions],
  };
}

function cloneRecord(record: CaregiverSelfProfileRecord): CaregiverSelfProfileRecord {
  return { ...record, profile: cloneProfileData(record.profile), resolved_items: record.resolved_items.map((item) => ({ ...item })) };
}

export function createCaregiverSelfProfileId(): string {
  return `csp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function getOrCreateCaregiverSelfProfile(caregiverId: string): CaregiverSelfProfileRecord {
  const normalizedId = caregiverId?.trim();
  if (!normalizedId || normalizedId === "default_caregiver") throw new Error("Valid caregiver identity is required.");
  caregiverId = normalizedId;
  const existing = profiles.get(caregiverId);
  if (existing) return cloneRecord(existing);

  const now = new Date().toISOString();
  const record: CaregiverSelfProfileRecord = {
    id: createCaregiverSelfProfileId(),
    caregiver_id: caregiverId,
    profile: cloneProfileData(DEFAULT_CAREGIVER_SELF_PROFILE),
    session_capacity: null,
    resolved_items: [],
    created_at: now,
    updated_at: now,
  };
  profiles.set(caregiverId, cloneRecord(record));
  return cloneRecord(record);
}

export function updateCaregiverSelfProfile(
  caregiverId: string,
  updater: (profile: CaregiverSelfProfileData) => CaregiverSelfProfileData,
): CaregiverSelfProfileRecord | undefined {
  const record = getOrCreateCaregiverSelfProfile(caregiverId);
  const updated: CaregiverSelfProfileRecord = {
    ...record,
    profile: cloneProfileData(updater(cloneProfileData(record.profile))),
    resolved_items: record.resolved_items.map((item) => ({ ...item })),
    updated_at: new Date().toISOString(),
  };
  profiles.set(caregiverId, cloneRecord(updated));
  return cloneRecord(updated);
}

export function setSessionCapacity(
  caregiverId: string,
  capacity: CapacityLevel,
): CaregiverSelfProfileRecord {
  const record = getOrCreateCaregiverSelfProfile(caregiverId);
  const updated = {
    ...record,
    session_capacity: capacity,
    updated_at: new Date().toISOString(),
  };
  profiles.set(caregiverId, cloneRecord(updated));
  return cloneRecord(updated);
}

export function addResolvedItem(
  caregiverId: string,
  item: ResolvedItemRecord,
): CaregiverSelfProfileRecord {
  const record = getOrCreateCaregiverSelfProfile(caregiverId);
  const updated = {
    ...record,
    resolved_items: [...record.resolved_items, item].slice(-200),
    updated_at: new Date().toISOString(),
  };
  profiles.set(caregiverId, updated);
  return updated;
}

export function replaceCaregiverSelfProfileRecord(record: CaregiverSelfProfileRecord): void {
  const caregiverId = record.caregiver_id?.trim();
  if (!caregiverId || caregiverId === "default_caregiver") {
    throw new Error("Valid caregiver identity is required.");
  }
  if (!record.id || !record.profile || !Array.isArray(record.resolved_items)) {
    throw new Error("A complete caregiver profile record is required.");
  }
  profiles.set(caregiverId, cloneRecord(record));
}

export function resetCaregiverSelfProfileStore(): void {
  profiles.clear();
}
