export const ACCESS_TOKEN_STORAGE_KEY = 'solenos_access_token'

export function getAccessToken(): string | null {
  return typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)
}

export function setAccessToken(token: string): void {
  sessionStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token)
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('solenos:auth-changed'))
}

export function clearAccessToken(): void {
  if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('solenos:auth-changed'))
    window.dispatchEvent(new Event('solenos:auth-expired'))
  }
}

export function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = getAccessToken()
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra
}

export function getPersonId(): string {
  return typeof localStorage === 'undefined' ? '' : (localStorage.getItem('solenos_person_id') || '')
}

export function setPersonId(id: string): void {
  localStorage.setItem('solenos_person_id', id)
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('personIdChanged'))
}

export function getCaregiverId(): string | null {
  return typeof localStorage === 'undefined' ? null : localStorage.getItem('solenos_caregiver_id')
}

export function setCaregiverId(id: string): void {
  localStorage.setItem('solenos_caregiver_id', id)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('personIdChanged'))
    window.dispatchEvent(new Event('solenos:auth-changed'))
  }
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
