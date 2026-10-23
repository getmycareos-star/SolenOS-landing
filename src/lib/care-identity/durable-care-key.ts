/**
 * Care identity keys are identifiers, not authentication credentials.
 * The authenticated backend account and its authorized care-recipient grants
 * must remain the authority for all production reads and writes.
 */

export const DURABLE_CARE_KEY_STORAGE = "solenos_durable_care_key";
export const CARE_RECIPIENT_ID_STORAGE = "solenos_care_recipient_id";
export const INTERACTION_SESSION_STORAGE = "solenos_care_session_id";

function newRandomId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function mintDurableCareKey(): string {
  return `care_${newRandomId()}`;
}

export function mintInteractionSessionId(): string {
  return `sess_${newRandomId()}`;
}

export function isInteractionSessionId(value: string | null | undefined): boolean {
  return Boolean(value?.trim().startsWith("sess_"));
}

/** Require an explicit durable identity; browser session IDs and shared placeholders are invalid. */
export function requireCaregiverId(value: string | null | undefined, source = "caregiver_id"): string {
  const id = value?.trim() ?? "";
  if (!id || id.toLowerCase() === "default_caregiver" || isInteractionSessionId(id)) {
    throw new Error(`A valid durable caregiver identity is required; rejected ${source}.`);
  }
  return id;
}

/**
 * Resolve only an explicitly supplied durable identity.
 * An interaction session is never a care identity, and missing identity fails closed.
 */
export function resolveDurableCareKey(params: {
  caregiver_id?: string | null;
  care_session_id?: string | null;
}): string {
  return requireCaregiverId(params.caregiver_id, "caregiver_id");

}

/**
 * Validate a caregiver-facing request identity. Explicit legacy shared IDs are rejected.
 */
export function requireCareKeyFromRequest(params: {
  caregiver_id?: string | null;
  care_session_id?: string | null;
}): { ok: true; careKey: string } | { ok: false; error: string } {
  const fromCaregiver = params.caregiver_id?.trim();
  if (fromCaregiver && fromCaregiver.toLowerCase() !== "default_caregiver" && !isInteractionSessionId(fromCaregiver)) {
    return { ok: true, careKey: fromCaregiver };
  }

  return {
    ok: false,
    error: "An explicit caregiver identity is required; session IDs cannot identify care records.",
  };
}

/**
 * Browser key generation supports local continuity only; it is not authentication.
 * A legacy shared placeholder is discarded so it cannot be reused by another browser user.
 */
export function ensureClientDurableCareKey(stored: string | null | undefined): string {
  const trimmed = stored?.trim();
  if (trimmed && trimmed !== "default_caregiver") return trimmed;
  return mintDurableCareKey();
}

export function ensureClientInteractionSessionId(
  stored: string | null | undefined,
  options?: { forceNew?: boolean },
): string {
  if (options?.forceNew) return mintInteractionSessionId();
  const trimmed = stored?.trim();
  if (trimmed && isInteractionSessionId(trimmed)) return trimmed;
  return mintInteractionSessionId();
}

/** @deprecated Kept for call-site migration; returns a temporary session only. */
export function careSessionIdForDurableKey(_durableCareKey: string): string {
  void _durableCareKey;
  return mintInteractionSessionId();
}

export function resolveInteractionSessionId(
  careSessionId: string | null | undefined,
): string {
  const trimmed = careSessionId?.trim();
  if (trimmed && isInteractionSessionId(trimmed)) return trimmed;
  return mintInteractionSessionId();
}
