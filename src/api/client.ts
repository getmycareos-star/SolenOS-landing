// Same-origin API proxy for Vite development and Netlify production.
const API_BASE = '/api/v1'
const TOKEN_KEY = 'solenos_access_token'
const AUTH_EVENT = 'solenosAuthChanged'

function isPlaceholderIdentifier(value: string | null | undefined): boolean {
  if (!value?.trim()) return true
  return /^(?:demo|sample|test|fake|placeholder)(?:[-_:]|$)|^(?:current-user-id|team-moderator)$/i.test(value.trim())
}

export function getAccessToken(): string | null {
  const token = localStorage.getItem(TOKEN_KEY)?.trim()
  return token || null
}

export function setAuthSession(token: string, accountId?: string | null): void {
  localStorage.setItem(TOKEN_KEY, token)
  if (accountId) localStorage.setItem('solenos_account_id', accountId)
  window.dispatchEvent(new Event(AUTH_EVENT))
}

export function clearAuthSession(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem('solenos_account_id')
  localStorage.removeItem('solenos_person_id')
  localStorage.removeItem('solenos_caregiver_id')
  window.dispatchEvent(new Event(AUTH_EVENT))
}

export function getPersonId(): string {
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

export function setCaregiverId(id: string): void {
  const normalized = id.trim()
  if (isPlaceholderIdentifier(normalized)) {
    localStorage.removeItem('solenos_caregiver_id')
  } else {
    localStorage.setItem('solenos_caregiver_id', normalized)
  }
}

export function getCaregiverId(): string | null {
  const id = localStorage.getItem('solenos_caregiver_id')?.trim() || ''
  return isPlaceholderIdentifier(id) ? null : id
}

function resolveApiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  if (normalized === '/situation' || normalized.startsWith('/situation?')) {
    return `/api${normalized}`
  }
  return `${API_BASE.replace(/\/$/, '')}${normalized}`
}

function requestHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra)
  const token = getAccessToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return headers
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
        // Keep the status-based error.
      }
    } else {
      const text = await res.text()
      message = text || message
    }
    if (res.status === 401 && getAccessToken()) clearAuthSession()
    throw new Error(message)
  }
  if (!isJson) throw new Error(`Expected JSON but received ${contentType || 'empty response'}`)
  const text = await res.text()
  if (!text) throw new Error('Empty response from server')
  try {
    return JSON.parse(text)
  } catch {
    throw new Error('Invalid JSON response from server')
  }
}

export async function getJSON(path: string) {
  const res = await fetch(resolveApiUrl(path), { headers: requestHeaders() })
  return handleResponse(res)
}

export async function getBlob(path: string): Promise<Blob> {
  const res = await fetch(resolveApiUrl(path), { headers: requestHeaders() })
  if (!res.ok) {
    if (res.status === 401 && getAccessToken()) clearAuthSession()
    throw new Error(`Request failed: ${res.status}`)
  }
  return res.blob()
}

export async function postJSON(path: string, body: unknown) {
  const res = await fetch(resolveApiUrl(path), {
    method: 'POST',
    headers: requestHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })
  return handleResponse(res)
}

export async function patchJSON(path: string, body: unknown) {
  const res = await fetch(resolveApiUrl(path), {
    method: 'PATCH',
    headers: requestHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })
  return handleResponse(res)
}

export async function postFormData(path: string, body: FormData) {
  const res = await fetch(resolveApiUrl(path), {
    method: 'POST',
    headers: requestHeaders(),
    body,
  })
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
    const personIds = Array.isArray(contexts)
      ? contexts.map((item: any) => item?.person_id).filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
      : []
    if (!getPersonId() && personIds.length > 0) setPersonId(personIds[0])
    const links = await getJSON('/auth/my-caregiver-links')
    const selectedPerson = getPersonId()
    const linkedCaregiver = Array.isArray(links)
      ? links.find((item: any) => item?.person_id === selectedPerson && typeof item?.caregiver_id === 'string')
      : null
    if (linkedCaregiver) setCaregiverId(linkedCaregiver.caregiver_id)
    return {
      authenticated: true,
      sessionInfo: {
        authenticated: true,
        account_id: typeof account?.id === 'string' ? account.id : localStorage.getItem('solenos_account_id'),
        session_type: 'bearer',
        authorized_person_ids: personIds,
        caregiver_roles: {},
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
  const handler = async () => {
    const state = await checkAuthState()
    callback(state.authenticated, state.sessionInfo)
  }
  window.addEventListener(AUTH_EVENT, handler)
  return () => window.removeEventListener(AUTH_EVENT, handler)
}

export function startTokenRefresh(): void {
  // Sessions are server-issued and expire after a fixed lifetime. There is no
  // refresh-token endpoint; the client must not manufacture or extend a session.
}

export function stopTokenRefresh(): void {
  // No client-side refresh timer exists.
}
