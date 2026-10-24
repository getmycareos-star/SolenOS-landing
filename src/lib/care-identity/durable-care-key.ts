/**

 * Contributor session key (browser) — distinct from Care Reality (`care_recipient_id`).

 * Locked A: interaction session is temporary; durable care key is not.

 * Locked B: many contributors → one Living Care Record keyed by care recipient.

 */



export const LEGACY_SHARED_PLACEHOLDER_CARE_KEY = "default_caregiver";



export const DURABLE_CARE_KEY_STORAGE = "solenos_durable_care_key";



/** Persisted Care Reality id — many contributors join one Living Care Record (Locked B). */

export const CARE_RECIPIENT_ID_STORAGE = "solenos_care_recipient_id";



export const INTERACTION_SESSION_STORAGE = "solenos_care_session_id";



function isEmptyKey(value: string | null | undefined): boolean {
  return !value?.trim();
}

function isSharedPlaceholderKey(value: string | null | undefined): boolean {
  return value?.trim().toLowerCase() === LEGACY_SHARED_PLACEHOLDER_CARE_KEY;
}

function assertDurableCareKey(value: string, source: string): string {
  const normalized = value.trim();
  if (!normalized || isSharedPlaceholderKey(normalized) || isInteractionSessionId(normalized)) {
    throw new Error(`A real durable care key is required; rejected ${source} fallback.`);
  }
  return normalized;
}

/** Require an explicit, non-placeholder identity before any care data is read or written. */
export function requireCaregiverId(value: string | null | undefined, source = "caregiver_id"): string {
  if (!value?.trim()) {
    throw new Error("A caregiver identity is required; no shared default identity is permitted.");
  }
  return assertDurableCareKey(value, source);
}



function newRandomId(): string {

  if (typeof globalThis.crypto?.randomUUID === "function") {

    return globalThis.crypto.randomUUID();

  }

  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

}



/** Mint a per-browser durable care key. */

export function mintDurableCareKey(): string {

  return `care_${newRandomId()}`;

}



/** Mint a temporary interaction session (Begin / resume). Never a care reality id. */

export function mintInteractionSessionId(): string {

  return `sess_${newRandomId()}`;

}



export function isInteractionSessionId(value: string | null | undefined): boolean {

  return Boolean(value?.trim().startsWith("sess_"));

}



/**

 * Resolve an existing care key for API/server paths.

 * Does not mint. Missing, shared-placeholder, or session-only identity fails closed.

 */

export function resolveDurableCareKey(params: {

  caregiver_id?: string | null;

  care_session_id?: string | null;

}): string {

  const fromCaregiver = params.caregiver_id?.trim();
  if (fromCaregiver) return assertDurableCareKey(fromCaregiver, "caregiver_id");

  // Session IDs are interaction-scoped and must never be reinterpreted as
  // durable caregiver/care-record identity, even if they lack the sess_ prefix.
  throw new Error("An explicit durable caregiver identity is required; session IDs cannot identify care records.");

}



/**

 * Caregiver-facing API paths: require an explicit care key.

 * Missing key → fail (never invent shared default_caregiver).

 * Legacy shared placeholder IDs are rejected, including in verify paths.

 * Ephemeral `sess_*` ids are never accepted as the durable care key.

 */

export function requireCareKeyFromRequest(params: {

  caregiver_id?: string | null;

  care_session_id?: string | null;

}): { ok: true; careKey: string } | { ok: false; error: string } {

  const fromCaregiver = params.caregiver_id?.trim();

  if (fromCaregiver && !isSharedPlaceholderKey(fromCaregiver) && !isInteractionSessionId(fromCaregiver)) {
    return { ok: true, careKey: fromCaregiver };
  }



  // Never infer durable identity from a session field. A caller must supply
  // an explicit caregiver_id; backend authorization remains authoritative.
  return {
    ok: false,
    error: "caregiver_id is required — session IDs cannot identify care records",
  };

}



/**

 * Browser caregiver path: reuse the stored durable key, or mint when missing.

 * Locked A: never remint on Begin — same identity keeps Care Reality.

 * Legacy shared placeholder keys are invalidated and replaced with a per-browser key.

 */

export function ensureClientDurableCareKey(stored: string | null | undefined): string {

  if (!isEmptyKey(stored) && !isSharedPlaceholderKey(stored) && !isInteractionSessionId(stored)) {
    return stored!.trim();
  }
  return mintDurableCareKey();

}



/**

 * Interaction session id — temporary; never the durable care key.

 * Begin (`forceNew`) starts a new session without touching Care Reality.

 */

export function ensureClientInteractionSessionId(

  stored: string | null | undefined,

  options?: { forceNew?: boolean },

): string {

  if (options?.forceNew) return mintInteractionSessionId();

  const trimmed = stored?.trim();

  if (trimmed && isInteractionSessionId(trimmed)) return trimmed;

  // Legacy alias (session === care key) or missing → mint a true session id.

  return mintInteractionSessionId();

}



/**

 * @deprecated Prefer ensureClientInteractionSessionId.

 * Kept for call-site migration; does not return the durable key (Locked A).

 */

export function careSessionIdForDurableKey(_durableCareKey: string): string {

  void _durableCareKey;

  return mintInteractionSessionId();

}



/** Prefer client-provided session; mint only when absent. */

export function resolveInteractionSessionId(

  careSessionId: string | null | undefined,

): string {

  const trimmed = careSessionId?.trim();

  if (trimmed && isInteractionSessionId(trimmed)) return trimmed;

  if (trimmed && !isInteractionSessionId(trimmed)) {

    // Legacy clients sent care key as session — mint a real session for this request.

    return mintInteractionSessionId();

  }

  return mintInteractionSessionId();

}


