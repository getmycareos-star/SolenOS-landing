// All browser requests use the same-origin proxy. Netlify forwards /api/* to
// Railway; Vite development uses the proxy in vite.config.ts.
const API_BASE = '/api/v1'
const REQUEST_TIMEOUT_MS = 15_000
const RETRYABLE_GET_STATUSES = new Set([502, 503, 504])

export function getPersonId(): string {
  // Never fabricate a care-recipient ID. Callers must handle an unset ID.
  return localStorage.getItem('solenos_person_id') || ''
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

function resolveApiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`

  // This endpoint is mounted at /api/situation, not /api/v1/situation.
  if (normalized === '/situation' || normalized.startsWith('/situation?')) {
    return `/api${normalized}`
  }

  return `${API_BASE.replace(/\/$/, '')}${normalized}`
}

function getErrorMessage(payload: unknown, fallback: string): string {
  if (typeof payload === 'string' && payload.trim()) return payload.trim()
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>
    for (const key of ['detail', 'message', 'error']) {
      const value = record[key]
      if (typeof value === 'string' && value.trim()) return value.trim()
      if (Array.isArray(value)) {
        const parts = value.map((item) => {
          if (item && typeof item === 'object' && 'msg' in item) {
            return String((item as { msg: unknown }).msg)
          }
          return String(item)
        })
        if (parts.length) return parts.join('; ')
      }
    }
  }
  return fallback
}

async function handleResponse(res: Response): Promise<unknown> {
  const contentType = res.headers.get('content-type') || ''
  const raw = await res.text()
  let payload: unknown = raw

  if (raw && (contentType.includes('application/json') || contentType.includes('+json'))) {
    try {
      payload = JSON.parse(raw)
    } catch {
      if (res.ok) throw new Error('The server returned malformed JSON.')
      payload = raw
    }
  }

  if (!res.ok) {
    throw new Error(getErrorMessage(payload, `Request failed (HTTP ${res.status}).`))
  }

  // 204 and empty successful responses are valid HTTP responses.
  if (res.status === 204 || raw.length === 0) return null

  // Preserve non-JSON success responses instead of rejecting them blindly.
  return payload
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method || 'GET').toUpperCase()
  const canRetry = method === 'GET'
  const url = resolveApiUrl(path)
  const attempts = canRetry ? 2 : 1

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
      const response = await fetch(url, { ...init, signal: controller.signal })
      if (canRetry && attempt === 0 && RETRYABLE_GET_STATUSES.has(response.status)) {
        // Only retry safe reads. Never automatically retry create/update requests.
        await response.body?.cancel()
        continue
      }
      return response
    } catch (error) {
      if (isAbortError(error)) {
        throw new Error(`Request timed out after ${REQUEST_TIMEOUT_MS / 1000} seconds. Check your connection and try again.`)
      }
      if (!canRetry || attempt === attempts - 1) {
        throw new Error('Unable to reach SolenOS. Check your connection and try again.')
      }
    } finally {
      clearTimeout(timeout)
    }
  }
  throw new Error('Unable to complete the request.')
}

export async function getJSON<T = any>(path: string): Promise<T> {
  const res = await request(interpolatePersonId(path))
  return await handleResponse(res) as T
}

// Downloads a binary response, e.g. the care summary PDF.
export async function getBlob(path: string): Promise<Blob> {
  const res = await request(interpolatePersonId(path))
  if (!res.ok) {
    const message = await handleResponse(res).catch((error: unknown) =>
      error instanceof Error ? error.message : `Request failed (HTTP ${res.status}).`,
    )
    throw new Error(String(message))
  }
  return res.blob()
}

export async function postJSON<T = any>(path: string, body: unknown, personId?: boolean): Promise<T> {
  const resolvedPath = personId ? interpolatePersonId(path) : path
  const res = await request(resolvedPath, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return await handleResponse(res) as T
}

export async function patchJSON<T = any>(path: string, body: unknown, personId?: boolean): Promise<T> {
  const resolvedPath = personId ? interpolatePersonId(path) : path
  const res = await request(resolvedPath, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return await handleResponse(res) as T
}

// Multipart uploads must let the browser set the Content-Type boundary.
export async function postFormData<T = any>(path: string, body: FormData): Promise<T> {
  const res = await request(path, { method: 'POST', body })
  return await handleResponse(res) as T
}

// Caregiver identity is accepted only when explicitly stored by this session.
export function getCaregiverId(): string | null {
  return localStorage.getItem('solenos_caregiver_id')
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
  return () => undefined
}

export function startTokenRefresh(): void {
  // No backend-issued token exists to refresh until authentication is implemented.
}

export function stopTokenRefresh(): void {
  // No active token-refresh task exists.
}
