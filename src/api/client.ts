import { getAccessToken, getAccessTokenExpiresAt, clearAccessToken, clearCareContext, authHeaders } from './authSession';
import { resolveApiPath } from './apiPath';

const configuredBase = import.meta.env.VITE_API_BASE?.trim()
const isProduction = import.meta.env.PROD === true
const invalidConfiguredBase = Boolean(
  configuredBase && /your-solenos-backend-domain\.com|localhost:8000/i.test(configuredBase),
)
// Use Netlify's same-origin proxy in production; only local development defaults to localhost.
const API_BASE = configuredBase && !invalidConfiguredBase
  ? configuredBase.replace(/\/+$/, '')
  : isProduction
    ? '/api/v1'
    : 'http://localhost:8000/api/v1'

export {
  ACCESS_TOKEN_STORAGE_KEY,
  getAccessToken,
  getAccessTokenExpiresAt,
  setAccessToken,
  clearAccessToken,
  authHeaders,
  getPersonId,
  setPersonId,
  getCaregiverId,
  setCaregiverId,
  clearCareContext,
  subscribeToPersonId,
} from './authSession';

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function handleResponse(res: Response) {
  if (res.status === 204) return null
  const contentType = res.headers?.get?.('content-type') || ''
  const isJson = contentType.includes('application/json') || (typeof res.text !== 'function' && typeof res.json === 'function')

  if (!res.ok) {
    if (res.status === 401) {
      clearAccessToken()
    }
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
    throw new ApiError(message, res.status)
  }

  if (!isJson) {
    throw new Error(`Expected JSON but received ${contentType || 'empty response'}`)
  }

  if (typeof res.text !== 'function') return res.json()
  const text = await res.text()
  if (!text) throw new Error('Empty response from server')
  try {
    return JSON.parse(text)
  } catch {
    throw new Error('Invalid JSON response from server')
  }
}

function resolveApiUrl(path: string): string {
  return resolveApiPath(path, API_BASE)
}

export async function getJSON(path: string) {
  const res = await fetch(resolveApiUrl(path), { headers: authHeaders() })
  return handleResponse(res)
}

export async function getBlob(path: string): Promise<Blob> {
  const res = await fetch(resolveApiUrl(path), { headers: authHeaders() })
  if (!res.ok) throw new Error(`Request failed: ${res.status}`)
  return res.blob()
}

export async function postJSON(path: string, body: unknown, personId?: boolean) {
  const res = await fetch(resolveApiUrl(path), {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })
  return handleResponse(res)
}

export async function patchJSON(path: string, body: unknown, personId?: boolean) {
  const res = await fetch(resolveApiUrl(path), {
    method: 'PATCH',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })
  return handleResponse(res)
}

export async function postFormData(path: string, body: FormData) {
  const res = await fetch(resolveApiUrl(path), {
    method: 'POST',
    headers: authHeaders(),
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
    const account = await getJSON('/auth/me') as { id?: string; account_id?: string }
    const contexts = await getJSON('/auth/care-contexts') as Array<{ person_id?: string; role?: string }>
    if (!account || !Array.isArray(contexts)) {
      return { authenticated: false, sessionInfo: null }
    }
    const accountId = account.id || account.account_id || null
    if (!accountId) return { authenticated: false, sessionInfo: null }
    const caregiverRoles: Record<string, string> = {}
    for (const context of contexts) {
      if (context.person_id) caregiverRoles[context.person_id] = context.role || 'caregiver'
    }
    return {
      authenticated: true,
      sessionInfo: {
        authenticated: true,
        account_id: accountId,
        session_type: 'caregiver',
        authorized_person_ids: contexts.flatMap(context => context.person_id ? [context.person_id] : []),
        caregiver_roles: caregiverRoles,
        professional_roles: {},
        anonymous_session_id: null,
        expires_at: getAccessTokenExpiresAt() || '',
        mfa_verified: false,
      },
    }
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      clearAccessToken()
      clearCareContext()
    }
    return { authenticated: false, sessionInfo: null }
  }
}

export function subscribeToAuthState(
  callback: (authenticated: boolean, sessionInfo: AuthSessionInfo | null) => void,
): () => void {
  const update = () => {
    void checkAuthState().then(({ authenticated, sessionInfo }) => callback(authenticated, sessionInfo))
  }
  window.addEventListener('solenos:auth-changed', update)
  window.addEventListener('solenos:auth-expired', update)
  window.addEventListener('personIdChanged', update)
  return () => {
    window.removeEventListener('solenos:auth-changed', update)
    window.removeEventListener('solenos:auth-expired', update)
    window.removeEventListener('personIdChanged', update)
  }
}

// The backend has no token-refresh endpoint. Expired server sessions are rejected
// by the API and cleared; do not simulate refresh locally.
export function startTokenRefresh(): void {}
export function stopTokenRefresh(): void {}

