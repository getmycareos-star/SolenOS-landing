import { loginWithPassword, registerCaregiverAccount, clearAuthSession } from './client'

const backendAccount = {
  id: 'account-test-1',
  email: 'caregiver@example.test',
  display_name: 'Test Caregiver',
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('SolenOS authentication API contract', () => {
  const fetchMock = jest.fn()

  beforeEach(() => {
    localStorage.clear()
    fetchMock.mockReset()
    global.fetch = fetchMock as unknown as typeof fetch
  })

  afterEach(() => {
    clearAuthSession()
    localStorage.clear()
  })

  it('signs in using the backend login and care-context endpoints', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({
        access_token: 'test-access-token',
        token_type: 'bearer',
        expires_at: '2026-10-23T00:00:00+00:00',
        account: backendAccount,
      }))
      .mockResolvedValueOnce(jsonResponse([{
        person_id: 'person-test-1',
        name: 'Test Care Record',
        role: 'caregiver',
        permissions: ['read', 'write'],
      }]))
      .mockResolvedValueOnce(jsonResponse([{
        person_id: 'person-test-1',
        caregiver_id: 'caregiver-test-1',
        account_id: 'account-test-1',
        permissions: ['read', 'write'],
      }]))

    const account = await loginWithPassword('caregiver@example.test', 'correct-horse-battery-staple')

    expect(account).toEqual({
      id: 'account-test-1',
      email: 'caregiver@example.test',
      role: 'caregiver',
      caregiver_id: 'caregiver-test-1',
      person_id: 'person-test-1',
    })
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/v1/auth/login',
      '/api/v1/auth/care-contexts',
      '/api/v1/auth/my-caregiver-links?person_id=person-test-1',
    ])
    expect(localStorage.getItem('solenos_access_token')).toBe('test-access-token')
    expect(localStorage.getItem('solenos_person_id')).toBe('person-test-1')
    expect(localStorage.getItem('solenos_caregiver_id')).toBe('caregiver-test-1')
  })

  it('registers through the actual signup route and creates the care context', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ account: backendAccount }, 201))
      .mockResolvedValueOnce(jsonResponse({
        access_token: 'registered-access-token',
        token_type: 'bearer',
        expires_at: '2026-10-23T00:00:00+00:00',
        account: backendAccount,
      }))
      .mockResolvedValueOnce(jsonResponse({
        person_id: 'person-created-1',
        name: 'Mother Abuchi',
        role: 'caregiver',
        permissions: ['read', 'write'],
      }, 201))
      .mockResolvedValueOnce(jsonResponse([{
        person_id: 'person-created-1',
        name: 'Mother Abuchi',
        role: 'caregiver',
        permissions: ['read', 'write'],
      }]))
      .mockResolvedValueOnce(jsonResponse([{
        person_id: 'person-created-1',
        caregiver_id: 'caregiver-created-1',
        account_id: 'account-test-1',
        permissions: ['read', 'write'],
      }]))

    const account = await registerCaregiverAccount({
      email: 'caregiver@example.test',
      password: 'correct-horse-battery-staple',
      name: 'Test Caregiver',
      person_name: 'Mother Abuchi',
      relationship: 'Daughter',
    })

    expect(account.person_id).toBe('person-created-1')
    expect(account.caregiver_id).toBe('caregiver-created-1')
    expect(fetchMock.mock.calls.map(([url, init]) => [url, (init as RequestInit | undefined)?.method || 'GET'])).toEqual([
      ['/api/v1/auth/signup', 'POST'],
      ['/api/v1/auth/login', 'POST'],
      ['/api/v1/auth/care-contexts', 'POST'],
      ['/api/v1/auth/care-contexts', 'GET'],
      ['/api/v1/auth/my-caregiver-links?person_id=person-created-1', 'GET'],
    ])
    expect(JSON.parse((fetchMock.mock.calls[2][1] as RequestInit).body as string)).toEqual({
      name: 'Mother Abuchi',
      caregiver_name: 'Test Caregiver',
      relationship: 'Daughter',
    })
  })

  it('does not silently choose between multiple care records', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({
        access_token: 'multi-access-token',
        token_type: 'bearer',
        expires_at: '2026-10-23T00:00:00+00:00',
        account: backendAccount,
      }))
      .mockResolvedValueOnce(jsonResponse([
        { person_id: 'person-a', name: 'Record A', role: 'caregiver', permissions: ['read'] },
        { person_id: 'person-b', name: 'Record B', role: 'caregiver', permissions: ['read'] },
      ]))

    await expect(loginWithPassword('caregiver@example.test', 'correct-horse-battery-staple'))
      .rejects.toThrow(/multiple care records/i)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
