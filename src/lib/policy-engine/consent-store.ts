import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import { TERMS_OF_SERVICE_VERSION } from "./contract-constants";
import type { ConsentAcceptanceInput, ConsentProfile } from "./types";

const GLOBAL_KEY = "__solenos_consent_profiles__";

type GlobalConsent = typeof globalThis & {
  [GLOBAL_KEY]?: Map<string, ConsentProfile>;
};

function profiles(): Map<string, ConsentProfile> {
  const g = globalThis as GlobalConsent;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = new Map<string, ConsentProfile>();
    loadFromDisk(g[GLOBAL_KEY]);
  }
  return g[GLOBAL_KEY]!;
}

function consentFilePath(): string {
  return join(process.cwd(), ".data", "consent-store.json");
}

function loadFromDisk(map: Map<string, ConsentProfile>): void {
  try {
    const path = consentFilePath();
    if (!existsSync(path)) return;
    const raw = JSON.parse(readFileSync(path, "utf8")) as Record<string, ConsentProfile>;
    for (const [id, profile] of Object.entries(raw)) {
      map.set(id, profile);
    }
  } catch {
    // Non-fatal — in-memory consent still works for the process.
  }
}

function persistToDisk(map: Map<string, ConsentProfile>): void {
  try {
    const dir = join(process.cwd(), ".data");
    mkdirSync(dir, { recursive: true });
    const obj: Record<string, ConsentProfile> = {};
    for (const [id, profile] of map.entries()) {
      obj[id] = profile;
    }
    writeFileSync(consentFilePath(), JSON.stringify(obj, null, 2), "utf8");
  } catch {
    // Non-fatal
  }
}

export function getConsentProfile(userId: string): ConsentProfile | null {
  return profiles().get(userId) ?? null;
}

export function hasValidConsent(userId: string): boolean {
  const profile = profiles().get(userId);
  if (!profile || profile.limited_mode) return false;
  return (
    profile.accepted_terms_version === TERMS_OF_SERVICE_VERSION &&
    profile.medical_disclaimer_acknowledged &&
    profile.privacy_model_acknowledged &&
    profile.multi_caregiver_acknowledged &&
    profile.no_advertising_acknowledged
  );
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
  profiles().set(input.user_id, profile);
  persistToDisk(profiles());
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
  profiles().set(userId, revoked);
  persistToDisk(profiles());
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
  profiles().set(userId, updated);
  persistToDisk(profiles());
  return updated;
}

export function resetConsentStore(): void {
  profiles().clear();
  persistToDisk(profiles());
}
