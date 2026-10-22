/** @jest-environment jsdom */

import {
  ensureAnonymousSession,
  getAnonymousAccessToken,
  getCaregiverId,
  getPersonId,
} from './client';

const makeResponse = (payload: unknown) => ({
  ok: true,
  status: 200,
  headers: { get: () => 'application/json' },
  json: async () => payload,
}) as unknown as Response;

const serverSession = (suffix: string) => ({
  session_id: `session-${suffix}`,
  person: { id: `person-${suffix}`, name: 'Unnamed care recipient', date_of_birth: null },
  caregiver: { id: `caregiver-${suffix}`, name: 'Caregiver', relationship: 'Family' },
  access_token: `server-issued-token-${suffix}`,
  token_type: 'Bearer' as const,
  expires_at: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
  expires_in_seconds: 20 * 24 * 60 * 60,
});

describe('anonymous care session contract', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
    jest.resetModules();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('stores the server-created person, caregiver and bearer credential on first use', async () => {
    const created = serverSession('new');
    global.fetch = jest.fn().mockResolvedValue(makeResponse(created));

    const session = await ensureAnonymousSession();

    expect(session.person.id).toBe('person-new');
    expect(getPersonId()).toBe('person-new');
    expect(getCaregiverId()).toBe('caregiver-new');
    expect(getAnonymousAccessToken()).toBe('server-issued-token-new');
    expect(localStorage.getItem('solenos_anonymous_session_expires_at')).toBe(created.expires_at);
    expect(global.fetch).toHaveBeenCalledWith('/api/v1/sessions/anonymous', expect.objectContaining({
      method: 'POST',
    }));
  });

  it('refreshes using the backend nested response shape without writing undefined IDs', async () => {
    localStorage.setItem('solenos_anonymous_access_token', 'old-token');
    localStorage.setItem('solenos_backend_person_id', 'person-old');
    localStorage.setItem('solenos_backend_caregiver_id', 'caregiver-old');
    localStorage.setItem('solenos_anonymous_session_expires_at', new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString());
    const refreshed = serverSession('refreshed');
    global.fetch = jest.fn().mockResolvedValue(makeResponse(refreshed));

    const session = await ensureAnonymousSession();

    expect(session.person.id).toBe('person-refreshed');
    expect(getPersonId()).toBe('person-refreshed');
    expect(getCaregiverId()).toBe('caregiver-refreshed');
    expect(getAnonymousAccessToken()).toBe('server-issued-token-refreshed');
    expect(localStorage.getItem('solenos_backend_person_id')).not.toBe('undefined');
    expect(localStorage.getItem('solenos_backend_caregiver_id')).not.toBe('undefined');
    expect(global.fetch).toHaveBeenCalledWith('/api/v1/sessions/refresh', expect.objectContaining({
      method: 'POST',
      headers: { Authorization: 'Bearer old-token' },
    }));
  });

  it('does not overwrite the existing session if refresh returns an incomplete payload', async () => {
    localStorage.setItem('solenos_anonymous_access_token', 'old-token');
    localStorage.setItem('solenos_backend_person_id', 'person-old');
    localStorage.setItem('solenos_backend_caregiver_id', 'caregiver-old');
    localStorage.setItem('solenos_anonymous_session_expires_at', new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString());
    global.fetch = jest.fn().mockResolvedValue(makeResponse({
      session_id: 'bad-response',
      person_id: 'wrong-shape',
      caregiver_id: 'wrong-shape',
      access_token: 'replacement-token',
      token_type: 'Bearer',
      expires_at: new Date(Date.now() + 1000).toISOString(),
      expires_in_seconds: 1,
    }));

    await expect(ensureAnonymousSession()).rejects.toThrow('incomplete anonymous-session refresh');
    expect(localStorage.getItem('solenos_anonymous_access_token')).toBe('old-token');
    expect(localStorage.getItem('solenos_backend_person_id')).toBe('person-old');
    expect(localStorage.getItem('solenos_backend_caregiver_id')).toBe('caregiver-old');
  });
});
