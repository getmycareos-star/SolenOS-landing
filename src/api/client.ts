declare global {
  interface ImportMetaEnv {
    VITE_API_BASE?: string
  }
  interface ImportMeta {
    readonly env: ImportMetaEnv
  }
}

// Most backend endpoints are mounted at /api/v1. Netlify proxies /api/* to
// Railway, and Vite proxies /api/* to localhost:8000 during development.
const API_BASE = (import.meta.env.VITE_API_BASE || '/api/v1').replace(/\/$/, '')

export function getPersonId(): string {
  return localStorage.getItem('solenos_person_id') || 'demo-person-id'
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
  const res = await fetch(requestUrl(path))
  return handleResponse(res)
}

// Downloads a binary response, e.g. the care summary PDF.
export async function getBlob(path: string): Promise<Blob> {
  const res = await fetch(requestUrl(path))
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`)
  }
  return res.blob()
}

export async function postJSON(path: string, body: unknown, personId?: boolean) {
  const res = await fetch(requestUrl(path, personId === true), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return handleResponse(res)
}

export async function patchJSON(path: string, body: unknown, personId?: boolean) {
  const res = await fetch(requestUrl(path, personId !== false), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return handleResponse(res)
}
