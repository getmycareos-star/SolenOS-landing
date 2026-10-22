import {
  authHeaders,
  clearAccessToken,
  getAccessToken,
  getCaregiverId,
  getPersonId,
  setAccessToken,
  setCaregiverId,
  setPersonId,
} from './authSession'
import { resolveApiPath } from './apiPath'

describe('server-backed API session helpers', () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
  })

  it('adds a bearer token only while the current tab has a session', () => {
    expect(authHeaders({ Accept: 'application/json' })).toEqual({ Accept: 'application/json' })
    setAccessToken('session-token-for-test', '2026-10-23T00:00:00Z')
    expect(getAccessToken()).toBe('session-token-for-test')
    expect(authHeaders({ Accept: 'application/json' })).toEqual({
      Accept: 'application/json',
      Authorization: 'Bearer session-token-for-test',
    })
    clearAccessToken()
    expect(getAccessToken()).toBeNull()
  })

  it('does not persist placeholder care-recipient or caregiver identities', () => {
    setPersonId('demo-person-123')
    setCaregiverId('demo-caregiver-456')
    expect(getPersonId()).toBe('')
    expect(getCaregiverId()).toBeNull()
    expect(localStorage.getItem('solenos_person_id')).toBeNull()
    expect(localStorage.getItem('solenos_caregiver_id')).toBeNull()
  })

  it('rejects placeholder IDs in request paths', () => {
    expect(() => resolveApiPath('/events/demo-person-id', '/api/v1')).toThrow(
      'A demo care-record identifier was detected',
    )
    expect(() => resolveApiPath('/events/test-person-123', '/api/v1')).toThrow(
      'A demo care-record identifier was detected',
    )
  })

  it('preserves unversioned API routes and prefixes versioned routes', () => {
    expect(resolveApiPath('/events/person-123', '/api/v1')).toBe('/api/v1/events/person-123')
    expect(resolveApiPath('/api/situation', '/api/v1')).toBe('/api/situation')
  })
})
