const viteEnv = import.meta.env
const nextEnv = typeof process !== 'undefined' ? process.env : undefined
const viteApiBase = viteEnv?.VITE_API_BASE
const nextApiBase = nextEnv?.NEXT_PUBLIC_API_BASE
const isProduction = viteEnv?.PROD === true || nextEnv?.NODE_ENV === 'production'
// Netlify proxies /api/* to Railway. Production must never silently target localhost.
const API_BASE = (viteApiBase || nextApiBase || (isProduction ? '/api/v1' : 'http://localhost:8000/api/v1')).replace(/\/$/, '')
export const ACCESS_TOKEN_STORAGE_KEY = 'solenos_access_token'
const AUTH_CHANGED_EVENT = 'solenos:auth-changed'

function isPlaceholderIdentifier(value: string | null | undefined): boolean {
  if (!value?.trim()) return true
  return /^(?:demo|sample|test|fake|placeholder)(?:[-_:]|$)|^(?:current-user-id|team-moderator|demo-person-id)$/i.test(value.trim())
}

export function getAccessToken(): string | null {
  return typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)
}

export function setAccessToken(token: string): void {
  if (!token.trim()) {
    clearAccessToken()
    return
  }
  sessionStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token.trim())
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(AUTH_CHANGED_EVENT))
}

export function clearAccessToken(): void {
  if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY)
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(AUTH_CHANGED_EVENT))
}

export function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = getAccessToken()
  return token ? { ...extra, Authorization: 'Bearer ' + token } : extra
}

export function getPersonId(): string {
  if (typeof localStorage === 'undefined') return ''
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
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('personIdChanged'))
}

export function getCaregiverId(): string | null {
  if (typeof localStorage === 'undefined') return null
  const id = localStorage.getItem('solenos_caregiver_id')?.trim() || ''
  return isPlaceholderIdentifier(id) ? null : id
}

export function setCaregiverId(id: string): void {
  const normalized = id.trim()
  if (isPlaceholderIdentifier(normalized)) localStorage.removeItem('solenos_caregiver_id')
  else localStorage.setItem('solenos_caregiver_id', normalized)
}

export function clearCareContext(): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('solenos_person_id')
    localStorage.removeItem('solenos_caregiver_id')
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('personIdChanged'))
}

export function subscribeToPersonId(callback: (id: string) => void): () => void {
  const handler = () => callback(getPersonId())
  window.addEventListener('personIdChanged', handler)
  return () => window.removeEventListener('personIdChanged', handler)
}

function resolveApiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  // Situation capture is exposed at /api/situation as well as under /api/v1.
  if (normalized === '/situation' || normalized.startsWith('/situation?')) {
    return `/api${normalized}`
  }
  return `${API_BASE}${normalized}`
}

function interpolatePersonId(path: string): string {
  if (!path.includes('demo-person-id')) return path
  const personId = getPersonId()
  if (!personId) throw new Error('Select an authorized care record before loading or changing care data.')
  return path.replace(/demo-person-id/g, encodeURIComponent(personId))
}

async function handleResponse(res: Response) {
  if (res.status === 204) return null
  const contentType = res.headers?.get?.('content-type') || ''
  const isJson = contentType.includes('application/json') || (typeof res.text !== 'function' && typeof res.json === 'function')

  if (!res.ok) {
    if (res.status === 401) {
      clearAccessToken()
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('solenos:auth-expired'))
    }
    let message = `API ${res.status}`
    if (isJson) {
      try {
        const err = await res.json()
        message = err.detail || err.message || message
      } catch {
        // Keep the generic status message when the server body is unreadable.
      }
    } else {
      const text = await res.text()
      message = text || message
    }
    throw new Error(message)
  }

  if (!isJson) throw new Error(`Expected JSON but received ${contentType || 'empty response'}`)
  if (typeof res.text !== 'function') return res.json()
  const body = await res.text()
  if (!body) throw new Error('Empty response from server')
  try {
    return JSON.parse(body)
  } catch {
    throw new Error('Invalid JSON response from server')
  }
}

export async function getJSON(path: string) {
  const res = await fetch(resolveApiUrl(interpolatePersonId(path)), { headers: authHeaders() })
  return handleResponse(res)
}

export async function getBlob(path: string): Promise<Blob> {
  const res = await fetch(resolveApiUrl(interpolatePersonId(path)), { headers: authHeaders() })
  if (!res.ok) throw new Error(`Request failed: ${res.status}`)
  return res.blob()
}

export async function postJSON(path: string, body: unknown, personId?: boolean) {
  const normalizedPath = personId ? interpolatePersonId(path) : path
  const res = await fetch(resolveApiUrl(normalizedPath), {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })
  return handleResponse(res)
}

export async function patchJSON(path: string, body: unknown, personId?: boolean) {
  const normalizedPath = personId ? interpolatePersonId(path) : path
  const res = await fetch(resolveApiUrl(normalizedPath), {
    method: 'PATCH',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })
  return handleResponse(res)
}

export async function postFormData(path: string, body: FormData) {
  const res = await fetch(resolveApiUrl(path), { method: 'POST', headers: authHeaders(), body })
  return handleResponse(res)
}

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
  if (!getAccessToken()) return { authenticated: false, sessionInfo: null }
  try {
    const account = await getJSON('/auth/me')
    const contexts = await getJSON('/auth/care-contexts')
    const caregiverRoles: Record<string, string> = {}
    const authorizedPersonIds: string[] = []
    for (const context of (Array.isArray(contexts) ? contexts : [])) {
      if (typeof context?.person_id !== 'string' || !context.person_id) continue
      authorizedPersonIds.push(context.person_id)
      caregiverRoles[context.person_id] = typeof context.role === 'string' ? context.role : 'caregiver'
    }
    return {
      authenticated: true,
      sessionInfo: {
        authenticated: true,
        account_id: typeof account?.id === 'string' ? account.id : null,
        session_type: 'bearer',
        authorized_person_ids: authorizedPersonIds,
        caregiver_roles: caregiverRoles,
        professional_roles: {},
        anonymous_session_id: null,
        expires_at: '',
        mfa_verified: false,
      },
    }
  } catch {
    return { authenticated: false, sessionInfo: null }
  }
}

export function subscribeToAuthState(
  callback: (authenticated: boolean, sessionInfo: AuthSessionInfo | null) => void,
): () => void {
  let active = true
  const refresh = () => {
    void checkAuthState().then(({ authenticated, sessionInfo }) => {
      if (active) callback(authenticated, sessionInfo)
    })
  }
  window.addEventListener(AUTH_CHANGED_EVENT, refresh)
  window.addEventListener('solenos:auth-expired', refresh)
  return () => {
    active = false
    window.removeEventListener(AUTH_CHANGED_EVENT, refresh)
    window.removeEventListener('solenos:auth-expired', refresh)
  }
}

// The backend currently issues fixed-expiry bearer sessions, with no refresh endpoint.
export function startTokenRefresh(): void {}
export function stopTokenRefresh(): void {}
