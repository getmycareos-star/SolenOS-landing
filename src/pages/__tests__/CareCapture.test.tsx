import { jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CareCapture from '../../components/CareCapture';
import DailyCare from '../DailyCare';

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
    } else if (path.includes('/daily/log')) {
      body = {
        success: true,
        daily_capture_id: 'daily-capture-1',
        care_event_id: 'care-event-1',
        recorded_at: '2026-10-21T10:00:00Z',
      };
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
      expect(fetchMock).toHaveBeenCalledWith('/api/v1/caregivers/test-person-id');
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

describe('DailyCare durable capture contract', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    jest.clearAllMocks();
  });

  it('maps mood and notes to the authenticated daily-capture API contract', async () => {
    localStorage.setItem('solenos_person_id', 'test-person-id');
    const fetchMock = installFetchMock([{ id: 'caregiver-1', name: 'Test Caregiver' }]);
    render(<DailyCare />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/v1/caregivers/test-person-id');
    });
    await screen.findByRole('option', { name: 'Test Caregiver' });

    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'Calm' } });
    fireEvent.change(screen.getByPlaceholderText('Anything else worth noting...'), {
      target: { value: 'Hydration was better today.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save daily care entry/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/daily/log',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    const call = fetchMock.mock.calls.find(([url]) => String(url) === '/api/v1/daily/log');
    expect(call).toBeDefined();
    const request = call?.[1] as RequestInit;
    const payload = JSON.parse(String(request.body));
    expect(payload).toMatchObject({
      person_id: 'test-person-id',
      caregiver_id: 'caregiver-1',
      medications: [],
      notes: 'Hydration was better today.',
      scales: [expect.objectContaining({ axis: 'mood', score: 1, note: 'Calm' })],
    });
    expect(payload.vitals).toEqual([]);
  });
});
