import { randomBytes } from "node:crypto";

import { SHARE_DEFAULT_EXCLUDED, SHARE_TOKEN_TTL_HOURS } from "../contract-constants";
import type { CareRecipientProfileData, SharedViewResult } from "../types";
import { generateSummary } from "./tell-once";

const tokenStore = new Map<
  string,
  {
    profile_id: string;
    recipient_label: string;
    scope: Record<string, unknown>;
    included_fields: string[];
    payload: Record<string, unknown>;
    expires_at: string;
  }
>();

export function createShareToken(): string {
  return randomBytes(24).toString("base64url");
}

export type SharedViewScope = {
  window?: "this_week" | "open_items" | "custom";
  [key: string]: unknown;
};

/**
 * Narrow, time-boxed read-only view — financial/medical excluded by default.
 */
export function generateSharedView(
  profileId: string,
  profile: CareRecipientProfileData,
  recipientLabel: string,
  scope: SharedViewScope,
  includedFields: string[] = ["open_items", "how_to_help"],
  ttlHours = SHARE_TOKEN_TTL_HOURS,
): SharedViewResult {
  const token = createShareToken();
  const expires_at = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();

  const excludeFinancial = !includedFields.includes("financial_specifics");
  const excludeMedical = !includedFields.includes("medical_specifics");

  const familySummary = generateSummary(profile, "family_member", scope.window ?? "this_week");

  const payload: Record<string, unknown> = {
    recipient_label: recipientLabel,
    scope,
    for: recipientLabel,
    open_items: profile.tagged_event_log.slice(-5).map((e) => ({
      label: e.tag.replace(/_/g, " "),
      date: e.date.slice(0, 10),
    })),
    how_to_help: [
      "Offer a specific time block this week",
      "Ask what feels heaviest — do not require a full briefing",
    ],
    summary: familySummary.content,
  };

  if (!excludeMedical) {
    payload.conditions = profile.known_conditions;
    payload.medications = profile.current_medications;
  } else {
    payload.medical_note = "Medical specifics excluded unless caregiver added them.";
  }

  if (!excludeFinancial) {
    payload.financial_note = "Financial specifics included at caregiver request.";
  } else {
    payload.financial_note = "Financial specifics excluded by default.";
  }

  tokenStore.set(token, {
    profile_id: profileId,
    recipient_label: recipientLabel,
    scope,
    included_fields: includedFields,
    payload,
    expires_at,
  });

  return {
    token,
    recipient_label: recipientLabel,
    expires_at,
    view_url_path: `/api/cognitive-relief/share/${token}`,
    payload,
  };
}

export function resolveSharedView(token: string): Record<string, unknown> | null {
  const entry = tokenStore.get(token);
  if (!entry) return null;
  if (new Date(entry.expires_at).getTime() < Date.now()) {
    tokenStore.delete(token);
    return null;
  }
  return {
    ...entry.payload,
    expires_at: entry.expires_at,
    read_only: true,
  };
}

export function resetSharedViewStore(): void {
  tokenStore.clear();
}

export { SHARE_DEFAULT_EXCLUDED };
