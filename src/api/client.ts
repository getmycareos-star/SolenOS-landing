// Use the same-origin API proxy in Next.js and Netlify production.
// Netlify forwards /api/* to the backend, so browser requests do not expose a backend hostname.
import { apiUrl } from "@/lib/api-url";

const API_BASE = '/api/v1'

function isPlaceholderIdentifier(value: string | null | undefined): boolean {
  if (!value?.trim()) return true
  return /^(?:demo|sample|test|fake|placeholder)(?:[-_:]|$)|^(?:current-user-id|team-moderator)$/i.test(value.trim())
}

export function getPersonId(): string {
  // The server-issued anonymous session is the only identity authority for
  // protected care APIs. A legacy localStorage ID is not proof of ownership
  // and must never override the identity bound to the bearer token.
  const id = localStorage.getItem(ANONYMOUS_PERSON_KEY)?.trim() || '';
  return isPlaceholderIdentifier(id) ? '' : id;
}

export function setPersonId(id: string): void {
  const normalized = id.trim()
  if (isPlaceholderIdentifier(normalized)) {
    localStorage.removeItem('solenos_person_id')
  } else {
    localStorage.setItem('solenos_person_id', normalized)
  }
  window.dispatchEvent(new Event('personIdChanged'))
}

export function subscribeToPersonId(callback: (id: string) => void): () => void {
  const handler = () => callback(getPersonId())
  window.addEventListener('personIdChanged', handler)
  return () => window.removeEventListener('personIdChanged', handler)
}

function resolveApiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`

  // The backend exposes situation capture at /api/situation (outside /api/v1).
  // All other calls using this client use the /api/v1 router.
  if (normalized === '/situation' || normalized.startsWith('/situation?')) {
    return `/api${normalized}`
  }

  return `${API_BASE.replace(/\/$/, '')}${normalized}`
}


const ANONYMOUS_TOKEN_KEY = "solenos_anonymous_access_token";
const ANONYMOUS_PERSON_KEY = "solenos_backend_person_id";
const ANONYMOUS_CAREGIVER_KEY = "solenos_backend_caregiver_id";
const ANONYMOUS_EXPIRY_KEY = "solenos_anonymous_session_expires_at";

export type AnonymousSession = {
  session_id?: string;
  person: { id: string; name: string; date_of_birth: string | null };
  caregiver: { id: string; name: string; relationship: string };
  access_token: string;
  token_type: "Bearer";
  expires_at: string;
  expires_in_seconds: number;
};

export function getAnonymousAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ANONYMOUS_TOKEN_KEY);
}

function authorizationHeaders(): Record<string, string> {
  const token = getAnonymousAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Resolve the scoped bearer capability before protected API calls.
 * Concurrent first-use requests share ensureAnonymousSession's in-flight promise.
 * A complete, unexpired session is reused rather than refreshed on every request.
 * Public time utilities remain available before a caregiver enters a care record.
 */
async function requestAuthorizationHeaders(path: string): Promise<Record<string, string>> {
  if (typeof window === "undefined") {
    throw new Error("Care-record API requests require a browser-scoped SolenOS session.");
  }

  const normalized = path.startsWith("/") ? path : `/${path}`;
  const isPublicTimeUtility = /^\/time\/(?:now|ago|until)(?:\?|$)/.test(normalized);
  if (isPublicTimeUtility) return authorizationHeaders();

  const token = window.localStorage.getItem(ANONYMOUS_TOKEN_KEY);
  const personId = window.localStorage.getItem(ANONYMOUS_PERSON_KEY);
  const caregiverId = window.localStorage.getItem(ANONYMOUS_CAREGIVER_KEY);
  const expiresAt = window.localStorage.getItem(ANONYMOUS_EXPIRY_KEY);
  const expiry = expiresAt ? Date.parse(expiresAt) : Number.NaN;
  const hasUsableSession =
    Boolean(token && personId && caregiverId) &&
    Number.isFinite(expiry) &&
    expiry > Date.now() + 60_000;

  if (!hasUsableSession) await ensureAnonymousSession();

  const headers = authorizationHeaders();
  if (!headers.Authorization) {
    throw new Error("A valid SolenOS care session is required before accessing this record.");
  }
  return headers;
}

/** Create or refresh a scoped anonymous session without account registration. */
async function ensureAnonymousSessionInternal(): Promise<AnonymousSession> {
  if (typeof window === "undefined") {
    throw new Error("Anonymous care sessions can only be created in the browser.");
  }

  const token = window.localStorage.getItem(ANONYMOUS_TOKEN_KEY);
  const personId = window.localStorage.getItem(ANONYMOUS_PERSON_KEY);
  const caregiverId = window.localStorage.getItem(ANONYMOUS_CAREGIVER_KEY);
  const expiresAt = window.localStorage.getItem(ANONYMOUS_EXPIRY_KEY);

  if (token) {
    if (expiresAt && Date.parse(expiresAt) <= Date.now()) {
      throw new Error(
        "This anonymous session has expired. SolenOS will not silently create a different care record."
      );
    }

    if (
      personId &&
      caregiverId &&
      expiresAt &&
      Date.parse(expiresAt) > Date.now() + 30 * 24 * 60 * 60 * 1000
    ) {
      setPersonId(personId);
      return {
        person: { id: personId, name: "Care recipient", date_of_birth: null },
        caregiver: { id: caregiverId, name: "Caregiver", relationship: "Family" },
        access_token: token,
        token_type: "Bearer",
        expires_at: expiresAt,
        expires_in_seconds: Math.max(0, Math.floor((Date.parse(expiresAt) - Date.now()) / 1000)),
      };
    }

    const refreshResponse = await fetchWithTimeout("/api/v1/sessions/refresh", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const refreshed = (await handleResponse(refreshResponse)) as {
      session_id: string;
      person_id: string;
      caregiver_id: string;
      access_token: string;
      token_type: "Bearer";
      expires_at: string;
      expires_in_seconds: number;
    };
    window.localStorage.setItem(ANONYMOUS_TOKEN_KEY, refreshed.access_token);
    window.localStorage.setItem(ANONYMOUS_PERSON_KEY, refreshed.person_id);
    window.localStorage.setItem(ANONYMOUS_CAREGIVER_KEY, refreshed.caregiver_id);
    window.localStorage.setItem(ANONYMOUS_EXPIRY_KEY, refreshed.expires_at);
    setPersonId(refreshed.person_id);
    return {
      session_id: refreshed.session_id,
      person: { id: refreshed.person_id, name: "Care recipient", date_of_birth: null },
      caregiver: { id: refreshed.caregiver_id, name: "Caregiver", relationship: "Family" },
      access_token: refreshed.access_token,
      token_type: "Bearer",
      expires_at: refreshed.expires_at,
      expires_in_seconds: refreshed.expires_in_seconds,
    };
  }

  // Existing record IDs without the bearer secret are not proof of ownership.
  // Do not silently create a new record and make the prior one appear lost.
  const legacyPersonId = window.localStorage.getItem("solenos_person_id")?.trim() || "";
  if (personId || caregiverId || (legacyPersonId && !isPlaceholderIdentifier(legacyPersonId))) {
    throw new Error(
      "This browser has a care-record ID but no session credential. SolenOS cannot safely restore that record automatically."
    );
  }

  const response = await fetchWithTimeout("/api/v1/sessions/anonymous", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ caregiver_name: "Caregiver" }),
  });
  const created = (await handleResponse(response)) as AnonymousSession;
  window.localStorage.setItem(ANONYMOUS_TOKEN_KEY, created.access_token);
  window.localStorage.setItem(ANONYMOUS_PERSON_KEY, created.person.id);
  window.localStorage.setItem(ANONYMOUS_CAREGIVER_KEY, created.caregiver.id);
  window.localStorage.setItem(ANONYMOUS_EXPIRY_KEY, created.expires_at);
  setPersonId(created.person.id);
  return created;
}

let anonymousSessionPromise: Promise<AnonymousSession> | null = null;
let sessionTimingSequence = 0;

/** Share one in-flight bootstrap/refresh across concurrent components. */
export function ensureAnonymousSession(): Promise<AnonymousSession> {
  if (!anonymousSessionPromise) {
    const timingEnabled = typeof performance !== "undefined" && typeof performance.mark === "function";
    const sequence = ++sessionTimingSequence;
    const startMark = `solenos-session-start-${sequence}`;
    const endMark = `solenos-session-end-${sequence}`;
    if (timingEnabled) {
      try { performance.mark(startMark); } catch { /* Performance API is optional. */ }
    }
    anonymousSessionPromise = ensureAnonymousSessionInternal().finally(() => {
      if (timingEnabled && typeof performance.measure === "function") {
        try {
          performance.mark(endMark);
          performance.measure("solenos.session.bootstrap", { start: startMark, end: endMark });
        } catch {
          // Instrumentation must never interfere with session restoration.
        } finally {
          performance.clearMarks(startMark);
          performance.clearMarks(endMark);
        }
      }
      anonymousSessionPromise = null;
    });
  }
  return anonymousSessionPromise;
}

const API_REQUEST_TIMEOUT_MS = 15_000;
const RETRYABLE_GET_STATUSES = new Set([502, 503, 504]);

let apiTimingSequence = 0;

/** Keep browser performance entries content-free: no query strings, IDs, tokens, or payloads. */
function apiTimingLabel(input: RequestInfo | URL): string {
  try {
    const raw = typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
    const pathname = new URL(raw, window.location.origin).pathname;
    const segments = pathname.split("/").filter(Boolean);
    // The first three route segments identify an API family without recording
    // person, caregiver, document, conversation, or other record identifiers.
    return segments.slice(0, 3).join("-").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48) || "unknown";
  } catch {
    return "unknown";
  }
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_REQUEST_TIMEOUT_MS);
  const timingEnabled = typeof performance !== "undefined" && typeof performance.mark === "function";
  const sequence = ++apiTimingSequence;
  const startMark = `solenos-api-start-${sequence}`;
  const endMark = `solenos-api-end-${sequence}`;
  const method = (init.method || (typeof Request !== "undefined" && input instanceof Request ? input.method : "GET")).toUpperCase();
  let outcome = "network-error";
  if (timingEnabled) {
    try { performance.mark(startMark); } catch { /* Performance API is optional. */ }
  }
  try {
    const response = await fetch(input, { ...init, signal: init.signal ?? controller.signal });
    outcome = String(response.status);
    return response;
  } catch (error) {
    if (controller.signal.aborted) {
      outcome = "timeout";
      throw new Error("The SolenOS API request timed out. Check your connection and try again.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    if (timingEnabled && typeof performance.measure === "function") {
      try {
        performance.mark(endMark);
        performance.measure(
          `solenos.api.${method}.${apiTimingLabel(input)}.${outcome}`,
          { start: startMark, end: endMark },
        );
      } catch {
        // Instrumentation must never interfere with a care-record request.
      } finally {
        performance.clearMarks(startMark);
        performance.clearMarks(endMark);
      }
    }
  }
}

// Only idempotent reads are retried. Never replay writes after an ambiguous network failure.
async function fetchGetWithRetry(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetchWithTimeout(input, { ...init, method: "GET" });
      if (attempt === 0 && RETRYABLE_GET_STATUSES.has(response.status)) continue;
      return response;
    } catch (error) {
      if (attempt === 1) throw error;
    }
  }
  throw new Error("The SolenOS API read could not be completed.");
}

async function handleResponse(res: Response) {
  const contentType = res.headers.get('content-type') || ''
  const isJson = contentType.includes('application/json')

  if (!res.ok) {
    let message = `API ${res.status}`
    if (isJson) {
      try {
        const err = await res.json()
        message = err.detail || err.message || message
      } catch {
        // keep generic message
      }
    } else {
      const text = await res.text()
      message = text || message
    }
    throw new Error(message)
  }

  if (!isJson) {
    throw new Error(`Expected JSON but received ${contentType || 'empty response'}`)
  }

  const text = await res.text()
  if (!text) {
    throw new Error('Empty response from server')
  }

  try {
    return JSON.parse(text)
  } catch {
    throw new Error('Invalid JSON response from server')
  }
}

export async function getJSON(path: string) {
  const headers = await requestAuthorizationHeaders(path);
  const res = await fetchGetWithRetry(resolveApiUrl(path), { headers })
  return handleResponse(res)
}

// Downloads a binary response, e.g. the care summary PDF.
export async function getBlob(path: string): Promise<Blob> {
  const headers = await requestAuthorizationHeaders(path);
  const res = await fetchGetWithRetry(resolveApiUrl(path), { headers })
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`)
  }
  return res.blob()
}

export async function postJSON(path: string, body: unknown) {
  const authHeaders = await requestAuthorizationHeaders(path);
  const res = await fetchWithTimeout(resolveApiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify(body),
  })
  return handleResponse(res)
}

export async function patchJSON(path: string, body: unknown) {
  const authHeaders = await requestAuthorizationHeaders(path);
  const res = await fetchWithTimeout(resolveApiUrl(path), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify(body),
  })
  return handleResponse(res)
}


export async function deleteJSON(path: string, body?: unknown) {
  const authHeaders = await requestAuthorizationHeaders(path);
  const res = await fetchWithTimeout(resolveApiUrl(path), {
    method: "DELETE",
    headers: { ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...authHeaders },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return handleResponse(res);
}

export type AccountLoginResponse = {
  account: { id: string; email: string; created_at: string | null };
  session_id: string;
  person_id: string;
  caregiver_id: string;
  access_token: string;
  token_type: "Bearer";
  expires_at: string;
  expires_in_seconds: number;
};

/** Sign in through the backend and replace the local anonymous capability with the account's scoped session. */
export async function signInToAccount(email: string, password: string): Promise<AccountLoginResponse> {
  const res = await fetchWithTimeout("/api/v1/accounts/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const result = await handleResponse(res) as AccountLoginResponse;
  window.localStorage.setItem(ANONYMOUS_TOKEN_KEY, result.access_token);
  window.localStorage.setItem(ANONYMOUS_PERSON_KEY, result.person_id);
  window.localStorage.setItem(ANONYMOUS_CAREGIVER_KEY, result.caregiver_id);
  window.localStorage.setItem(ANONYMOUS_EXPIRY_KEY, result.expires_at);
  setPersonId(result.person_id);
  return result;
}

export async function putJSON(path: string, body: unknown) {
  const authHeaders = await requestAuthorizationHeaders(path);
  const res = await fetchWithTimeout(resolveApiUrl(path), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify(body),
  })
  return handleResponse(res)
}

/** Revoke the current server-issued bearer session; never silently replace it. */
export async function revokeAnonymousSession(): Promise<void> {
  await postJSON("/sessions/revoke", {});
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(ANONYMOUS_TOKEN_KEY);
    window.localStorage.removeItem(ANONYMOUS_PERSON_KEY);
    window.localStorage.removeItem(ANONYMOUS_CAREGIVER_KEY);
    window.localStorage.removeItem(ANONYMOUS_EXPIRY_KEY);
    window.dispatchEvent(new Event("personIdChanged"));
  }
}

// Multipart uploads go directly to Railway to avoid Netlify's proxy body-size
// limits. Do not set Content-Type manually: the browser must add the boundary.
export async function postFormData(path: string, body: FormData) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const backendPath = normalized.startsWith("/api/v1/")
    ? normalized
    : `/api/v1${normalized}`;
  const headers = await requestAuthorizationHeaders(backendPath);
  const res = await fetchWithTimeout(apiUrl(backendPath), {
    method: "POST",
    headers,
    body,
  });
  return handleResponse(res);
}

// Caregiver identity is only accepted when explicitly stored by the current
// frontend session. Never fabricate a caregiver ID for a care record.
export function getCaregiverId(): string | null {
  // Only the backend-issued caregiver ID is suitable for API attribution.
  // The durable client care key is a separate continuity key, not identity.
  const id = localStorage.getItem(ANONYMOUS_CAREGIVER_KEY)?.trim() || ''
  return isPlaceholderIdentifier(id) ? null : id
}

// Account authentication is still separate. The anonymous bearer capability
// authorizes one care record; it does not establish an account or professional role.
export interface AuthSessionInfo {
  authenticated: boolean
  account_id: string | null
  session_type: string
  authorized_person_ids: string[]
  caregiver_roles: Record<string, string>
  professional_roles: Record<string, string>
  anonymous_session_id: string | null
  expires_at: string
  mfa_verified: boolean
}

export async function checkAuthState(): Promise<{ authenticated: boolean; sessionInfo: AuthSessionInfo | null }> {
  return { authenticated: false, sessionInfo: null }
}

export function subscribeToAuthState(
  _callback: (authenticated: boolean, sessionInfo: AuthSessionInfo | null) => void,
): () => void {
  // No backend session event stream exists yet.
  return () => undefined
}

export function startTokenRefresh(): void {
  // No backend-issued token exists to refresh until authentication is implemented.
}

export function stopTokenRefresh(): void {
  // No active token-refresh task exists.
}
