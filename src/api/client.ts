const viteApiBase = import.meta.env?.VITE_API_BASE
const nextApiBase = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_API_BASE : undefined
const API_BASE = viteApiBase || nextApiBase || 'http://localhost:8000/api/v1'
export const ACCESS_TOKEN_STORAGE_KEY = 'solenos_access_token'

export function getAccessToken(): string | null {
  return typeof localStorage === 'undefined' ? null : localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)
}

export function setAccessToken(token: string): void {
  localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token)
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('solenos:auth-changed'))
}

export function clearAccessToken(): void {
  if (typeof localStorage !== 'undefined') localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY)
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('solenos:auth-changed'))
}

export function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = getAccessToken()
  return token ? { ...extra, Authorization: 'Bearer ' + token } : extra
}

export function getPersonId(): string {
  return typeof localStorage === 'undefined' ? '' : (localStorage.getItem('solenos_person_id') || '')
}

export function setPersonId(id: string): void {
  localStorage.setItem('solenos_person_id', id)
  window.dispatchEvent(new Event('personIdChanged'))
}

export function getCaregiverId(): string | null {
  return typeof localStorage === 'undefined' ? null : localStorage.getItem('solenos_caregiver_id')
}

export function setCaregiverId(id: string): void {
  localStorage.setItem('solenos_caregiver_id', id)
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

function interpolatePersonId(path: string): string {
  if (path.includes('demo-person-id')) {
    const personId = getPersonId()
    if (!personId) throw new Error('Select an authorized care record before loading or changing care data.')
    return path.replace(/demo-person-id/g, personId)
  }
  return path
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

  if (typeof res.text !== 'function') return res.json()
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
  const res = await fetch(`${API_BASE}${interpolatePersonId(path)}`, { headers: authHeaders() })
  return handleResponse(res)
}

// Downloads a binary response, e.g. the care summary PDF. Kept here so the API
// base is resolved in one place rather than reconstructed by a caller that would
// otherwise hardcode a second copy of the localhost default.
export async function getBlob(path: string): Promise<Blob> {
  const res = await fetch(`${API_BASE}${interpolatePersonId(path)}`, { headers: authHeaders() })
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`)
  }
  return res.blob()
}

export async function postJSON(path: string, body: unknown, personId?: boolean) {
  const res = await fetch(`${API_BASE}${personId ? interpolatePersonId(path) : path}`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })
  return handleResponse(res)
}

export async function patchJSON(path: string, body: unknown, personId?: boolean) {
  const res = await fetch(`${API_BASE}${personId ? interpolatePersonId(path) : path}`, {
    method: 'PATCH',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })
  return handleResponse(res)
}

export async function postFormData(path: string, body: FormData) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: authHeaders(),
    body,
  })
  return handleResponse(res)
}
