import { authHeaders, clearAccessToken, getAccessToken, setAccessToken } from './client'

describe('authenticated API client headers', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('adds the bearer token only when a session token exists', () => {
    expect(authHeaders({ Accept: 'application/json' })).toEqual({ Accept: 'application/json' })
    setAccessToken('session-token-for-test')
    expect(authHeaders({ Accept: 'application/json' })).toEqual({
      Accept: 'application/json',
      Authorization: 'Bearer session-token-for-test',
    })
  })

  it('can clear a session token after logout or a 401 response', () => {
    setAccessToken('session-token-for-test')
    expect(getAccessToken()).toBe('session-token-for-test')
    clearAccessToken()
    expect(getAccessToken()).toBeNull()
  })
})
