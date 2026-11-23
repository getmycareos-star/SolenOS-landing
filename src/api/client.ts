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
  const previous = localStorage.getItem('solenos_person_id')?.trim() || ''
  const next = isPlaceholderIdentifier(normalized) ? '' : normalized
  if (!next) {
    localStorage.removeItem('solenos_person_id')
  } else {
    localStorage.setItem('solenos_person_id', next)
  }
  // Session restoration calls this for every authenticated API consumer.
  // Notify identity subscribers only when the identity actually changes;
  // otherwise a listener that restores the session can recursively trigger
  // itself through another personIdChanged event.
  if (previous !== next) {
    window.dispatchEvent(new Event('personIdChanged'))
  }
}

export function subscribeToPersonId(callback: (id: string) => void): () => void {
  const handler = () => callback(getPersonId())
  window.addEventListener('personIdChanged', handler)
  return () => window.removeEventListener('personIdChanged', handler)
}

function resolveApiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`

  // These backend routes live outside the /api/v1 router. Preserve their exact
  // paths and use the shared base resolver so configured Railway deployments
  // and the same-origin Netlify proxy behave consistently.
  if (normalized === '/situation' || normalized.startsWith('/situation?')) {
    return `/api${normalized}`
  }
  if (normalized === '/api/lcr/orientation' || normalized.startsWith('/api/lcr/orientation?')) {
    return apiUrl(normalized)
  }

  return `${API_BASE.replace(/\/$/, '')}${normalized}`
}


const ANONYMOUS_TOKEN_KEY = "solenos_anonymous_access_token";
const ANONYMOUS_PERSON_KEY = "solenos_backend_person_id";
const ANONYMOUS_CAREGIVER_KEY = "solenos_backend_caregiver_id";
const ANONYMOUS_EXPIRY_KEY = "solenos_anonymous_session_expires_at";
const ANONYMOUS_SESSION_REVOKED_KEY = "solenos_anonymous_session_revoked";
if (typeof window !== "undefined") {
  // Storage events fire once per changed key. Compare the combined scope so
  // a person-and-caregiver switch produces one notification, not two reloads.
  let lastObservedStorageCareIdentity = [
    localStorage.getItem(ANONYMOUS_PERSON_KEY) || "",
    localStorage.getItem(ANONYMOUS_CAREGIVER_KEY) || "",
  ].join("|");
  window.addEventListener("storage", (event: StorageEvent) => {
    if (
      (event.key === ANONYMOUS_PERSON_KEY || event.key === ANONYMOUS_CAREGIVER_KEY)
      && event.oldValue !== event.newValue
    ) {
      const nextIdentity = [
        localStorage.getItem(ANONYMOUS_PERSON_KEY) || "",
        localStorage.getItem(ANONYMOUS_CAREGIVER_KEY) || "",
      ].join("|");
      if (nextIdentity === lastObservedStorageCareIdentity) return;
      lastObservedStorageCareIdentity = nextIdentity;
      window.dispatchEvent(new Event("personIdChanged"));
    }
  });
}

/** Persist both backend identities and notify scoped views on either change. */
export function setCareIdentity(personId: string, caregiverId: string): void {
  const nextPerson = isPlaceholderIdentifier(personId.trim()) ? "" : personId.trim();
  const nextCaregiver = isPlaceholderIdentifier(caregiverId.trim()) ? "" : caregiverId.trim();
  const previousPerson = localStorage.getItem(ANONYMOUS_PERSON_KEY)?.trim() || "";
  const previousCaregiver = localStorage.getItem(ANONYMOUS_CAREGIVER_KEY)?.trim() || "";
  const previousDurablePerson = localStorage.getItem("solenos_person_id")?.trim() || "";
  const backendIdentityChanged = previousPerson !== nextPerson || previousCaregiver !== nextCaregiver;

  if (nextPerson) localStorage.setItem(ANONYMOUS_PERSON_KEY, nextPerson);
  else localStorage.removeItem(ANONYMOUS_PERSON_KEY);
  if (nextCaregiver) localStorage.setItem(ANONYMOUS_CAREGIVER_KEY, nextCaregiver);
  else localStorage.removeItem(ANONYMOUS_CAREGIVER_KEY);

  // A person change is announced by setPersonId; this covers caregiver-only changes.
  setPersonId(nextPerson);
  if (backendIdentityChanged && previousDurablePerson === nextPerson) {
    window.dispatchEvent(new Event("personIdChanged"));
  }
}

/**
 * A local deletion revokes this browser's ability to silently create another
 * identity. Explicit /workspace?enter=1 is the only replacement path.
 *
 * Capture the marker before the first network await. Comparing its value after
 * the request detects a revoke from another tab while the request was pending.
 */
function captureSessionBootstrapRevocation(): string | null {
  if (typeof window === "undefined") return null;
  const marker = window.localStorage.getItem(ANONYMOUS_SESSION_REVOKED_KEY);
  if (marker === null) return null;

  const url = new URL(window.location.href);
  const explicitNewRecordIntent =
    url.pathname === "/workspace" && url.searchParams.get("enter") === "1";
  if (!explicitNewRecordIntent) {
    throw new Error("This workspace was deleted from this device. Choose Care Record to start a new record.");
  }

  return marker;
}

function assertSessionBootstrapNotRevoked(markerAtStart: string | null): void {
  if (typeof window !== "undefined" &&
      window.localStorage.getItem(ANONYMOUS_SESSION_REVOKED_KEY) !== markerAtStart) {
    throw new Error("This workspace was deleted while access was being restored. Choose Care Record to start a new record.");
  }
}

function completeExplicitSessionBootstrap(markerAtStart: string | null): void {
  assertSessionBootstrapNotRevoked(markerAtStart);
  if (markerAtStart !== null) {
    window.localStorage.removeItem(ANONYMOUS_SESSION_REVOKED_KEY);
  }
}

function createSessionRevocationMarker(): string {
  // This is a cross-tab race version, not an authentication secret.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

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

  // The deletion marker is shared across tabs. Check it before reusing an
  // otherwise-valid cached token so a second tab cannot keep using a record
  // after this browser has been cleared. Explicit new-record entry bootstraps
  // a fresh server-issued identity before any protected request is sent.
  if (window.localStorage.getItem(ANONYMOUS_SESSION_REVOKED_KEY) !== null) {
    const url = new URL(window.location.href);
    const explicitNewRecordIntent =
      url.pathname === "/workspace" && url.searchParams.get("enter") === "1";
    if (!explicitNewRecordIntent) {
      throw new Error("This workspace was deleted from this device. Choose Care Record to start a new record.");
    }
    await ensureAnonymousSession();
  }

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

  const revocationMarkerAtStart = captureSessionBootstrapRevocation();
  if (revocationMarkerAtStart !== null) {
    // The caregiver explicitly chose a new record. Do not reuse any stale
    // browser credentials or identifiers from the deleted workspace.
    window.localStorage.removeItem(ANONYMOUS_TOKEN_KEY);
    window.localStorage.removeItem(ANONYMOUS_PERSON_KEY);
    window.localStorage.removeItem(ANONYMOUS_CAREGIVER_KEY);
    window.localStorage.removeItem(ANONYMOUS_EXPIRY_KEY);
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

    // Reuse a still-valid bearer session. Refresh only shortly before expiry;
    // requiring 30 days of remaining lifetime forced a network round-trip on
    // almost every visit and delayed access to Daily Care capture.
    if (
      personId &&
      caregiverId &&
      expiresAt &&
      Date.parse(expiresAt) > Date.now() + 5 * 60 * 1000
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
    assertSessionBootstrapNotRevoked(revocationMarkerAtStart);
    window.localStorage.setItem(ANONYMOUS_TOKEN_KEY, refreshed.access_token);
    window.localStorage.setItem(ANONYMOUS_EXPIRY_KEY, refreshed.expires_at);
    completeExplicitSessionBootstrap(revocationMarkerAtStart);
    setCareIdentity(refreshed.person_id, refreshed.caregiver_id);
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
  assertSessionBootstrapNotRevoked(revocationMarkerAtStart);
  window.localStorage.setItem(ANONYMOUS_TOKEN_KEY, created.access_token);
  window.localStorage.setItem(ANONYMOUS_EXPIRY_KEY, created.expires_at);
  completeExplicitSessionBootstrap(revocationMarkerAtStart);
  setCareIdentity(created.person.id, created.caregiver.id);
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

function apiRequestTimeoutMs(input: RequestInfo | URL, method: string): number {
  try {
    const raw = typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
    const pathname = new URL(raw, "http://solenos.local").pathname;
    if (pathname.endsWith("/assistant/assist") && method === "POST") return 210_000;
    if (pathname.endsWith("/assistant/claim-extraction") && method === "POST") return 360_000;
    if (pathname.endsWith("/assistant/care-understanding") && method === "POST") return 210_000;
    if (pathname.endsWith("/handoff-drafts/prepare") && method === "POST") return 210_000;
    if (pathname.endsWith("/conversation/message") && method === "POST") return 210_000;
    if (pathname.endsWith("/lcr/orientation") && method === "POST") return 210_000;
    if (pathname.includes("/documents/") && pathname.endsWith("/extract") && method === "POST") return 180_000;
    if (pathname.includes("/documents/") && pathname.endsWith("/intelligence") && method === "POST") return 210_000;
    if (pathname.includes("/documents/") && pathname.endsWith("/intelligence") && method === "POST") return 210_000;
    if (pathname.endsWith("/upload") && method === "POST") return 120_000;
    if (pathname.includes("/upload/") && method === "GET") return 120_000;
  } catch {
    // Use the conservative default when a URL cannot be classified.
  }
  return API_REQUEST_TIMEOUT_MS;
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs?: number): Promise<Response> {
  const controller = new AbortController();
  const method = (init.method || (typeof Request !== "undefined" && input instanceof Request ? input.method : "GET")).toUpperCase();
  const effectiveTimeoutMs = timeoutMs ?? apiRequestTimeoutMs(input, method);
  const timeout = setTimeout(() => controller.abort(), effectiveTimeoutMs);
  const timingEnabled = typeof performance !== "undefined" && typeof performance.mark === "function";
  const sequence = ++apiTimingSequence;
  const startMark = `solenos-api-start-${sequence}`;
  const endMark = `solenos-api-end-${sequence}`;
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
async function fetchGetWithRetry(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs?: number): Promise<Response> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetchWithTimeout(input, { ...init, method: "GET" }, timeoutMs);
      if (attempt === 0 && RETRYABLE_GET_STATUSES.has(response.status)) continue;
      return response;
    } catch (error) {
      if (attempt === 1) throw error;
    }
  }
  throw new Error("The SolenOS API read could not be completed.");
}

export class ApiResponseError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly detail: unknown = null,
  ) {
    super(message)
    this.name = 'ApiResponseError'
  }
}

async function handleResponse(res: Response) {
  const contentType = res.headers.get('content-type') || ''
  const isJson = contentType.includes('application/json')

  if (!res.ok) {
    let message = `API ${res.status}`
    let detail: unknown = null
    if (isJson) {
      try {
        const err = await res.json()
        detail = err.detail ?? null
        const detailMessage =
          detail && typeof detail === 'object' && 'message' in detail
            ? (detail as { message?: unknown }).message
            : null
        message =
          typeof detail === 'string'
            ? detail
            : typeof detailMessage === 'string'
              ? detailMessage
              : typeof err.message === 'string'
                ? err.message
                : message
      } catch {
        // keep generic message
      }
    } else {
      const text = await res.text()
      detail = text
      message = text || message
    }
    throw new ApiResponseError(res.status, message, detail)
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

let anonymousSessionRefreshPromise: Promise<string> | null = null;

/** Recover one rejected read without changing the care-record identity. */
async function refreshSessionAfterUnauthorized(previousToken: string): Promise<string> {
  const personId = window.localStorage.getItem(ANONYMOUS_PERSON_KEY);
  const caregiverId = window.localStorage.getItem(ANONYMOUS_CAREGIVER_KEY);
  const currentToken = getAnonymousAccessToken();
  const identityStillMatches = () =>
    window.localStorage.getItem(ANONYMOUS_PERSON_KEY) === personId &&
    window.localStorage.getItem(ANONYMOUS_CAREGIVER_KEY) === caregiverId;
  if (!personId || !caregiverId || !identityStillMatches()) {
    throw new Error("The care-record session identity is incomplete or changed. No replacement record was created.");
  }
  if (currentToken && currentToken !== previousToken) return currentToken;

  if (!anonymousSessionRefreshPromise) {
    anonymousSessionRefreshPromise = (async () => {
      const response = await fetchWithTimeout("/api/v1/sessions/refresh", {
        method: "POST",
        headers: { Authorization: `Bearer ${currentToken || previousToken}` },
      });
      const refreshed = await handleResponse(response) as {
        person_id: string; caregiver_id: string; access_token: string; expires_at: string;
      };
      if (refreshed.person_id !== personId || refreshed.caregiver_id !== caregiverId ||
          !refreshed.access_token || !refreshed.expires_at) {
        throw new Error("Session refresh returned a different care-record identity. No identity was changed.");
      }
      if (!identityStillMatches()) {
        throw new Error("The active care-record identity changed during session refresh. The refreshed token was not applied.");
      }
      window.localStorage.setItem(ANONYMOUS_TOKEN_KEY, refreshed.access_token);
      window.localStorage.setItem(ANONYMOUS_EXPIRY_KEY, refreshed.expires_at);
        return refreshed.access_token;
    })().finally(() => { anonymousSessionRefreshPromise = null; });
  }
  try {
    return await anonymousSessionRefreshPromise;
  } catch (error) {
    const latestToken = getAnonymousAccessToken();
    if (latestToken && latestToken !== previousToken &&
        identityStillMatches()) {
      return latestToken;
    }
    throw error;
  }
}

async function authorizedRead(path: string): Promise<Response> {
  const headers = await requestAuthorizationHeaders(path);
  let response = await fetchGetWithRetry(resolveApiUrl(path), { headers });
  if (response.status === 401 && headers.Authorization) {
    const previousToken = headers.Authorization.replace(/^Bearer\s+/i, "");
    const nextToken = await refreshSessionAfterUnauthorized(previousToken);
    response = await fetchGetWithRetry(resolveApiUrl(path), {
      headers: { ...headers, Authorization: `Bearer ${nextToken}` },
    });
  }
  return response;
}

export async function getJSON(path: string) {
  return handleResponse(await authorizedRead(path));
}

// Downloads a binary response, e.g. the care summary PDF.
export async function getBlob(path: string): Promise<Blob> {
  const res = await authorizedRead(path);
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.blob()
}

function hasStableIdempotencyKey(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const value = body as Record<string, unknown>;
  return [value.ingestion_key, value.idempotency_key, value.capture_idempotency_key].some(
    (key) => typeof key === "string" && key.trim().length > 0,
  );
}

export async function postJSON(path: string, body: unknown, extraHeaders: Record<string, string> = {}, requestOptions: { signal?: AbortSignal } = {}) {
  const authHeaders = await requestAuthorizationHeaders(path);
  const url = resolveApiUrl(path);
  const requestBody = JSON.stringify(body);
  let res = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders, ...extraHeaders },
    body: requestBody,
    signal: requestOptions.signal,
  });
  // Retry a rejected bearer only when the write carries a stable server-side
  // idempotency key. Never replay an arbitrary POST after an ambiguous outcome.
  if (res.status === 401 && authHeaders.Authorization && hasStableIdempotencyKey(body)) {
    const previousToken = authHeaders.Authorization.replace(/^Bearer\s+/i, "");
    const nextToken = await refreshSessionAfterUnauthorized(previousToken);
    res = await fetchWithTimeout(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders, ...extraHeaders, Authorization: `Bearer ${nextToken}` },
      body: requestBody,
      signal: requestOptions.signal,
    });
  }
  return handleResponse(res);
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

export type AccountCreateResponse = {
  account: { id: string; email: string; created_at: string | null };
  caregiver_profile_id: string;
  recovery_code: string;
  message: string;
};

/** Create an account against the current anonymous session so its existing care record is retained. */
export async function createAccount(email: string, password: string): Promise<AccountCreateResponse> {
  await ensureAnonymousSession();
  return await postJSON("/accounts", { email, password }) as AccountCreateResponse;
}

/** Sign in through the backend and replace the local anonymous capability with the account's scoped session. */
export type CaregiverInvitationAcceptResponse = {
  accepted: true;
  person_id: string;
  caregiver_id: string;
  caregiver_profile_id: string;
  session_id: string;
  access_token: string;
  token_type: "Bearer";
  expires_at: string;
  access_scope: string;
};

/** Accept a pre-authorised caregiver invitation and bind the returned session to this browser. */
export async function acceptCaregiverInvitation(input: {
  token: string;
  email: string;
  password: string;
  name: string;
}): Promise<CaregiverInvitationAcceptResponse> {
  const result = await postJSON(
    "/caregiver-access/invitations/accept",
    input,
  ) as CaregiverInvitationAcceptResponse;
  window.localStorage.setItem(ANONYMOUS_TOKEN_KEY, result.access_token);
  window.localStorage.setItem(ANONYMOUS_EXPIRY_KEY, result.expires_at);
  setCareIdentity(result.person_id, result.caregiver_id);
  return result;
}

export async function signInToAccount(email: string, password: string): Promise<AccountLoginResponse> {
  const res = await fetchWithTimeout("/api/v1/accounts/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const result = await handleResponse(res) as AccountLoginResponse;
  window.localStorage.setItem(ANONYMOUS_TOKEN_KEY, result.access_token);
  window.localStorage.setItem(ANONYMOUS_EXPIRY_KEY, result.expires_at);
  setCareIdentity(result.person_id, result.caregiver_id);
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
/** Preserve the local deletion boundary even when the server cannot be reached. */
export function markAnonymousSessionRevokedLocally(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ANONYMOUS_SESSION_REVOKED_KEY, createSessionRevocationMarker());
  anonymousSessionPromise = null;
  window.localStorage.removeItem(ANONYMOUS_TOKEN_KEY);
  window.localStorage.removeItem(ANONYMOUS_PERSON_KEY);
  window.localStorage.removeItem(ANONYMOUS_CAREGIVER_KEY);
  window.localStorage.removeItem(ANONYMOUS_EXPIRY_KEY);
  window.dispatchEvent(new Event("personIdChanged"));
}

export async function revokeAnonymousSession(): Promise<void> {
  // A browser with no bearer has no server session to revoke. Do not let the
  // generic protected-request path silently create one just to delete it.
  if (!getAnonymousAccessToken()) {
    markAnonymousSessionRevokedLocally();
    return;
  }
  await postJSON("/sessions/revoke", {});
  markAnonymousSessionRevokedLocally();
}

// Multipart uploads go directly to Railway to avoid Netlify's proxy body-size
// limits. Do not set Content-Type manually: the browser must add the boundary.
export async function postFormData(path: string, body: FormData) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const backendPath = normalized.startsWith("/api/v1/")
    ? normalized
    : `/api/v1${normalized}`;
  const headers = await requestAuthorizationHeaders(backendPath);
  const url = apiUrl(backendPath);
  let res = await fetchWithTimeout(url, {
    method: "POST",
    headers,
    body,
  });
  const ingestionKey = body.get("ingestion_key");
  if (res.status === 401 && headers.Authorization && typeof ingestionKey === "string" && ingestionKey.trim()) {
    const previousToken = headers.Authorization.replace(/^Bearer\s+/i, "");
    const nextToken = await refreshSessionAfterUnauthorized(previousToken);
    res = await fetchWithTimeout(url, {
      method: "POST",
      headers: { ...headers, Authorization: `Bearer ${nextToken}` },
      body,
    });
  }
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
  if (typeof window === "undefined") return { authenticated: false, sessionInfo: null };

  const token = window.localStorage.getItem(ANONYMOUS_TOKEN_KEY);
  const personId = window.localStorage.getItem(ANONYMOUS_PERSON_KEY);
  const caregiverId = window.localStorage.getItem(ANONYMOUS_CAREGIVER_KEY);
  const expiresAt = window.localStorage.getItem(ANONYMOUS_EXPIRY_KEY);
  if (!token || !personId || !caregiverId || !expiresAt) {
    return { authenticated: false, sessionInfo: null };
  }

  // Validate the current capability without calling getJSON(): that helper may
  // bootstrap a new anonymous record when no token exists. Auth checks must
  // never create or silently switch a care record.
  const response = await fetchWithTimeout("/api/v1/accounts/me", {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.status === 401 || response.status === 403) {
    return { authenticated: false, sessionInfo: null };
  }
  const result = await handleResponse(response) as {
    account: { id: string; email: string; created_at: string | null } | null;
  };
  if (!result.account) return { authenticated: false, sessionInfo: null };

  return {
    authenticated: true,
    sessionInfo: {
      authenticated: true,
      account_id: result.account.id,
      session_type: "account",
      authorized_person_ids: [personId],
      caregiver_roles: {},
      professional_roles: {},
      anonymous_session_id: null,
      expires_at: expiresAt,
      mfa_verified: false,
    },
  };
}

export function subscribeToAuthState(
  callback: (authenticated: boolean, sessionInfo: AuthSessionInfo | null) => void,
): () => void {
  if (typeof window === "undefined") return () => undefined;
  let active = true;
  const refresh = () => {
    void checkAuthState()
      .then(({ authenticated, sessionInfo }) => {
        if (active) callback(authenticated, sessionInfo);
      })
      .catch(() => {
        if (active) callback(false, null);
      });
  };
  window.addEventListener("personIdChanged", refresh);
  window.addEventListener("storage", refresh);
  return () => {
    active = false;
    window.removeEventListener("personIdChanged", refresh);
    window.removeEventListener("storage", refresh);
  };
}

export function startTokenRefresh(): void {
  // No backend-issued token exists to refresh until authentication is implemented.
}

export function stopTokenRefresh(): void {
  // No active token-refresh task exists.
}
