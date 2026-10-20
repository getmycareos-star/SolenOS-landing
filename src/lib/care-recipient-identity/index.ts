/**
 * Care recipient display identity (MVP).
 * Product SoT: docs/02-product/solenos-mvp-identity-naming.md
 * Ask once → persist display_name → use in caregiver copy. Never silent medical identity.
 * 
 * Now backed by canonical Person entity model for proper identity management.
 */

import {
  livingCareRecordDataDir,
  readDurableJson,
  sanitizeDurableCareKey,
  writeDurableJson,
  clearDurableDirectory,
} from "../living-care-record-persistence/fs-store";
import { createPerson, addPersonAlias, findPersonByAlias, assignRole, getPerson, resetEntityStore } from "../entities/store";

export type CareRecipientIdentity = {
  care_key: string;
  display_name: string;
  relationship?: string | null;
  updated_at: string;
  person_id?: string | null;
};

const memory = new Map<string, CareRecipientIdentity>();

function filePath(careKey: string): string {
  return livingCareRecordDataDir(
    "care-recipient-identity",
    `${sanitizeDurableCareKey(careKey)}.json`,
  );
}

export function getCareRecipientIdentity(careKey: string): CareRecipientIdentity | null {
  const cached = memory.get(careKey);
  if (cached) return cached;
  const durable = readDurableJson<CareRecipientIdentity>(filePath(careKey));
  if (durable?.display_name?.trim()) {
    memory.set(careKey, durable);
    return durable;
  }
  return null;
}

export function getCareRecipientDisplayName(careKey: string): string | null {
  const id = getCareRecipientIdentity(careKey);
  const name = id?.display_name?.trim();
  return name || null;
}

/** Ask-once set / rename later. Display label only — not medical identity. */
export function setCareRecipientDisplayName(params: {
  careKey: string;
  displayName: string;
  relationship?: string | null;
}): CareRecipientIdentity {
  const display_name = params.displayName.trim().slice(0, 80);
  if (!display_name) {
    throw new Error("Display name is required");
  }
  // Avoid case-file language as the chosen name.
  const banned = /^(the patient|the subject|the individual|your loved one)$/i;
  if (banned.test(display_name)) {
    throw new Error("Choose a personal name (e.g. Mom, Dad, or a given name)");
  }

  // Try to find existing person by alias first
  let person = findPersonByAlias(display_name);
  let personId = person?.id ?? null;

  if (!personId) {
    // Create canonical Person entity
    person = createPerson({
      display_name,
      preferred_name: display_name,
      identity_confidence: "probable",
      created_by: params.careKey,
      source: "user_input",
      provenance: `Care recipient display name set: ${display_name}`,
    });
    personId = person.id;

    // Add display name as primary alias
    addPersonAlias({
      person_id: personId,
      alias: display_name,
      alias_type: "preferred",
      confidence: "high",
      is_primary: true,
      source: "user_input",
      provenance: "Initial display name",
    });

    // Assign care_recipient role
    assignRole({
      person_id: personId,
      role_type: "care_recipient",
      is_primary: true,
      confidence: "probable",
      evidence: [`Display name: ${display_name}`],
      source: "user_input",
      provenance: "Care recipient identity assignment",
      created_by: params.careKey,
    });
  }

  const record: CareRecipientIdentity = {
    care_key: params.careKey,
    display_name,
    relationship: params.relationship ?? null,
    updated_at: new Date().toISOString(),
    person_id: personId,
  };

  memory.set(params.careKey, record);
  writeDurableJson(filePath(params.careKey), record);
  return record;
}

/**
 * Prefer durable display_name from ask-once identity.
 * Never silently infer Mom/Dad/given names from notes into identity (locked A).
 * Neutral fallback — never "Your loved one" (identity naming Locked A).
 */
export function resolveSubjectLabel(params: {
  careKey: string;
  rawText?: string;
}): string {
  const display = getCareRecipientDisplayName(params.careKey);
  if (display) return display;
  void params.rawText;
  return "they";
}

export function resetCareRecipientIdentityStore(): void {
  memory.clear();
  clearDurableDirectory(livingCareRecordDataDir("care-recipient-identity"));
}

// Backward-compatible reset that also clears entity store
export function resetAllEntityStores(): void {
  resetCareRecipientIdentityStore();
  resetEntityStore();
}
