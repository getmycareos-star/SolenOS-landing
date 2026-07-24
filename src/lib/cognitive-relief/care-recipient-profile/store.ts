import { DEFAULT_CAREGIVER_ID } from "../contract-constants";
import { DEFAULT_PROFILE, type CareRecipientProfileData, type CareRecipientProfileRecord } from "../types";

const profiles = new Map<string, CareRecipientProfileRecord>();
const caregiverIndex = new Map<string, string>();

function profileKey(caregiverId: string, caseId: string | null): string {
  return `${caregiverId}::${caseId ?? "default"}`;
}

export function createProfileId(): string {
  return `crp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function getOrCreateProfile(params: {
  caregiver_id?: string;
  case_id?: string | null;
}): CareRecipientProfileRecord {
  const caregiverId = params.caregiver_id ?? DEFAULT_CAREGIVER_ID;
  const caseId = params.case_id ?? null;
  const key = profileKey(caregiverId, caseId);

  const existingId = caregiverIndex.get(key);
  if (existingId) {
    const found = profiles.get(existingId);
    if (found) return found;
  }

  const now = new Date().toISOString();
  const record: CareRecipientProfileRecord = {
    id: createProfileId(),
    case_id: caseId,
    caregiver_id: caregiverId,
    profile: { ...DEFAULT_PROFILE, tagged_event_log: [], location_index: [] },
    care_context: "general",
    dementia_context: null,
    last_checkin_at: null,
    checkin_period: null,
    optional_budget: null,
    created_at: now,
    updated_at: now,
  };

  profiles.set(record.id, record);
  caregiverIndex.set(key, record.id);
  return record;
}

export function getProfileById(id: string): CareRecipientProfileRecord | undefined {
  return profiles.get(id);
}

export function updateProfileData(
  id: string,
  updater: (profile: CareRecipientProfileData) => CareRecipientProfileData,
): CareRecipientProfileRecord | undefined {
  const record = profiles.get(id);
  if (!record) return undefined;

  const updated: CareRecipientProfileRecord = {
    ...record,
    profile: updater(record.profile),
    updated_at: new Date().toISOString(),
  };
  profiles.set(id, updated);
  return updated;
}

export function patchProfileRecord(
  id: string,
  patch: Partial<
    Pick<
      CareRecipientProfileRecord,
      "last_checkin_at" | "checkin_period" | "optional_budget" | "care_context" | "dementia_context"
    >
  >,
): CareRecipientProfileRecord | undefined {
  const record = profiles.get(id);
  if (!record) return undefined;
  const updated = { ...record, ...patch, updated_at: new Date().toISOString() };
  profiles.set(id, updated);
  return updated;
}

export function resetCareRecipientProfileStore(): void {
  profiles.clear();
  caregiverIndex.clear();
}

export const careRecipientProfileSchema = {
  table: "care_recipient_profiles",
  columns: [
    "id",
    "case_id",
    "caregiver_id",
    "profile",
    "last_checkin_at",
    "checkin_period",
    "optional_budget",
    "care_context",
    "dementia_context",
    "created_at",
    "updated_at",
  ] as const,
};
