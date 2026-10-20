/**

 * Contributor session key (browser) — distinct from Care Reality (`care_recipient_id`).

 * Locked A: interaction session is temporary; durable care key is not.

 * Locked B: many contributors → one Living Care Record keyed by care recipient.

 */



export const DEFAULT_DURABLE_CARE_KEY = "default_caregiver";



export const DURABLE_CARE_KEY_STORAGE = "solenos_durable_care_key";



/** Persisted Care Reality id — many contributors join one Living Care Record (Locked B). */

export const CARE_RECIPIENT_ID_STORAGE = "solenos_care_recipient_id";



export const INTERACTION_SESSION_STORAGE = "solenos_care_session_id";



function isEmptyKey(value: string | null | undefined): boolean {

  return !value?.trim();

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

 * Does not mint — returns DEFAULT only when nothing is provided (legacy helpers).

 */

export function resolveDurableCareKey(params: {

  caregiver_id?: string | null;

  care_session_id?: string | null;

}): string {

  const fromCaregiver = params.caregiver_id?.trim();

  if (fromCaregiver) return fromCaregiver;

  const fromSession = params.care_session_id?.trim();

  // Interaction sessions are not care reality keys (Locked A).

  if (fromSession && !isInteractionSessionId(fromSession)) return fromSession;

  return DEFAULT_DURABLE_CARE_KEY;

}



/**

 * Caregiver-facing API paths: require an explicit care key.

 * Missing key → fail (never invent shared default_caregiver).

 * Explicit `default_caregiver` remains allowed for verify scripts.

 * Ephemeral `sess_*` ids are never accepted as the durable care key.

 */

export function requireCareKeyFromRequest(params: {

  caregiver_id?: string | null;

  care_session_id?: string | null;

}): { ok: true; careKey: string } | { ok: false; error: string } {

  const fromCaregiver = params.caregiver_id?.trim();

  if (fromCaregiver) return { ok: true, careKey: fromCaregiver };



  const fromSession = params.care_session_id?.trim();

  if (fromSession && !isInteractionSessionId(fromSession)) {

    return { ok: true, careKey: fromSession };

  }



  return {

    ok: false,

    error: "caregiver_id is required — Living Care Record writes need a care key",

  };

}



/**

 * Browser caregiver path: reuse the stored durable key, or mint when missing.

 * Locked A: never remint on Begin — same identity keeps Care Reality.

 * `default_caregiver` is a valid stored identity (demo/verify); do not orphan it.

 */

export function ensureClientDurableCareKey(stored: string | null | undefined): string {

  if (!isEmptyKey(stored)) return stored!.trim();

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


