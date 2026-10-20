declare global {
  interface ImportMetaEnv {
    VITE_API_BASE?: string
    PROD?: boolean
  }
  interface ImportMeta {
    readonly env: ImportMetaEnv
  }
}

const CONFIGURED_API_BASE = import.meta.env.VITE_API_BASE?.trim()
const ACCESS_TOKEN_KEY = 'solenos_access_token'

export function getAccessToken(): string | null {
  return sessionStorage.getItem(ACCESS_TOKEN_KEY)
}

export function setAccessToken(token: string): void {
  sessionStorage.setItem(ACCESS_TOKEN_KEY, token)
  window.dispatchEvent(new Event('authChanged'))
}

export function clearAccessToken(): void {
  sessionStorage.removeItem(ACCESS_TOKEN_KEY)
  window.dispatchEvent(new Event('authChanged'))
}

export function isAuthenticated(): boolean {
  return Boolean(getAccessToken())
}

export function getPersonId(): string {
  return localStorage.getItem('solenos_person_id') || 'demo-person-id'
}

export function setPersonId(id: string): void {
  localStorage.setItem('solenos_person_id', id)
  window.dispatchEvent(new Event('personIdChanged'))
}

export function clearPersonId(): void {
  localStorage.removeItem('solenos_person_id')
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

function getApiBase(): string {
  if (import.meta.env.PROD && (!CONFIGURED_API_BASE || CONFIGURED_API_BASE.includes('your-solenos-backend-domain.com'))) {
    throw new Error('SolenOS backend URL is not configured. Set VITE_API_BASE to the deployed backend API URL in Netlify.')
  }
  return CONFIGURED_API_BASE || 'http://localhost:8000/api/v1'
}

function requestHeaders(json = false): Record<string, string> {
  const headers: Record<string, string> = {}
  if (json) headers['Content-Type'] = 'application/json'
  const token = getAccessToken()
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

async function handleResponse(res: Response, path = '') {
  const contentType = res.headers.get('content-type') || ''
  const isJson = contentType.includes('application/json')

  if (res.status === 204) return null

  if (!res.ok) {
    if (res.status === 401 && getAccessToken() && !path.endsWith('/auth/login') && !path.endsWith('/auth/signup')) {
      clearAccessToken()
      clearPersonId()
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
  const res = await fetch(`${getApiBase()}${interpolatePersonId(path)}`, { headers: requestHeaders() })
  return handleResponse(res, path)
}

// Downloads a binary response, e.g. the care summary PDF. Kept here so the API
// base is resolved in one place rather than reconstructed by a caller that would
// otherwise hardcode a second copy of the localhost default.
export async function getBlob(path: string): Promise<Blob> {
  const res = await fetch(`${getApiBase()}${interpolatePersonId(path)}`, { headers: requestHeaders() })
  if (!res.ok) {
    if (res.status === 401 && getAccessToken()) {
      clearAccessToken()
      clearPersonId()
    }
    throw new Error(`Request failed: ${res.status}`)
  }
  return res.blob()
}

export async function postJSON(path: string, body: unknown, personId?: boolean) {
  const res = await fetch(`${getApiBase()}${personId ? interpolatePersonId(path) : path}`, {
    method: 'POST',
    headers: requestHeaders(true),
    body: JSON.stringify(body),
  })
  return handleResponse(res, path)
}

export async function patchJSON(path: string, body: unknown, personId?: boolean) {
  const res = await fetch(`${getApiBase()}${personId ? interpolatePersonId(path) : path}`, {
    method: 'PATCH',
    headers: requestHeaders(true),
    body: JSON.stringify(body),
  })
  return handleResponse(res, path)
}


export async function logout(): Promise<void> {
  try {
    await postJSON('/auth/logout', {})
  } finally {
    clearAccessToken()
    clearPersonId()
  }
}
