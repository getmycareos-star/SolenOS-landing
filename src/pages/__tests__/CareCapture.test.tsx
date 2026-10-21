import { jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CareCapture from '../../components/CareCapture';

function installFetchMock(caregivers: Array<{ id: string; name: string }>) {
  const fetchMock = jest.fn(async (url: unknown, options?: RequestInit) => {
    const path = String(url);
    if (path.includes('/caregivers/person/')) {
      return { ok: true, json: async () => caregivers };
    }
    if (path.includes('/situation')) {
      return { ok: true, json: async () => ({ ok: true, evidence_id: 'evidence-1', care_event_id: 'event-1' }) };
    }
    if (path.includes('/community/experience')) {
      return { ok: true, json: async () => ({ matched: false }) };
    }
    return { ok: true, json: async () => [] };
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe('CareCapture caregiver workflow', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  it('resolves the linked caregiver and submits a care observation', async () => {
    const fetchMock = installFetchMock([{ id: 'caregiver-1', name: 'Test Caregiver' }]);
    const onCapture = jest.fn();
    render(<CareCapture pid="test-person-id" onCapture={onCapture} />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/caregivers/person/test-person-id'),
        expect.anything(),
      );
    });

    fireEvent.change(screen.getByPlaceholderText(/Dad wandered at 2 AM/i), {
      target: { value: 'Dad felt dizzy this morning' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save what changed/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/situation'),
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
    render(<CareCapture pid="test-person-id" />);

    await waitFor(() => {
      expect(screen.getByText(/no caregiver is linked/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /save what changed/i })).toBeDisabled();
  });
});
