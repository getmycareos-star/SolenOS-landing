import { jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CareCapture from '../../components/CareCapture';

function jsonResponse(payload: unknown) {
  return {
    ok: true,
    status: 200,
    headers: { get: (name: string) => name.toLowerCase() === 'content-type' ? 'application/json' : null },
    text: async () => JSON.stringify(payload),
  };
}

function installFetchMock(caregivers: Array<{ id: string; name: string }>) {
  const fetchMock = jest.fn(async (url: unknown, _options?: RequestInit) => {
    const path = String(url);
    let body: unknown = [];
    if (path.includes('/caregivers/')) {
      body = caregivers;
    } else if (path.includes('/situation')) {
      body = { ok: true, evidence_id: 'evidence-1', care_event_id: 'event-1' };
    } else if (path.includes('/community/experience')) {
      body = { trigger_observation: '', matched_keywords: [], matches: [], community_pattern: null };
    }

    return {
      ok: true,
      headers: { get: (name: string) => name.toLowerCase() === 'content-type' ? 'application/json' : null },
      text: async () => JSON.stringify(body),
      json: async () => body,
    };
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe('CareCapture caregiver workflow', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    jest.clearAllMocks();
  });

  it('resolves the linked caregiver and submits a care observation', async () => {
    const fetchMock = installFetchMock([{ id: 'caregiver-1', name: 'Test Caregiver' }]);
    const onCapture = jest.fn();
    render(<CareCapture personId="test-person-id" onCapture={onCapture} />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/caregivers/test-person-id',
        undefined,
      );
    });

    fireEvent.change(screen.getByPlaceholderText(/Dad wandered at 2 AM/i), {
      target: { value: 'Dad felt dizzy this morning' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save what changed/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/situation',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"caregiver_id":"caregiver-1"'),
        }),
      );
    });
    expect(onCapture).toHaveBeenCalledWith('Dad felt dizzy this morning');
  });

  it('disables saving when no caregiver is linked to the person', async () => {
    installFetchMock([]);
    render(<CareCapture personId="test-person-id" />);

    await waitFor(() => {
      expect(screen.getByText(/no caregiver is linked/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /save what changed/i })).toBeDisabled();
  });
});
