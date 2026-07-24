/**
 * Family Memory Layer — persistent continuity facade.
 * Bridges care-profile (people/relationships) + memory-influence (patterns)
 * + observation-intelligence (care events) into strategic FamilyMemory.
 */

import type { CareProfile } from "../care-profile/types";
import type { Person as ResponsibilityPerson } from "../responsibility-graph/types";
import type { MemoryInfluenceEntry } from "../memory-influence/types";

export type FamilyPerson = {
  id: string;
  name: string;
  role: string;
  relationship: string;
};

export type Relationship = {
  fromId: string;
  toId: string;
  kind: "depends_on" | "supports" | "shares_care_with" | "external_caregiver";
  label?: string;
};

export type CareEvent = {
  id: string;
  kind: string;
  summary: string;
  personIds: string[];
  timestamp: string;
  source: "analyze" | "observation" | "profile" | "manual";
};

export type Pattern = {
  id: string;
  label: string;
  occurrenceCount: number;
  confidence: number;
  category?: string;
  updatedAt: string;
};

/** Strategic moat type — accumulated family continuity. */
export type FamilyMemory = {
  people: FamilyPerson[];
  relationships: Relationship[];
  historicalEvents: CareEvent[];
  recurringPatterns: Pattern[];
};

export type FamilyMemoryPersistenceAdapter = {
  upsertPeople(scopeId: string, people: FamilyPerson[]): Promise<void>;
  upsertRelationships(scopeId: string, relationships: Relationship[]): Promise<void>;
  appendEvents(scopeId: string, events: CareEvent[]): Promise<void>;
  upsertPatterns(scopeId: string, patterns: Pattern[]): Promise<void>;
  loadFamilyMemory(scopeId: string): Promise<FamilyMemory | null>;
};

type ScopeBucket = {
  people: Map<string, FamilyPerson>;
  relationships: Map<string, Relationship>;
  events: CareEvent[];
  patterns: Map<string, Pattern>;
};

const buckets = new Map<string, ScopeBucket>();

const noopPersistence: FamilyMemoryPersistenceAdapter = {
  async upsertPeople() {},
  async upsertRelationships() {},
  async appendEvents() {},
  async upsertPatterns() {},
  async loadFamilyMemory() {
    return null;
  },
};

let persistence: FamilyMemoryPersistenceAdapter = noopPersistence;

function emptyBucket(): ScopeBucket {
  return {
    people: new Map(),
    relationships: new Map(),
    events: [],
    patterns: new Map(),
  };
}

function getBucket(scopeId: string): ScopeBucket {
  let b = buckets.get(scopeId);
  if (!b) {
    b = emptyBucket();
    buckets.set(scopeId, b);
  }
  return b;
}

function relKey(r: Relationship): string {
  return `${r.fromId}|${r.toId}|${r.kind}`;
}

export function setFamilyMemoryPersistence(
  adapter: FamilyMemoryPersistenceAdapter,
): void {
  persistence = adapter;
}

export function createEmptyFamilyMemory(): FamilyMemory {
  return {
    people: [],
    relationships: [],
    historicalEvents: [],
    recurringPatterns: [],
  };
}

export function upsertFamilyPerson(scopeId: string, person: FamilyPerson): void {
  getBucket(scopeId).people.set(person.id, person);
}

export function upsertRelationship(scopeId: string, relationship: Relationship): void {
  getBucket(scopeId).relationships.set(relKey(relationship), relationship);
}

export function appendCareEvent(scopeId: string, event: CareEvent): void {
  const b = getBucket(scopeId);
  b.events.push(event);
  if (b.events.length > 500) {
    b.events.splice(0, b.events.length - 500);
  }
}

export function upsertPattern(scopeId: string, pattern: Pattern): void {
  const b = getBucket(scopeId);
  const existing = b.patterns.get(pattern.id);
  if (existing) {
    b.patterns.set(pattern.id, {
      ...existing,
      ...pattern,
      occurrenceCount: Math.max(existing.occurrenceCount, pattern.occurrenceCount),
      confidence: Math.max(existing.confidence, pattern.confidence),
      updatedAt: pattern.updatedAt,
    });
  } else {
    b.patterns.set(pattern.id, pattern);
  }
}

export function getFamilyMemory(scopeId: string): FamilyMemory {
  const b = getBucket(scopeId);
  return {
    people: [...b.people.values()],
    relationships: [...b.relationships.values()],
    historicalEvents: [...b.events],
    recurringPatterns: [...b.patterns.values()],
  };
}

/**
 * Seed / merge from existing care-profile + responsibility-graph people.
 * Does not replace canonical stores — compounds into Family Memory.
 */
export function bridgeFromCareProfile(
  scopeId: string,
  profile: CareProfile | null | undefined,
  persons: readonly ResponsibilityPerson[] = [],
): FamilyMemory {
  for (const p of persons) {
    upsertFamilyPerson(scopeId, {
      id: p.id,
      name: p.name,
      role: p.role,
      relationship: p.relationship,
    });
  }

  if (profile) {
    const selfId = "primary_caregiver";
    upsertFamilyPerson(scopeId, {
      id: selfId,
      name: "Primary caregiver",
      role: profile.roleInCareGraph,
      relationship: "self",
    });

    for (const dep of profile.careRelationships.dependents) {
      const id = `dep:${dep.toLowerCase()}`;
      upsertFamilyPerson(scopeId, {
        id,
        name: dep,
        role: "dependent",
        relationship: "dependent",
      });
      upsertRelationship(scopeId, {
        fromId: id,
        toId: selfId,
        kind: "depends_on",
        label: `${dep} depends on primary caregiver`,
      });
    }

    for (const shared of profile.careRelationships.sharedCareWith) {
      const id = `shared:${shared.toLowerCase()}`;
      upsertFamilyPerson(scopeId, {
        id,
        name: shared,
        role: "shared_caregiver",
        relationship: "family",
      });
      upsertRelationship(scopeId, {
        fromId: selfId,
        toId: id,
        kind: "shares_care_with",
      });
    }

    for (const ext of profile.careRelationships.externalCaregivers) {
      const id = `ext:${ext.toLowerCase()}`;
      upsertFamilyPerson(scopeId, {
        id,
        name: ext,
        role: "external_caregiver",
        relationship: "professional",
      });
      upsertRelationship(scopeId, {
        fromId: selfId,
        toId: id,
        kind: "external_caregiver",
      });
    }
  }

  return getFamilyMemory(scopeId);
}

/** Bridge memory-influence pattern entries into recurring Patterns. */
export function bridgeFromMemoryInfluence(
  scopeId: string,
  entries: readonly MemoryInfluenceEntry[],
): void {
  const now = new Date().toISOString();
  for (const e of entries) {
    upsertPattern(scopeId, {
      id: e.id || e.key,
      label: e.influenceLabel,
      occurrenceCount: e.occurrenceCount,
      confidence: e.confidence,
      category: e.key,
      updatedAt: e.updatedAt || now,
    });
  }
}

export async function persistFamilyMemory(scopeId: string): Promise<void> {
  const mem = getFamilyMemory(scopeId);
  await persistence.upsertPeople(scopeId, mem.people);
  await persistence.upsertRelationships(scopeId, mem.relationships);
  await persistence.appendEvents(scopeId, mem.historicalEvents.slice(-20));
  await persistence.upsertPatterns(scopeId, mem.recurringPatterns);
}

export function resetFamilyMemoryStore(scopeId?: string): void {
  if (scopeId) buckets.delete(scopeId);
  else buckets.clear();
}
