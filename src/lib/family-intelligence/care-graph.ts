/**
 * Care Graph — living responsibility graph facade.
 * Unifies responsibility-graph (nodes/ownership) + care-profile relationships.
 */

import type {
  Person,
  Responsibility,
  ResponsibilityGraphState,
  ResponsibilityLoad,
} from "../responsibility-graph/types";
import type { CareProfile } from "../care-profile/types";
import {
  bridgeFromCareProfile,
  getFamilyMemory,
  type FamilyPerson,
} from "./family-memory";

export type ResponsibilityRelationship = {
  fromId: string;
  toId: string;
  /** Who depends on / supports / creates or absorbs workload. */
  kind: "depends_on" | "supports" | "owns_responsibility" | "absorbs_workload";
  responsibilityId?: string;
  demandId?: string;
  workloadScore?: number;
  label?: string;
};

export type CareGraph = {
  nodes: FamilyPerson[];
  edges: ResponsibilityRelationship[];
};

type ScopeEdges = Map<string, ResponsibilityRelationship>;

const edgesByScope = new Map<string, ScopeEdges>();

function edgeKey(e: ResponsibilityRelationship): string {
  return `${e.fromId}|${e.toId}|${e.kind}|${e.responsibilityId ?? ""}|${e.demandId ?? ""}`;
}

function getEdges(scopeId: string): ScopeEdges {
  let m = edgesByScope.get(scopeId);
  if (!m) {
    m = new Map();
    edgesByScope.set(scopeId, m);
  }
  return m;
}

export function upsertCareGraphEdge(
  scopeId: string,
  edge: ResponsibilityRelationship,
): void {
  getEdges(scopeId).set(edgeKey(edge), edge);
}

export function getCareGraph(scopeId: string): CareGraph {
  const memory = getFamilyMemory(scopeId);
  return {
    nodes: memory.people,
    edges: [...(edgesByScope.get(scopeId)?.values() ?? [])],
  };
}

/**
 * Bridge responsibility-graph STATE into CareGraph edges.
 * Does not mutate responsibility-graph — compounds into facade store.
 */
export function bridgeFromResponsibilityGraph(
  scopeId: string,
  state: ResponsibilityGraphState,
  loads: readonly ResponsibilityLoad[] = [],
  profile?: CareProfile | null,
): CareGraph {
  bridgeFromCareProfile(scopeId, profile ?? null, state.persons);

  const loadByPerson = new Map(loads.map((l) => [l.personId, l]));

  for (const r of state.responsibilities) {
    upsertCareGraphEdge(scopeId, {
      fromId: r.ownerId,
      toId: r.demandId,
      kind: "owns_responsibility",
      responsibilityId: r.id,
      demandId: r.demandId,
      workloadScore: loadByPerson.get(r.ownerId)?.loadScore,
      label: `owns responsibility ${r.id}`,
    });

    const load = loadByPerson.get(r.ownerId);
    if (load?.overloaded) {
      upsertCareGraphEdge(scopeId, {
        fromId: r.ownerId,
        toId: r.demandId,
        kind: "absorbs_workload",
        responsibilityId: r.id,
        demandId: r.demandId,
        workloadScore: load.loadScore,
        label: "absorbs concentrated workload",
      });
    }
  }

  // Support edges among people who share care (from profile relationships already in memory).
  const memory = getFamilyMemory(scopeId);
  for (const rel of memory.relationships) {
    if (rel.kind === "shares_care_with" || rel.kind === "supports") {
      upsertCareGraphEdge(scopeId, {
        fromId: rel.fromId,
        toId: rel.toId,
        kind: "supports",
        label: rel.label,
      });
    }
    if (rel.kind === "depends_on") {
      upsertCareGraphEdge(scopeId, {
        fromId: rel.fromId,
        toId: rel.toId,
        kind: "depends_on",
        label: rel.label,
      });
    }
  }

  return getCareGraph(scopeId);
}

export function personsToFamilyNodes(
  persons: readonly Person[],
): FamilyPerson[] {
  return persons.map((p) => ({
    id: p.id,
    name: p.name,
    role: p.role,
    relationship: p.relationship,
  }));
}

export function responsibilitiesToEdges(
  responsibilities: readonly Responsibility[],
): ResponsibilityRelationship[] {
  return responsibilities.map((r) => ({
    fromId: r.ownerId,
    toId: r.demandId,
    kind: "owns_responsibility" as const,
    responsibilityId: r.id,
    demandId: r.demandId,
  }));
}

export type CareGraphPersistenceAdapter = {
  upsertEdges(scopeId: string, edges: ResponsibilityRelationship[]): Promise<void>;
  loadEdges(scopeId: string): Promise<ResponsibilityRelationship[]>;
};

const noopPersistence: CareGraphPersistenceAdapter = {
  async upsertEdges() {},
  async loadEdges() {
    return [];
  },
};

let persistence: CareGraphPersistenceAdapter = noopPersistence;

export function setCareGraphPersistence(adapter: CareGraphPersistenceAdapter): void {
  persistence = adapter;
}

export async function persistCareGraph(scopeId: string): Promise<void> {
  await persistence.upsertEdges(scopeId, getCareGraph(scopeId).edges);
}

export function resetCareGraphStore(scopeId?: string): void {
  if (scopeId) edgesByScope.delete(scopeId);
  else edgesByScope.clear();
}
