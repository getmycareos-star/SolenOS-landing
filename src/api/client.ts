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
  const res = await fetch(resolveApiUrl(path))
  return handleResponse(res)
}

// Downloads a binary response, e.g. the care summary PDF.
export async function getBlob(path: string): Promise<Blob> {
  const res = await fetch(resolveApiUrl(path))
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`)
  }
  return res.blob()
}

export async function postJSON(path: string, body: unknown) {
  const res = await fetch(resolveApiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return handleResponse(res)
}

export async function patchJSON(path: string, body: unknown) {
  const res = await fetch(resolveApiUrl(path), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return handleResponse(res)
}


// Multipart upload helper. Do not set Content-Type manually: the browser must
// add the multipart boundary for FormData requests.
export async function postFormData(path: string, body: FormData) {
  const res = await fetch(resolveApiUrl(path), {
    method: 'POST',
    body,
  })
  return handleResponse(res)
}

// Caregiver identity is only accepted when explicitly stored by the current
// frontend session. Never fabricate a caregiver ID for a care record.
export function getCaregiverId(): string | null {
  const id = localStorage.getItem('solenos_caregiver_id')?.trim() || ''
  return isPlaceholderIdentifier(id) ? null : id
}

// The backend currently has no implemented authentication/session endpoints.
// Fail closed rather than treating a client-side role choice as authentication.
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
