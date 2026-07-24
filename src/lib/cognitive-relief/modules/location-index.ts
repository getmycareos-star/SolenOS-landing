import type { CareRecipientProfileData, LocationIndexEntry } from "../types";

export function upsertLocation(
  index: LocationIndexEntry[],
  entry: Omit<LocationIndexEntry, "last_confirmed"> & { last_confirmed?: string },
): LocationIndexEntry[] {
  const now = entry.last_confirmed ?? new Date().toISOString();
  const labelKey = entry.label.toLowerCase().trim();
  const without = index.filter((i) => i.label.toLowerCase().trim() !== labelKey);
  return [...without, { ...entry, last_confirmed: now }];
}

export function removeLocation(index: LocationIndexEntry[], label: string): LocationIndexEntry[] {
  const key = label.toLowerCase().trim();
  return index.filter((i) => i.label.toLowerCase().trim() !== key);
}

export function getLocation(index: LocationIndexEntry[], label: string): LocationIndexEntry | undefined {
  const key = label.toLowerCase().trim();
  return index.find((i) => i.label.toLowerCase().trim() === key);
}

/** Pinned quick-access defaults for 11pm lookup — caregiver can edit. */
export const DEFAULT_LOCATION_HINTS: Omit<LocationIndexEntry, "last_confirmed">[] = [
  { label: "POA paperwork", physical_or_digital_location: "Not yet recorded — add where it lives" },
  { label: "Insurance cards", physical_or_digital_location: "Not yet recorded — add where it lives" },
  { label: "Medication list", physical_or_digital_location: "Not yet recorded — add where it lives" },
];

export function ensureDefaultLocations(profile: CareRecipientProfileData): CareRecipientProfileData {
  let index = [...profile.location_index];
  for (const hint of DEFAULT_LOCATION_HINTS) {
    if (!getLocation(index, hint.label)) {
      index = upsertLocation(index, { ...hint, last_confirmed: new Date(0).toISOString() });
    }
  }
  return { ...profile, location_index: index };
}
