import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import CaregiverInvitationPanel from './CaregiverInvitationPanel';
import { getJSON } from '../api/client';

jest.mock('../api/client', () => ({ getJSON: jest.fn() }));
const mockedGetJSON = jest.mocked(getJSON);

describe('CaregiverInvitationPanel', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
    global.fetch = originalFetch;
  });

  it('creates a single-use invitation with the account token and displays backend expiry', async () => {
    mockedGetJSON.mockResolvedValue([{ id: 'caregiver-2', name: 'Second caregiver', relationship: 'Sibling' }]);
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ access_token: 'account-session-token', account: { display_name: 'Care record owner' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ invitation_token: 'single-use-secret-token-1234567890', expires_at: '2026-10-31T10:00:00Z' }),
      });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<CaregiverInvitationPanel personId="person-authorized-1" />);
    fireEvent.change(screen.getByLabelText('Account email'), { target: { value: 'owner@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'long-password-value' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in for caregiver access' }));
    await screen.findByText(/Account session: Care record owner/);

    fireEvent.change(screen.getByLabelText('Existing caregiver identity'), { target: { value: 'caregiver-2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create single-use invitation' }));

    expect(await screen.findByLabelText('Invitation token')).toHaveValue('single-use-secret-token-1234567890');
    expect(screen.getByText(/does not send an email/i)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/v1/auth/caregiver-invitations', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer account-session-token' }),
      body: JSON.stringify({ person_id: 'person-authorized-1', caregiver_id: 'caregiver-2', permissions: ['read', 'write'] }),
    }));
  });

  it('surfaces server-side owner/admin denial instead of pretending an invitation was created', async () => {
    mockedGetJSON.mockResolvedValue([{ id: 'caregiver-2', name: 'Second caregiver' }]);
    const fetchMock = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ access_token: 'account-session-token', account: { email: 'member@example.com' } }),
    }).mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ detail: 'Owner or admin permission required.' }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<CaregiverInvitationPanel personId="person-authorized-1" />);
    fireEvent.change(screen.getByLabelText('Account email'), { target: { value: 'member@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'long-password-value' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in for caregiver access' }));
    await screen.findByText(/Account session: member@example.com/);
    fireEvent.change(screen.getByLabelText('Existing caregiver identity'), { target: { value: 'caregiver-2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create single-use invitation' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Owner or admin permission required.');
    expect(screen.queryByLabelText('Invitation token')).not.toBeInTheDocument();
  });
});
