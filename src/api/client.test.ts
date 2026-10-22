import { jest } from '@jest/globals'
import { authHeaders, clearAccessToken, getAccessToken, setAccessToken, setCaregiverId } from './authSession'
import { getJSON } from './client'

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
  it('rejects demo care-record identifiers before making a network request', async () => {
    const originalFetch = global.fetch
    const fetchMock = jest.fn()
    global.fetch = fetchMock as unknown as typeof fetch
    try {
      await expect(getJSON('/events/demo-person-id')).rejects.toThrow(
        'A demo care-record identifier was detected',
      )
      expect(fetchMock).not.toHaveBeenCalled()
    } finally {
      global.fetch = originalFetch
    }
  })

})
