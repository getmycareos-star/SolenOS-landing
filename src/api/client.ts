declare global {
  interface ImportMetaEnv {
    VITE_API_BASE?: string
    VITE_DEMO_MODE?: string
    VITE_SENTRY_DSN?: string
    VITE_SENTRY_ENVIRONMENT?: string
    VITE_SENTRY_RELEASE?: string
  }
  interface ImportMeta {
    readonly env: ImportMetaEnv
  }
}

const API_BASE = ((import.meta.env || {}).VITE_API_BASE || '/api/v1').replace(/\/$/, '')
const ACCESS_TOKEN_KEY = 'solenos_access_token'

export interface AuthAccount {
  id: string
  email: string
  display_name?: string | null
}

export interface CareContext {
  person_id: string
  name: string
  role: string
  permissions: string[]
}

export function getAccessToken(): string | null {
  return sessionStorage.getItem(ACCESS_TOKEN_KEY)
}

export function getAuthHeaders(): Record<string, string> {
  const token = getAccessToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  const token = getAccessToken()
  if (!token) return init ? fetch(url, init) : fetch(url)
  const headers = new Headers(init?.headers)
  headers.set('Authorization', `Bearer ${token}`)
  return fetch(url, { ...init, headers })
}

function notifyAuthStateChanged(): void {
  window.dispatchEvent(new Event('authStateChanged'))
}

export function getPersonId(): string {
  return localStorage.getItem('solenos_person_id') ||
    ((import.meta.env || {}).VITE_DEMO_MODE === 'true' ? 'demo-person-id' : '')
}

export function setPersonId(id: string): void {
  localStorage.setItem('solenos_person_id', id)
  window.dispatchEvent(new Event('personIdChanged'))
}

export function subscribeToPersonId(callback: (id: string) => void): () => void {
  const handler = () => callback(getPersonId())
  window.addEventListener('personIdChanged', handler)
  return () => window.removeEventListener('personIdChanged', handler)
}

function interpolatePersonId(path: string): string {
  return path.replace(/demo-person-id/g, getPersonId())
}

function requestUrl(path: string, interpolate = true): string {
  const resolvedPath = interpolate ? interpolatePersonId(path) : path
  if (resolvedPath === '/situation' || resolvedPath.startsWith('/situation?')) {
    const apiRoot = API_BASE.replace(/\/api\/v1$/, '/api')
    return `${apiRoot}${resolvedPath}`
  }
  return `${API_BASE}${resolvedPath}`
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
        // Retain the status-based message when an error body is malformed.
      }
    } else {
      const responseText = await res.text()
      message = responseText || message
    }
    throw new Error(message)
  }

  if (!isJson) {
    throw new Error(`Expected JSON but received ${contentType || 'empty response'}`)
  }

  const responseText = await res.text()
  if (!responseText) throw new Error('Empty response from server')
  try {
    return JSON.parse(responseText)
  } catch {
    throw new Error('Invalid JSON response from server')
  }
}

export async function getJSON(path: string) {
  return handleResponse(await apiFetch(requestUrl(path)))
}

export async function getBlob(path: string): Promise<Blob> {
  const res = await apiFetch(requestUrl(path))
  if (!res.ok) throw new Error(`Request failed: ${res.status}`)
  return res.blob()
}

export async function postJSON(path: string, body: unknown, interpolate = false) {
  return handleResponse(await apiFetch(requestUrl(path, interpolate), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }))
}

export async function patchJSON(path: string, body: unknown, interpolate = false) {
  return handleResponse(await apiFetch(requestUrl(path, interpolate), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }))
}

export async function signUp(email: string, password: string, displayName: string): Promise<AuthAccount> {
  return await postJSON('/auth/signup', {
    email: email.trim().toLowerCase(),
    password,
    display_name: displayName.trim() || undefined,
  }) as AuthAccount
}

export async function logIn(email: string, password: string): Promise<AuthAccount> {
  const result = await postJSON('/auth/login', {
    email: email.trim().toLowerCase(),
    password,
  }) as { access_token: string; account: AuthAccount }

  if (!result.access_token || !result.account?.id) {
    throw new Error('The server returned an incomplete login response.')
  }
  sessionStorage.setItem(ACCESS_TOKEN_KEY, result.access_token)
  notifyAuthStateChanged()
  return result.account
}

export async function getCareContexts(): Promise<CareContext[]> {
  return await getJSON('/auth/care-contexts') as CareContext[]
}

export async function createCareContext(name: string): Promise<CareContext> {
  // The backend atomically creates the care recipient, owner grant, caregiver
  // identity, and verified account-to-caregiver link.
  return await postJSON('/auth/care-contexts', { name: name.trim() }) as CareContext
}

export async function logOut(): Promise<void> {
  const token = getAccessToken()
  try {
    if (token) {
      await apiFetch(requestUrl('/auth/logout'), { method: 'POST' })
    }
  } finally {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY)
    localStorage.removeItem('solenos_person_id')
    notifyAuthStateChanged()
  }
}

export async function checkAuthState(): Promise<{ authenticated: boolean; sessionInfo: AuthAccount | null }> {
  if (!getAccessToken()) return { authenticated: false, sessionInfo: null }
  try {
    const account = await getJSON('/auth/me') as AuthAccount
    return { authenticated: true, sessionInfo: account }
  } catch {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY)
    return { authenticated: false, sessionInfo: null }
  }
}

export function subscribeToAuthState(
  callback: (authenticated: boolean, sessionInfo: AuthAccount | null) => void,
): () => void {
  let active = true
  const handler = () => {
    void checkAuthState().then(state => {
      if (active) callback(state.authenticated, state.sessionInfo)
    })
  }
  window.addEventListener('authStateChanged', handler)
  return () => {
    active = false
    window.removeEventListener('authStateChanged', handler)
  }
}

export function startTokenRefresh(): void {
  // The backend exposes expiring sessions but no refresh-token endpoint.
}

export function stopTokenRefresh(): void {
  // No refresh timer is active.
}
