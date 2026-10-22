// All browser requests use the same-origin proxy. Netlify forwards /api/* to
// Railway; Vite development uses the proxy in vite.config.ts.
const API_BASE = '/api/v1'
const REQUEST_TIMEOUT_MS = 15_000
const RETRYABLE_GET_STATUSES = new Set([502, 503, 504])

const LEGACY_PLACEHOLDER_IDS = new Set([
  ['demo', 'person', 'id'].join('-'),
  ['demo', 'caregiver'].join('-'),
  ['current', 'user', 'id'].join('-'),
])

function readStoredIdentity(key: string): string {
  const stored = localStorage.getItem(key)
  const normalized = stored?.trim() || ''
  if (!normalized || LEGACY_PLACEHOLDER_IDS.has(normalized.toLowerCase())) {
    if (stored !== null) localStorage.removeItem(key)
    return ''
  }
  return normalized
}

export function getPersonId(): string {
  // Clear legacy placeholder IDs left by older builds; never send them to the API.
  return readStoredIdentity('solenos_person_id')
}

function interpolatePersonId(path: string): string {
  const legacyPlaceholder = ['demo', 'person', 'id'].join('-');
  if (!path.includes(legacyPlaceholder)) return path;

  const personId = getPersonId();
  if (!personId) {
    throw new Error('Select a care recipient before requesting a person-specific resource.');
  }
  return path.split(legacyPlaceholder).join(encodeURIComponent(personId));
}

export function setPersonId(id: string): void {
  const normalized = id.trim()
  if (!normalized || LEGACY_PLACEHOLDER_IDS.has(normalized.toLowerCase())) {
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

export interface AuthAccount {
  id: string
  email: string
  role: 'caregiver' | 'professional' | 'team'
  caregiver_id: string | null
  person_id: string | null
}

interface BackendAccount {
  id: string
  email: string
  role?: 'caregiver' | 'professional' | 'team'
  caregiver_id?: string | null
  person_id?: string | null
  display_name?: string | null
}

interface BackendLoginResponse {
  access_token: string
  token_type: 'bearer'
  expires_at?: string
  expires_in?: number
  account: BackendAccount
}

interface CareContext {
  person_id: string
  name: string
  role: string
  permissions: string[]
}

interface CaregiverLink {
  person_id: string
  caregiver_id: string
  account_id: string
  permissions: string[]
}

const AUTH_TOKEN_KEY = 'solenos_access_token'
const AUTH_EVENT = 'solenosAuthChanged'

export function getAccessToken(): string {
  return localStorage.getItem(AUTH_TOKEN_KEY) || ''
}

export function clearAuthSession(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY)
  localStorage.removeItem('solenos_caregiver_id')
  localStorage.removeItem('solenos_person_id')
  localStorage.removeItem('solenos_identifier')
  localStorage.removeItem('solenos_user_role')
  window.dispatchEvent(new Event(AUTH_EVENT))
  window.dispatchEvent(new Event('personIdChanged'))
}

function persistAuthToken(result: BackendLoginResponse): void {
  localStorage.setItem(AUTH_TOKEN_KEY, result.access_token)
  localStorage.setItem('solenos_identifier', result.account.email)
  window.dispatchEvent(new Event(AUTH_EVENT))
}

async function resolveSignedInAccount(
  backendAccount: BackendAccount,
  preferredPersonId?: string | null,
): Promise<AuthAccount> {
  const contexts = await getJSON<CareContext[]>('/auth/care-contexts')
  if (!Array.isArray(contexts)) {
    throw new Error('The backend returned an invalid care-context list; no identity was selected.')
  }
  if (!['caregiver', 'professional', 'team'].includes(backendAccount.role || '')) {
    throw new Error('The backend did not return a supported account role.')
  }
  const accountRole = backendAccount.role as AuthAccount['role']

  // Team accounts have no patient context. Professionals with no active grants,
  // or multiple grants, must not be assigned an arbitrary patient at sign-in.
  if (contexts.length === 0 && (accountRole === 'team' || accountRole === 'professional')) {
    const account: AuthAccount = {
      id: backendAccount.id,
      email: backendAccount.email,
      role: accountRole,
      caregiver_id: accountRole === 'professional' ? backendAccount.caregiver_id || null : null,
      person_id: null,
    }
    if (account.caregiver_id) localStorage.setItem('solenos_caregiver_id', account.caregiver_id)
    else localStorage.removeItem('solenos_caregiver_id')
    localStorage.setItem('solenos_user_role', account.role)
    setPersonId('')
    window.dispatchEvent(new Event(AUTH_EVENT))
    return account
  }

  if (contexts.length === 0) {
    throw new Error('This caregiver account has no linked care record. Create a care record or accept a caregiver invitation before continuing.')
  }

  const preferred = preferredPersonId
    ? contexts.find(context => context.person_id === preferredPersonId)
    : undefined
  if (!preferred && contexts.length > 1) {
    if (preferredPersonId) {
      throw new Error('The previously selected care record is not accessible to this account. Select a care record you are authorized to access.')
    }
    if (accountRole === 'professional') {
      const account: AuthAccount = {
        id: backendAccount.id,
        email: backendAccount.email,
        role: accountRole,
        caregiver_id: backendAccount.caregiver_id || null,
        person_id: null,
      }
      if (account.caregiver_id) localStorage.setItem('solenos_caregiver_id', account.caregiver_id)
      else localStorage.removeItem('solenos_caregiver_id')
      localStorage.setItem('solenos_user_role', account.role)
      setPersonId('')
      window.dispatchEvent(new Event(AUTH_EVENT))
      return account
    }
    throw new Error('This account has multiple care records. Select the correct care record before continuing; SolenOS will not choose one automatically.')
  }

  // If an old account's selected ID is stale but this account has exactly one
  // authorized care record, safely use that sole record instead.
  const context = preferred || contexts[0]
  if (context.role !== accountRole) {
    throw new Error('The selected care context role does not match the authenticated account.')
  }
  const links = await getJSON<CaregiverLink[]>(
    '/auth/my-caregiver-links?person_id=' + encodeURIComponent(context.person_id),
  )
  const link = Array.isArray(links)
    ? links.find(item =>
        item.person_id === context.person_id &&
        item.account_id === backendAccount.id &&
        typeof item.caregiver_id === 'string' &&
        item.caregiver_id.length > 0
      )
    : undefined
  if (!link) {
    throw new Error('The backend did not confirm an account-owned caregiver link for the selected care record.')
  }

  const role = context.role
  if (!['caregiver', 'professional', 'team'].includes(role)) {
    throw new Error('The backend returned an unsupported account role. Contact SolenOS support.')
  }
  const account: AuthAccount = {
    id: backendAccount.id,
    email: backendAccount.email,
    role: role as AuthAccount['role'],
    caregiver_id: link?.caregiver_id || null,
    person_id: context.person_id,
  }

  if (account.caregiver_id) localStorage.setItem('solenos_caregiver_id', account.caregiver_id)
  else localStorage.removeItem('solenos_caregiver_id')
  localStorage.setItem('solenos_user_role', account.role)
  setPersonId(context.person_id)
  window.dispatchEvent(new Event(AUTH_EVENT))
  return account
}

export async function loginWithPassword(email: string, password: string): Promise<AuthAccount> {
  const result = await postJSON<BackendLoginResponse>('/auth/login', { email, password })
  const previousEmail = localStorage.getItem('solenos_identifier')?.trim().toLowerCase()
  const preferredPersonId =
    previousEmail && previousEmail === result.account.email.trim().toLowerCase()
      ? getPersonId()
      : null

  // Clear the previous account's client-side identity before switching tokens.
  clearAuthSession()
  persistAuthToken(result)
  try {
    return await resolveSignedInAccount(result.account, preferredPersonId)
  } catch (error) {
    clearAuthSession()
    throw error
  }
}

export async function registerCaregiverAccount(input: {
  email: string
  password: string
  enrollment_key: string
  name: string
  person_name: string
  relationship?: string
}): Promise<AuthAccount> {
  if (!input.enrollment_key.trim()) {
    throw new Error('An authorized enrollment key is required to create an account.')
  }
  const result = await postJSON<BackendLoginResponse>('/auth/register', {
    email: input.email,
    password: input.password,
    enrollment_key: input.enrollment_key,
    name: input.name,
    person_name: input.person_name,
    relationship: input.relationship || 'Family caregiver',
  })
  clearAuthSession()
  persistAuthToken(result)
  try {
    return await resolveSignedInAccount(result.account)
  } catch (error) {
    clearAuthSession()
    throw error
  }
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
      const headers = new Headers(init.headers || {})
      const publicAuthRequest = path.endsWith('/auth/login') || path.endsWith('/auth/signup') || path.endsWith('/auth/provision')
      const token = getAccessToken()
      if (token && !publicAuthRequest) headers.set('Authorization', 'Bearer ' + token)
      const response = await fetch(url, { ...init, headers, signal: controller.signal })
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
  return readStoredIdentity('solenos_caregiver_id') || null
}

export interface AuthSessionInfo {
  authenticated: boolean
  account_id: string | null
  email: string | null
  role: string | null
  caregiver_id: string | null
  person_id: string | null
}

export async function checkAuthState(): Promise<{ authenticated: boolean; sessionInfo: AuthSessionInfo | null }> {
  if (!getAccessToken()) return { authenticated: false, sessionInfo: null }
  try {
    const sessionInfo = await getJSON<AuthSessionInfo>('/auth/me')
    return { authenticated: sessionInfo.authenticated === true, sessionInfo }
  } catch {
    clearAuthSession()
    return { authenticated: false, sessionInfo: null }
  }
}

export function subscribeToAuthState(callback: (authenticated: boolean, sessionInfo: AuthSessionInfo | null) => void): () => void {
  const handler = () => { void checkAuthState().then(result => callback(result.authenticated, result.sessionInfo)) }
  window.addEventListener(AUTH_EVENT, handler)
  return () => window.removeEventListener(AUTH_EVENT, handler)
}

export function startTokenRefresh(): void {
  // Access tokens expire; the client deliberately fails closed because no refresh-token contract exists yet.
}

export function stopTokenRefresh(): void {
  // No background refresh process is scheduled.
}
