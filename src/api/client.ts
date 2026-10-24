// Use the same-origin API proxy in both Vite development and Netlify production.
// vite.config.ts and netlify.toml forward /api/* to the backend, so the browser
// never needs a hard-coded backend hostname or import.meta.env in Jest.
const API_BASE = '/api/v1'

function isPlaceholderIdentifier(value: string | null | undefined): boolean {
  if (!value?.trim()) return true
  return /^(?:demo|sample|test|fake|placeholder)(?:[-_:]|$)|^(?:current-user-id|team-moderator)$/i.test(value.trim())
}

export function getPersonId(): string {
  // Older builds may have persisted a demo ID in localStorage. Never send it
  // to the API as if it identified a real care recipient.
  const id = localStorage.getItem('solenos_person_id')?.trim() || ''
  return isPlaceholderIdentifier(id) ? '' : id
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
      Date.parse(expiresAt) > Date.now() + 24 * 60 * 60 * 1000
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

    const refreshResponse = await fetch("/api/v1/sessions/refresh", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const refreshed = (await handleResponse(refreshResponse)) as AnonymousSession;
    // The backend refresh endpoint returns the same nested person/caregiver
    // shape as anonymous bootstrap. Keep the contract identical on both paths.
    window.localStorage.setItem(ANONYMOUS_TOKEN_KEY, refreshed.access_token);
    window.localStorage.setItem(ANONYMOUS_PERSON_KEY, refreshed.person.id);
    window.localStorage.setItem(ANONYMOUS_CAREGIVER_KEY, refreshed.caregiver.id);
    window.localStorage.setItem(ANONYMOUS_EXPIRY_KEY, refreshed.expires_at);
    setPersonId(refreshed.person.id);
    return refreshed;
  }

  // Existing record IDs without the bearer secret are not proof of ownership.
  // Do not silently create a new record and make the prior one appear lost.
  const legacyPersonId = window.localStorage.getItem("solenos_person_id")?.trim() || "";
  if (personId || caregiverId || (legacyPersonId && !isPlaceholderIdentifier(legacyPersonId))) {
    throw new Error(
      "This browser has a care-record ID but no session credential. SolenOS cannot safely restore that record automatically."
    );
  }

  const response = await fetch("/api/v1/sessions/anonymous", {
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

/** Share one in-flight bootstrap/refresh across concurrent components. */
export function ensureAnonymousSession(): Promise<AnonymousSession> {
  if (!anonymousSessionPromise) {
    anonymousSessionPromise = ensureAnonymousSessionInternal().finally(() => {
      anonymousSessionPromise = null;
    });
  }
  return anonymousSessionPromise;
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
  const res = await fetch(resolveApiUrl(path), { headers: authorizationHeaders() })
  return handleResponse(res)
}

// Downloads a binary response, e.g. the care summary PDF.
export async function getBlob(path: string): Promise<Blob> {
  const res = await fetch(resolveApiUrl(path), { headers: authorizationHeaders() })
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`)
  }
  return res.blob()
}

export async function postJSON(path: string, body: unknown) {
  const res = await fetch(resolveApiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authorizationHeaders() },
    body: JSON.stringify(body),
  })
  return handleResponse(res)
}

export async function patchJSON(path: string, body: unknown) {
  const res = await fetch(resolveApiUrl(path), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authorizationHeaders() },
    body: JSON.stringify(body),
  })
  return handleResponse(res)
}


// Multipart upload helper. Do not set Content-Type manually: the browser must
// add the multipart boundary for FormData requests.
export async function postFormData(path: string, body: FormData) {
  const res = await fetch(resolveApiUrl(path), {
    method: 'POST',
    headers: authorizationHeaders(),
    body,
  })
  return handleResponse(res)
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
