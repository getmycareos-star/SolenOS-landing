import type { Case } from "../types";

const casesById = new Map<string, Case>();
/** Lookup by normalized display/relationship key → caseId */
const aliasIndex = new Map<string, string>();

function normalizeAlias(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function resetCaseStore(): void {
  casesById.clear();
  aliasIndex.clear();
}

export function getCase(caseId: string): Case | undefined {
  return casesById.get(caseId);
}

export function upsertCase(caseEntity: Case): Case {
  const next = { ...caseEntity, updatedAt: new Date().toISOString() };
  casesById.set(next.id, next);
  indexAliases(next);
  return next;
}

function indexAliases(caseEntity: Case): void {
  const keys = [
    caseEntity.profile.displayName,
    caseEntity.profile.preferredName,
    caseEntity.profile.relationship,
  ].filter((v): v is string => Boolean(v && v.trim()));

  for (const key of keys) {
    aliasIndex.set(normalizeAlias(key), caseEntity.id);
  }
}

export function findCaseByAlias(alias: string): Case | undefined {
  const id = aliasIndex.get(normalizeAlias(alias));
  return id ? casesById.get(id) : undefined;
}

export function listCases(): readonly Case[] {
  return [...casesById.values()];
}

export function createCaseId(seed?: string): string {
  const base = (seed ?? "case").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `case_${base || "unknown"}_${Date.now().toString(36)}`;
}

export function createEmptyCase(params: {
  displayName: string;
  relationship?: string;
  createdAt?: string;
}): Case {
  const now = params.createdAt ?? new Date().toISOString();
  const id = createCaseId(params.displayName || params.relationship || "care-recipient");
  return {
    id,
    profile: {
      displayName: params.displayName,
      relationship: params.relationship,
      preferredName: params.displayName,
    },
    status: "active",
    createdAt: now,
    updatedAt: now,
    conditions: [],
    medications: [],
    providers: [],
    facilities: [],
    documents: [],
    familyContext: {},
    understanding: {
      summary: `${params.displayName} case opened.`,
      activePatterns: [],
      successfulInterventions: [],
      openRisks: [],
      updatedAt: now,
    },
    situationIds: [],
  };
}
