declare global {
  interface ImportMetaEnv {
    VITE_API_BASE?: string
  }
  interface ImportMeta {
    readonly env: ImportMetaEnv
  }
}

// Production uses the same-origin Netlify proxy. Local Vite development proxies
// /api to the local FastAPI server (see vite.config.ts).
const configuredBase = import.meta.env.VITE_API_BASE || '/api/v1'
const API_BASE = configuredBase.replace(/\/$/, '')

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
        // Keep the generic status message when the error body is malformed.
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
  const res = await fetch(`${API_BASE}${interpolatePersonId(path)}`)
  return handleResponse(res)
}

export async function getBlob(path: string): Promise<Blob> {
  const res = await fetch(`${API_BASE}${interpolatePersonId(path)}`)
  if (!res.ok) throw new Error(`Request failed: ${res.status}`)
  return res.blob()
}

export async function postJSON(path: string, body: unknown, personId?: boolean) {
  const res = await fetch(`${API_BASE}${personId ? interpolatePersonId(path) : path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return handleResponse(res)
}

export async function patchJSON(path: string, body: unknown, personId?: boolean) {
  const res = await fetch(`${API_BASE}${personId ? interpolatePersonId(path) : path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return handleResponse(res)
}
