import { getAccessToken, clearAccessToken, authHeaders, getPersonId } from './authSession';

declare global {
  interface ImportMetaEnv {
    VITE_API_BASE?: string
    VITE_SENTRY_DSN?: string
    VITE_SENTRY_ENVIRONMENT?: string
    VITE_SENTRY_RELEASE?: string
  }
  interface ImportMeta {
    readonly env: ImportMetaEnv
  }
}

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

function interpolatePersonId(path: string): string {
  if (!path.includes('demo-person-id')) return path
  const personId = getPersonId()
  if (!personId) throw new Error('Select an authorized care record before loading or changing care data.')
  return path.replace(/demo-person-id/g, personId)
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
    throw new Error(message)
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

function resolveApiUrl(path: string, interpolate = false): string {
  const resolvedPath = interpolate ? interpolatePersonId(path) : path
  return resolvedPath.startsWith('/api/') ? resolvedPath : `${API_BASE}${resolvedPath}`
}

export async function getJSON(path: string) {
  const res = await fetch(resolveApiUrl(path, true), { headers: authHeaders() })
  return handleResponse(res)
}

export async function getBlob(path: string): Promise<Blob> {
  const res = await fetch(resolveApiUrl(path, true), { headers: authHeaders() })
  if (!res.ok) throw new Error(`Request failed: ${res.status}`)
  return res.blob()
}

export async function postJSON(path: string, body: unknown, personId?: boolean) {
  const res = await fetch(resolveApiUrl(path, Boolean(personId)), {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })
  return handleResponse(res)
}

export async function patchJSON(path: string, body: unknown, personId?: boolean) {
  const res = await fetch(resolveApiUrl(path, Boolean(personId)), {
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
