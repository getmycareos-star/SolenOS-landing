import { DEFAULT_CAREGIVER_ID } from "../contract-constants";
import {
  DEFAULT_CAREGIVER_SELF_PROFILE,
  type CaregiverSelfProfileData,
  type CaregiverSelfProfileRecord,
  type ResolvedItemRecord,
  type CapacityLevel,
} from "../types";

const profiles = new Map<string, CaregiverSelfProfileRecord>();

export function createCaregiverSelfProfileId(): string {
  return `csp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function getOrCreateCaregiverSelfProfile(caregiverId = DEFAULT_CAREGIVER_ID): CaregiverSelfProfileRecord {
  const existing = profiles.get(caregiverId);
  if (existing) return existing;

  const now = new Date().toISOString();
  const record: CaregiverSelfProfileRecord = {
    id: createCaregiverSelfProfileId(),
    caregiver_id: caregiverId,
    profile: { ...DEFAULT_CAREGIVER_SELF_PROFILE },
    session_capacity: null,
    resolved_items: [],
    created_at: now,
    updated_at: now,
  };
  profiles.set(caregiverId, record);
  return record;
}

export function updateCaregiverSelfProfile(
  caregiverId: string,
  updater: (profile: CaregiverSelfProfileData) => CaregiverSelfProfileData,
): CaregiverSelfProfileRecord | undefined {
  const record = getOrCreateCaregiverSelfProfile(caregiverId);
  const updated: CaregiverSelfProfileRecord = {
    ...record,
    profile: updater(record.profile),
    updated_at: new Date().toISOString(),
  };
  profiles.set(caregiverId, updated);
  return updated;
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
  profiles.set(caregiverId, updated);
  return updated;
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

export function resetCaregiverSelfProfileStore(): void {
  profiles.clear();
}
