import { loginWithPassword, registerCaregiverAccount, clearAuthSession } from './client'

const backendAccount = {
  id: 'account-test-1',
  email: 'caregiver@example.test',
  display_name: 'Test Caregiver',
  role: 'caregiver',
  caregiver_id: 'caregiver-test-1',
  person_id: 'person-test-1',
}

function jsonResponse(payload: unknown, status = 200): Response {
  const raw = JSON.stringify(payload)
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => name.toLowerCase() === 'content-type' ? 'application/json' : null },
    text: async () => raw,
    body: { cancel: jest.fn() },
  } as unknown as Response
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

  it('registers through the protected backend enrollment route', async () => {
    const registeredAccount = {
      ...backendAccount,
      id: 'account-created-1',
      email: 'new-caregiver@example.test',
      caregiver_id: 'caregiver-created-1',
      person_id: 'person-created-1',
    }
    fetchMock
      .mockResolvedValueOnce(jsonResponse({
        access_token: 'registered-access-token',
        token_type: 'bearer',
        expires_in: 3600,
        account: registeredAccount,
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
        account_id: 'account-created-1',
        permissions: ['read', 'write'],
      }]))

    const account = await registerCaregiverAccount({
      email: 'new-caregiver@example.test',
      password: 'correct-horse-battery-staple',
      enrollment_key: 'authorized-enrollment-key',
      name: 'Test Caregiver',
      person_name: 'Mother Abuchi',
      relationship: 'Daughter',
    })

    expect(account.person_id).toBe('person-created-1')
    expect(account.caregiver_id).toBe('caregiver-created-1')
    expect(fetchMock.mock.calls.map(([url, init]) => [url, (init as RequestInit | undefined)?.method || 'GET'])).toEqual([
      ['/api/v1/auth/register', 'POST'],
      ['/api/v1/auth/care-contexts', 'GET'],
      ['/api/v1/auth/my-caregiver-links?person_id=person-created-1', 'GET'],
    ])
    expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)).toEqual({
      email: 'new-caregiver@example.test',
      password: 'correct-horse-battery-staple',
      enrollment_key: 'authorized-enrollment-key',
      name: 'Test Caregiver',
      person_name: 'Mother Abuchi',
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
