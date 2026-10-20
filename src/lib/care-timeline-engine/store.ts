import type { CareRecord } from "./types";

const records = new Map<string, CareRecord>();

export function getStoredCareRecord(patientId: string): CareRecord | null {
  return records.get(patientId) ?? null;
}

export function storeCareRecord(record: CareRecord): CareRecord {
  records.set(record.patient_id, record);
  return record;
}

export function resetCareTimelineStore(): void {
  records.clear();
}
