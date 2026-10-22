export const ACCESS_TOKEN_STORAGE_KEY = 'solenos_access_token'
export const ACCESS_TOKEN_EXPIRES_AT_KEY = 'solenos_access_token_expires_at'

export function isPlaceholderIdentifier(value: string | null | undefined): boolean {
  if (!value?.trim()) return true
  return /^(?:demo|sample|test|fake|placeholder)(?:[-_:]|$)|^(?:current-user-id|team-moderator)$/i.test(value.trim())
}

export function getAccessToken(): string | null {
  return typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)
}

export function setAccessToken(token: string, expiresAt?: string): void {
  const normalized = token.trim()
  if (!normalized) {
    clearAccessToken()
    return
  }
  sessionStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, normalized)
  if (expiresAt?.trim()) sessionStorage.setItem(ACCESS_TOKEN_EXPIRES_AT_KEY, expiresAt.trim())
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('solenos:auth-changed'))
}

export function clearAccessToken(): void {
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY)
    sessionStorage.removeItem(ACCESS_TOKEN_EXPIRES_AT_KEY)
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('solenos:auth-changed'))
    window.dispatchEvent(new Event('solenos:auth-expired'))
  }
}

export function getAccessTokenExpiresAt(): string | null {
  return typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(ACCESS_TOKEN_EXPIRES_AT_KEY)
}

export function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = getAccessToken()
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra
}

export function getPersonId(): string {
  const id = typeof localStorage === 'undefined' ? '' : (localStorage.getItem('solenos_person_id') || '').trim()
  return isPlaceholderIdentifier(id) ? '' : id
}

export function setPersonId(id: string): void {
  const normalized = id.trim()
  if (isPlaceholderIdentifier(normalized)) localStorage.removeItem('solenos_person_id')
  else localStorage.setItem('solenos_person_id', normalized)
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('personIdChanged'))
}

export function getCaregiverId(): string | null {
  const id = typeof localStorage === 'undefined' ? '' : (localStorage.getItem('solenos_caregiver_id') || '').trim()
  return isPlaceholderIdentifier(id) ? null : id
}

export function setCaregiverId(id: string): void {
  const normalized = id.trim()
  if (isPlaceholderIdentifier(normalized)) localStorage.removeItem('solenos_caregiver_id')
  else localStorage.setItem('solenos_caregiver_id', normalized)
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
