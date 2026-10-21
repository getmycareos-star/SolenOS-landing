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

// Most backend endpoints are mounted at /api/v1. Netlify proxies /api/* to
// Railway, and Vite proxies /api/* to localhost:8000 during development.
const API_BASE = ((import.meta.env || {}).VITE_API_BASE || '/api/v1').replace(/\/$/, '')

export function getAccessToken(): string | null {
  return sessionStorage.getItem('solenos_access_token');
}

async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  const token = getAccessToken();
  if (!token) return fetch(url, init);
  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${token}`);
  return fetch(url, { ...init, headers });
}

export function getPersonId(): string {
  return localStorage.getItem('solenos_person_id') || ((import.meta.env || {}).VITE_DEMO_MODE === 'true' ? 'demo-person-id' : '')
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

// Situation capture is intentionally mounted at /api/situation, outside the
// versioned /api/v1 router. Keep that one endpoint on its actual backend path.
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
  const res = await apiFetch(requestUrl(path))
  return handleResponse(res)
}

// Downloads a binary response, e.g. the care summary PDF.
export async function getBlob(path: string): Promise<Blob> {
  const res = await apiFetch(requestUrl(path))
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`)
  }
  return res.blob()
}

export async function postJSON(path: string, body: unknown, personId?: boolean) {
  const res = await apiFetch(requestUrl(path, personId === true), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return handleResponse(res)
}

export async function patchJSON(path: string, body: unknown, personId?: boolean) {
  const res = await apiFetch(requestUrl(path, personId === true), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return handleResponse(res)
}


// Session endpoints backed by the FastAPI authentication router.
export async function signUp(email: string, password: string, displayName: string): Promise<AuthAccount> {
  return postJSON('/auth/signup', {
    email: email.trim().toLowerCase(),
    password,
    display_name: displayName.trim() || undefined,
  }) as Promise<AuthAccount>
}

export async function logIn(email: string, password: string): Promise<AuthAccount> {
  const result = await postJSON('/auth/login', {
    email: email.trim().toLowerCase(),
    password,
  }) as { access_token: string; account: AuthAccount }

  if (!result.access_token || !result.account?.id) {
    throw new Error('The server returned an incomplete login response.')
  }
  localStorage.setItem(ACCESS_TOKEN_KEY, result.access_token)
  notifyAuthStateChanged()
  return result.account
}

export async function getCareContexts(): Promise<CareContext[]> {
  return getJSON('/auth/care-contexts') as Promise<CareContext[]>
}

export async function createCareContext(name: string): Promise<CareContext> {
  return postJSON('/auth/care-contexts', { name: name.trim() }) as Promise<CareContext>
}

export async function logOut(): Promise<void> {
  const token = getAccessToken()
  try {
    if (token) {
      await fetch(requestUrl('/auth/logout'), {
        method: 'POST',
        headers: getAuthHeaders(),
      })
    }
  } finally {
    localStorage.removeItem(ACCESS_TOKEN_KEY)
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
    localStorage.removeItem(ACCESS_TOKEN_KEY)
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
  // Sessions are expiry-checked by the API; no refresh endpoint exists yet.
}

export function stopTokenRefresh(): void {
  // No refresh timer is active.
}
