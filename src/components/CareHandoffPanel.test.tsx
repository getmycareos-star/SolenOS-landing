import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import CareHandoffPanel from './CareHandoffPanel';
import { getJSON, getCaregiverId, postJSON } from '../api/client';

jest.mock('../api/client', () => ({
  getJSON: jest.fn(),
  postJSON: jest.fn(),
  getCaregiverId: jest.fn(),
}));

const mockedGetJSON = jest.mocked(getJSON);
const mockedGetCaregiverId = jest.mocked(getCaregiverId);
const mockedPostJSON = jest.mocked(postJSON);

const handoff = {
  id: 'handoff-1',
  person_id: 'person-real-1',
  created_by_caregiver_id: 'caregiver-real-1',
  assigned_to_caregiver_id: 'caregiver-next',
  title: 'Evening handoff',
  summary: 'Review follow-up tomorrow.',
  outstanding_items: ['Confirm appointment'],
  recent_changes: ['Appointment was rescheduled'],
  safety_concerns: ['Monitor reported symptoms'],
  status: 'open',
  acknowledged_by_caregiver_id: null,
  acknowledged_at: null,
  closed_by_caregiver_id: null,
  closed_at: null,
  created_at: '2026-10-23T10:00:00Z',
};

describe('CareHandoffPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetCaregiverId.mockReturnValue('caregiver-real-1');
    mockedGetJSON.mockImplementation(async (path: string) => {
      if (path.startsWith('/care-handoffs/people/')) return [handoff];
      if (path === '/caregivers/person-real-1') return [
        { id: 'caregiver-real-1', name: 'Creator' },
        { id: 'caregiver-next', name: 'Next caregiver' },
      ];
      if (path === '/care-handoffs/handoff-1/events') return [
        { id: 'event-1', event_type: 'created', actor_caregiver_id: 'caregiver-real-1', created_at: '2026-10-23T10:00:00Z' },
      ];
      throw new Error(`Unexpected endpoint: ${path}`);
    });
  });

  afterEach(() => cleanup());

  it('shows the handoff summary, ownership, outstanding work and audit history', async () => {
    render(<CareHandoffPanel personId="person-real-1" />);
    expect(await screen.findByRole('heading', { name: 'Evening handoff' })).toBeInTheDocument();
    expect(screen.getByText('Review follow-up tomorrow.')).toBeInTheDocument();
    expect(screen.getByText('Confirm appointment')).toBeInTheDocument();
    expect(screen.getByText(/Assigned to: Next caregiver/)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Audit history/));
    expect(screen.getByText(/created · Creator/)).toBeInTheDocument();
  });

  it('creates a handoff with explicit unresolved items and refreshes persisted data', async () => {
    mockedPostJSON.mockResolvedValueOnce({ ...handoff, title: 'Morning handoff' } as never);
    render(<CareHandoffPanel personId="person-real-1" />);

    fireEvent.change(await screen.findByLabelText(/Handoff title/), { target: { value: 'Morning handoff' } });
    fireEvent.change(screen.getByLabelText(/Summary for the next caregiver/), { target: { value: 'Review the follow-up.' } });
    fireEvent.change(screen.getByLabelText(/Outstanding items/), { target: { value: 'Call clinic\nBring the report' } });
    fireEvent.change(screen.getByLabelText(/Recent changes/), { target: { value: 'Appointment moved' } });
    fireEvent.change(screen.getByLabelText(/Safety concerns or follow-up cautions/), { target: { value: 'New concern needs review' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save handoff' }));

    await waitFor(() => {
      expect(mockedPostJSON).toHaveBeenCalledWith('/care-handoffs', {
        person_id: 'person-real-1',
        assigned_to_caregiver_id: null,
        title: 'Morning handoff',
        summary: 'Review the follow-up.',
        outstanding_items: ['Call clinic', 'Bring the report'],
        recent_changes: ['Appointment moved'],
        safety_concerns: ['New concern needs review'],
      });
    });
    expect(await screen.findByRole('status')).toHaveTextContent(/Handoff saved/);
    await waitFor(() => expect(mockedGetJSON.mock.calls.filter(([path]) => String(path).startsWith('/care-handoffs/people/')).length).toBeGreaterThan(1));
  });

  it('does not fabricate handoffs when the service fails', async () => {
    mockedGetJSON.mockRejectedValue(new Error('service unavailable'));
    render(<CareHandoffPanel personId="person-real-1" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('service unavailable');
    expect(screen.queryByText('Evening handoff')).not.toBeInTheDocument();
  });
});
