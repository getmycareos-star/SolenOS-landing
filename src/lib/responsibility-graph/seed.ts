import { createHash } from "node:crypto";
import type { CareProfile } from "../care-profile/types";
import type { Person } from "./types";

function stablePersonId(kind: string, name: string): string {
  const h = createHash("sha256")
    .update(`${kind}::${name.trim().toLowerCase()}`)
    .digest("hex")
    .slice(0, 12);
  return `per_${h}`;
}

function upsertPerson(map: Map<string, Person>, person: Person): void {
  const existing = map.get(person.id);
  if (!existing) {
    map.set(person.id, person);
    return;
  }
  // Prefer more specific name/role when merging duplicates.
  map.set(person.id, {
    ...existing,
    name: person.name.length >= existing.name.length ? person.name : existing.name,
    role: person.role || existing.role,
    relationship: person.relationship || existing.relationship,
  });
}

/**
 * Seed Person nodes from Care Profile relationships.
 * Primary caregiver is always present as an operational owner candidate.
 */
export function seedPersonsFromCareProfile(
  profile: CareProfile | undefined,
  options?: { primaryCaregiverName?: string },
): Person[] {
  const map = new Map<string, Person>();
  const primaryName = options?.primaryCaregiverName?.trim() || "Primary caregiver";

  upsertPerson(map, {
    id: stablePersonId("primary", primaryName),
    name: primaryName,
    role: profile?.roleInCareGraph ?? "primary_caregiver",
    relationship: "self",
  });

  if (!profile) return [...map.values()];

  for (const name of profile.careRelationships.dependents) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    upsertPerson(map, {
      id: stablePersonId("dependent", trimmed),
      name: trimmed,
      role: "dependent",
      relationship: "dependent",
    });
  }

  for (const name of profile.careRelationships.sharedCareWith) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    upsertPerson(map, {
      id: stablePersonId("shared", trimmed),
      name: trimmed,
      role: "shared_caregiver",
      relationship: "shared_care",
    });
  }

  for (const name of profile.careRelationships.externalCaregivers) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    upsertPerson(map, {
      id: stablePersonId("external", trimmed),
      name: trimmed,
      role: "external_caregiver",
      relationship: "external",
    });
  }

  return [...map.values()];
}

export function mergePersons(
  existing: readonly Person[],
  incoming: readonly Person[],
): Person[] {
  const map = new Map<string, Person>();
  for (const p of existing) upsertPerson(map, p);
  for (const p of incoming) upsertPerson(map, p);
  return [...map.values()];
}

export function findPersonByName(
  persons: readonly Person[],
  name: string,
): Person | undefined {
  const key = name.trim().toLowerCase();
  if (!key) return undefined;
  return persons.find((p) => p.name.trim().toLowerCase() === key);
}

export { stablePersonId };
