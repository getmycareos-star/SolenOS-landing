import { jest } from '@jest/globals'
import { authHeaders, clearAccessToken, getAccessToken, setAccessToken, setCaregiverId } from './authSession'

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
})
