import { jest } from '@jest/globals'
import { authHeaders, clearAccessToken, getAccessToken, setAccessToken, setCaregiverId } from './authSession'
import { resolveApiPath } from './apiPath'

describe('authenticated API client', () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
  })

  it('adds a bearer token only while the current tab has a session', () => {
    expect(authHeaders({ Accept: 'application/json' })).toEqual({ Accept: 'application/json' })
    setAccessToken('session-token-for-test')
    expect(getAccessToken()).toBe('session-token-for-test')
    expect(authHeaders({ Accept: 'application/json' })).toEqual({
      Accept: 'application/json',
      Authorization: 'Bearer session-token-for-test',
    })
    clearAccessToken()
    expect(getAccessToken()).toBeNull()
  })

  it('notifies the auth guard after caregiver identity is stored', () => {
    const changed = jest.fn()
    window.addEventListener('personIdChanged', changed)
    setCaregiverId('caregiver-test-id')
    window.removeEventListener('personIdChanged', changed)
    expect(changed).toHaveBeenCalledTimes(1)
  })
  it('rejects placeholder care-record identifiers instead of substituting a fake identity', () => {
    expect(() => resolveApiPath('/events/demo-person-id', '/api/v1')).toThrow(
      'A demo care-record identifier was detected',
    )
  })

  it('preserves explicit API routes and prefixes versioned routes consistently', () => {
    expect(resolveApiPath('/events/person-123', '/api/v1')).toBe('/api/v1/events/person-123')
    expect(resolveApiPath('/api/situation', '/api/v1')).toBe('/api/situation')
  })

})
