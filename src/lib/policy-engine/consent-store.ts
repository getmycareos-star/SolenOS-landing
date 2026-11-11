import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { ConsentAcceptanceInput, ConsentProfile } from "./types";

const GLOBAL_KEY = "__solenos_consent_profiles__";

type GlobalConsent = typeof globalThis & {
  [GLOBAL_KEY]?: Map<string, ConsentProfile>;
};

function consentFilePath(): string {
  return join(process.cwd(), ".data", "consent-store.json");
}

/**
 * Legacy policy-engine cache only.
 *
 * Production caregiver consent is authoritative in the FastAPI PostgreSQL
 * caregiver_consents ledger. This process-local cache must never be treated as
 * proof of durable production consent or used as a substitute for the API.
 */
function loadFromDisk(map: Map<string, ConsentProfile>): void {
  const path = consentFilePath();
  if (!existsSync(path)) return;

  // Corrupt/unreadable consent state must fail closed rather than silently
  // creating an empty cache that can later be mistaken for a successful write.
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Legacy consent cache has an invalid format");
  }
  for (const [id, profile] of Object.entries(parsed as Record<string, ConsentProfile>)) {
    if (!profile || typeof profile !== "object" || profile.user_id !== id) {
      throw new Error("Legacy consent cache contains an invalid caregiver profile");
    }
    map.set(id, profile);
  }
}

function profiles(): Map<string, ConsentProfile> {
  const g = globalThis as GlobalConsent;
  if (!g[GLOBAL_KEY]) {
    const cache = new Map<string, ConsentProfile>();
    loadFromDisk(cache);
    g[GLOBAL_KEY] = cache;
  }
  return g[GLOBAL_KEY]!;
}

function persistToDisk(map: Map<string, ConsentProfile>): void {
  const dir = join(process.cwd(), ".data");
  mkdirSync(dir, { recursive: true });
  const obj: Record<string, ConsentProfile> = {};
  for (const [id, profile] of map.entries()) obj[id] = profile;

  const path = consentFilePath();
  const temporaryPath = `${path}.${process.pid}.tmp`;
  try {
    writeFileSync(temporaryPath, JSON.stringify(obj, null, 2), { encoding: "utf8", flag: "w" });
    renameSync(temporaryPath, path);
  } catch (error) {
    throw new Error("Consent cache persistence failed; consent was not updated", { cause: error });
  }
}

/** Persist the candidate snapshot before changing the in-memory view. */
function commitProfiles(update: (candidate: Map<string, ConsentProfile>) => void): void {
  const current = profiles();
  const candidate = new Map(current);
  update(candidate);
  persistToDisk(candidate);
  current.clear();
  for (const [id, profile] of candidate) current.set(id, profile);
}

/**
 * The synchronous legacy policy engine cannot query the authenticated
 * PostgreSQL consent endpoint. Therefore its local cache is never proof of
 * consent. Until a caller supplies server-verified consent, all policy reads
 * fail closed. The caregiver-facing consent UI uses /api/v1/consent directly.
 */
export function getConsentProfile(_userId: string): ConsentProfile | null {
  return null;
}

export function hasValidConsent(_userId: string): boolean {
  return false;
}

export function acceptConsent(input: ConsentAcceptanceInput): ConsentProfile {
  const profile: ConsentProfile = {
    user_id: input.user_id,
    accepted_terms_version: input.accepted_terms_version,
    medical_disclaimer_acknowledged: input.medical_disclaimer_acknowledged,
    privacy_model_acknowledged: input.privacy_model_acknowledged,
    multi_caregiver_acknowledged: input.multi_caregiver_acknowledged,
    data_improvement_consent: input.data_improvement_consent,
    no_advertising_acknowledged: input.no_advertising_acknowledged,
    timestamp: new Date().toISOString(),
    limited_mode: false,
  };
  commitProfiles((candidate) => candidate.set(input.user_id, profile));
  return profile;
}

export function revokeConsent(userId: string): ConsentProfile | null {
  const existing = profiles().get(userId);
  if (!existing) return null;
  const revoked: ConsentProfile = {
    ...existing,
    limited_mode: true,
    data_improvement_consent: false,
    timestamp: new Date().toISOString(),
  };
  commitProfiles((candidate) => candidate.set(userId, revoked));
  return revoked;
}

export function updateDataImprovementConsent(
  userId: string,
  dataImprovementConsent: boolean,
): ConsentProfile | null {
  const existing = profiles().get(userId);
  if (!existing || existing.limited_mode) return null;
  const updated: ConsentProfile = {
    ...existing,
    data_improvement_consent: dataImprovementConsent,
    timestamp: new Date().toISOString(),
  };
  commitProfiles((candidate) => candidate.set(userId, updated));
  return updated;
}

export function resetConsentStore(): void {
  commitProfiles((candidate) => candidate.clear());
}
