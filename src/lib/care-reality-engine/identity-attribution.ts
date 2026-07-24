/**
 * Phase 1 — Care Recipient Identity + Contributor attribution.
 * Never assume kinship words name a specific person. Never auto-merge people.
 */

import {
  getCareRecipientDisplayName,
  getCareRecipientIdentity,
  setCareRecipientDisplayName,
  type CareRecipientIdentity,
} from "../care-recipient-identity";

export type CareRecipientRecord = {
  id: string;
  displayName: string | null;
  relationship: string | null;
  createdAt: string;
  createdBy: string;
};

export type ContributorRecord = {
  id: string;
  name: string | null;
  relationship: string | null;
  role: "contributor" | "observer" | "care_professional";
};

export type IdentityAttributionResult = {
  care_recipient: CareRecipientRecord;
  contributor: ContributorRecord;
  /** True when display identity is not yet set — soft invite, never invent Mom/Dad. */
  needs_recipient_clarification: boolean;
  attribution_ready: boolean;
};

/**
 * Kinship / role words in notes are not medical identity.
 * Detection only — never write them into CareRecipient.displayName.
 */
export function noteMentionsUnboundKinshipLabel(rawText: string): boolean {
  return /\b(mom|mum|mother|dad|father|wife|husband|partner|grandma|grandpa|grandmother|grandfather)\b/i.test(
    rawText,
  );
}

export function resolveIdentityAttribution(params: {
  careRecipientId: string;
  contributorId: string;
  contributorName?: string | null;
  rawText?: string;
  nowIso?: string;
}): IdentityAttributionResult {
  const now = params.nowIso ?? new Date().toISOString();
  const existing = getCareRecipientIdentity(params.careRecipientId);
  const displayName = getCareRecipientDisplayName(params.careRecipientId);

  const care_recipient: CareRecipientRecord = {
    id: params.careRecipientId,
    displayName,
    relationship: existing?.relationship ?? null,
    createdAt: existing?.updated_at ?? now,
    createdBy: params.contributorId,
  };

  const contributor: ContributorRecord = {
    id: params.contributorId,
    name: params.contributorName ?? null,
    relationship: null,
    role: "contributor",
  };

  const needs_recipient_clarification =
    !displayName &&
    (!!params.rawText?.trim() && noteMentionsUnboundKinshipLabel(params.rawText));

  return {
    care_recipient,
    contributor,
    needs_recipient_clarification,
    attribution_ready: true,
  };
}

export function ensureCareRecipientNamed(params: {
  careRecipientId: string;
  displayName: string;
  relationship?: string | null;
}): CareRecipientIdentity {
  return setCareRecipientDisplayName({
    careKey: params.careRecipientId,
    displayName: params.displayName,
    relationship: params.relationship,
  });
}
