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

const AUTH_TOKEN_KEY = 'solenos_access_token'

function getAccessToken(): string | null {
  try {
    return sessionStorage.getItem(AUTH_TOKEN_KEY)
  } catch {
    return null
  }
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = getAccessToken()
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra
}

function notifyAuthStateChanged(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('solenosAuthStateChanged'))
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
  const res = await fetch(resolveApiUrl(path), { headers: authHeaders() })
  return handleResponse(res)
}

// Downloads a binary response, e.g. the care summary PDF.
export async function getBlob(path: string): Promise<Blob> {
  const res = await fetch(resolveApiUrl(path), { headers: authHeaders() })
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`)
  }
  return res.blob()
}

export async function postJSON(path: string, body: unknown) {
  const res = await fetch(resolveApiUrl(path), {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })
  return handleResponse(res)
}

export async function patchJSON(path: string, body: unknown) {
  const res = await fetch(resolveApiUrl(path), {
    method: 'PATCH',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })
  return handleResponse(res)
}


// Multipart upload helper. Do not set Content-Type manually: the browser must
// add the multipart boundary for FormData requests.
export async function postFormData(path: string, body: FormData) {
  const res = await fetch(resolveApiUrl(path), {
    method: 'POST',
    headers: authHeaders(),
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

// Account sessions are issued by the backend. Anonymous browsing remains possible;
// protected API calls are not treated as authenticated unless a server-issued token exists.
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

interface AuthAccount {
  id: string
  email: string
  display_name?: string | null
}

export async function loginAccount(email: string, password: string): Promise<AuthAccount> {
  const response = await postJSON('/auth/login', { email: email.trim().toLowerCase(), password })
  if (typeof response?.access_token !== 'string' || !response.access_token) {
    throw new Error('The backend did not issue a valid session token.')
  }
  sessionStorage.setItem(AUTH_TOKEN_KEY, response.access_token)
  notifyAuthStateChanged()
  const state = await checkAuthState()
  if (!state.authenticated || !state.sessionInfo) {
    throw new Error('The backend session could not be verified.')
  }
  return { id: state.sessionInfo.account_id || '', email: email.trim().toLowerCase() }
}

export async function createAccount(email: string, password: string, displayName?: string): Promise<AuthAccount> {
  await postJSON('/auth/signup', {
    email: email.trim().toLowerCase(),
    password,
    display_name: displayName?.trim() || undefined,
  })
  return loginAccount(email, password)
}

export async function logoutAccount(): Promise<void> {
  const token = getAccessToken()
  try {
    if (token) {
      const response = await fetch(resolveApiUrl('/auth/logout'), {
        method: 'POST',
        headers: authHeaders(),
      })
      if (!response.ok && response.status !== 401) {
        throw new Error(`Logout could not be confirmed (API ${response.status}).`)
      }
    }
  } finally {
    sessionStorage.removeItem(AUTH_TOKEN_KEY)
    setPersonId('')
    notifyAuthStateChanged()
  }
}

export async function checkAuthState(): Promise<{ authenticated: boolean; sessionInfo: AuthSessionInfo | null }> {
  if (!getAccessToken()) return { authenticated: false, sessionInfo: null }
  try {
    const me = await getJSON('/auth/me')
    const account: AuthAccount | undefined = me?.account
    if (!account?.id) throw new Error('Invalid account response')
    let contexts: Array<{ person_id: string; role?: string }> = []
    try {
      const result = await getJSON('/auth/care-contexts')
      if (Array.isArray(result)) contexts = result
    } catch {
      // A valid account session can exist before a care record is created.
    }
    const authorizedPersonIds = contexts.map(item => item.person_id).filter((id): id is string => typeof id === 'string' && id.length > 0)
    const selectedPersonId = getPersonId()
    if (selectedPersonId && !authorizedPersonIds.includes(selectedPersonId)) {
      setPersonId(authorizedPersonIds[0] || '')
    }

    return {
      authenticated: true,
      sessionInfo: {
        authenticated: true,
        account_id: account.id,
        session_type: 'account',
        authorized_person_ids: authorizedPersonIds,
        caregiver_roles: Object.fromEntries(contexts.map(item => [item.person_id, item.role || 'caregiver'])),
        professional_roles: {},
        anonymous_session_id: null,
        expires_at: '',
        mfa_verified: false,
      },
    }
  } catch {
    sessionStorage.removeItem(AUTH_TOKEN_KEY)
    notifyAuthStateChanged()
    return { authenticated: false, sessionInfo: null }
  }
}

export function subscribeToAuthState(
  callback: (authenticated: boolean, sessionInfo: AuthSessionInfo | null) => void,
): () => void {
  const handler = async () => {
    const state = await checkAuthState()
    callback(state.authenticated, state.sessionInfo)
  }
  window.addEventListener('solenosAuthStateChanged', handler)
  return () => window.removeEventListener('solenosAuthStateChanged', handler)
}

export function startTokenRefresh(): void {
  // The current backend issues expiring sessions but has no refresh endpoint.
  // checkAuthState validates the session; expired sessions are cleared on next API/auth check.
}

export function stopTokenRefresh(): void {
  // No background refresh timer is created without a backend refresh-token contract.
}
