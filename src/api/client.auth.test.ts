import { loginAccount, postJSON, setPersonId } from './client'

function jsonResponse(payload: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    text: async () => JSON.stringify(payload),
    json: async () => payload,
  } as Response
}

describe('server-issued account sessions', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
    global.fetch = jest.fn()
  })

  afterEach(() => {
    global.fetch = originalFetch
    jest.restoreAllMocks()
  })

  it('adds a bearer token to protected API requests after sign-in', async () => {
    sessionStorage.setItem('solenos_access_token', 'server-issued-token')
    ;(global.fetch as jest.Mock).mockResolvedValue(jsonResponse({ ok: true }))

    await postJSON('/daily/log', { person_id: 'person-real', note: 'caregiver report' })

    expect(global.fetch).toHaveBeenCalledWith('/api/v1/daily/log', expect.objectContaining({
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer server-issued-token',
      },
    }))
  })

  it('does not invent a person identity when clearing the selected record', () => {
    localStorage.setItem('solenos_person_id', 'person-real')
    setPersonId('')
    expect(localStorage.getItem('solenos_person_id')).toBeNull()
  })

  it('verifies the server session after login and loads authorized care contexts', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(jsonResponse({ access_token: 'server-issued-token', token_type: 'bearer' }))
      .mockResolvedValueOnce(jsonResponse({ account: { id: 'account-1', email: 'caregiver@example.com' } }))
      .mockResolvedValueOnce(jsonResponse([{ person_id: 'person-1', role: 'owner' }]))

    const account = await loginAccount('Caregiver@Example.com', 'a-long-password-2026')

    expect(account).toEqual({ id: 'account-1', email: 'caregiver@example.com' })
    expect(sessionStorage.getItem('solenos_access_token')).toBe('server-issued-token')
    expect(global.fetch).toHaveBeenNthCalledWith(2, '/api/v1/auth/me', expect.objectContaining({
      headers: { Authorization: 'Bearer server-issued-token' },
    }))
    expect(global.fetch).toHaveBeenNthCalledWith(3, '/api/v1/auth/care-contexts', expect.objectContaining({
      headers: { Authorization: 'Bearer server-issued-token' },
    }))
  })
})
