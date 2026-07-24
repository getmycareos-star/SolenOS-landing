/**
 * Care recipient display identity (MVP).
 * Product SoT: docs/02-product/solenos-mvp-identity-naming.md
 * Ask once → persist display_name → use in caregiver copy. Never silent medical identity.
 */

import {
  livingCareRecordDataDir,
  readDurableJson,
  sanitizeDurableCareKey,
  writeDurableJson,
  clearDurableDirectory,
} from "../living-care-record-persistence/fs-store";

export type CareRecipientIdentity = {
  care_key: string;
  display_name: string;
  relationship?: string | null;
  updated_at: string;
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
  const record: CareRecipientIdentity = {
    care_key: params.careKey,
    display_name,
    relationship: params.relationship ?? null,
    updated_at: new Date().toISOString(),
  };
  memory.set(params.careKey, record);
  writeDurableJson(filePath(params.careKey), record);
  return record;
}

/**
 * Prefer durable display_name from ask-once identity.
 * Never silently infer Mom/Dad/given names from notes into identity (locked A).
 * Neutral fallback — never “Your loved one” (identity naming Locked A).
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
