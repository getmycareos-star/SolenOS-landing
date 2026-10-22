import { authHeaders, clearAccessToken, getAccessToken, getPersonId, setAccessToken } from './client'

describe('authenticated API client headers', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
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

describe('care record identity selection', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('does not silently select a shared demo person when no care record is selected', () => {
    expect(getPersonId()).toBe('')
  })
})
