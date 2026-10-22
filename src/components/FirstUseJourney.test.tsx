import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import FirstUseJourney from './FirstUseJourney';
import { getJSON, getPersonId } from '../api/client';

jest.mock('../api/client', () => ({
  getJSON: jest.fn(),
  getPersonId: jest.fn(),
}));

const mockedGetJSON = getJSON as jest.MockedFunction<typeof getJSON>;
const mockedGetPersonId = getPersonId as jest.MockedFunction<typeof getPersonId>;

function renderJourney() {
  return render(
    <MemoryRouter>
      <FirstUseJourney />
    </MemoryRouter>,
  );
}

describe('FirstUseJourney', () => {
  beforeEach(() => {
    mockedGetPersonId.mockReturnValue('person-real-1');
    mockedGetJSON.mockReset();
  });

  it('discovers the principal product areas and accurately describes a verified empty record', async () => {
    mockedGetJSON.mockResolvedValue([]);
    renderJourney();

    expect(screen.getByRole('heading', { name: /keep the care story connected/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /start daily capture/i })).toHaveAttribute('href', '/daily-care');
    expect(screen.getByRole('link', { name: /open companion/i })).toHaveAttribute('href', '/companion');
    expect(screen.getByRole('link', { name: /review or add documents/i })).toHaveAttribute('href', '/record');
    expect(screen.getByRole('link', { name: /community/i })).toHaveAttribute('href', '/community');

    await waitFor(() => {
      expect(screen.getByText(/checked care events, evidence, and action sources contain no saved entries yet/i)).toBeInTheDocument();
    });
  });

  it('does not call a record empty when record requests fail', async () => {
    mockedGetJSON.mockRejectedValue(new Error('backend unavailable'));
    renderJourney();

    await waitFor(() => {
      expect(screen.getByText(/current record state could not be confirmed/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/contain no saved entries yet/i)).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/could not verify/i);
  });

  it('shows persisted event, evidence and action details for an existing caregiver', async () => {
    mockedGetJSON
      .mockResolvedValueOnce([{ id: 'event-1', title: 'Poor sleep reported', occurred_at: '2026-10-21T21:00:00Z' }])
      .mockResolvedValueOnce([{ id: 'evidence-1', type: 'provider_note', title: 'Clinic note', created_at: '2026-10-20T10:00:00Z' }])
      .mockResolvedValueOnce([{ id: 'action-1', normalized_action: 'Ask the clinic about sleep changes', status: 'active', deadline: '2026-10-24T12:00:00Z' }]);

    renderJourney();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /continue from your care history/i })).toBeInTheDocument();
    });
    expect(screen.getAllByText('Poor sleep reported').length).toBeGreaterThan(0);
    expect(screen.getByText('Clinic note')).toBeInTheDocument();
    expect(screen.getByText('Ask the clinic about sleep changes')).toBeInTheDocument();
    expect(screen.getByText(/latest event returned/i)).toBeInTheDocument();
    expect(screen.getByText(/does not yet establish which entries changed since your last review/i)).toBeInTheDocument();
  });

  it('shows retrieved records while explicitly identifying a failed section', async () => {
    mockedGetJSON
      .mockResolvedValueOnce([{ id: 'event-1', title: 'Appetite reported lower' }])
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error('actions endpoint unavailable'));

    renderJourney();

    await waitFor(() => {
      expect(screen.getAllByText('Appetite reported lower').length).toBeGreaterThan(0);
    });
    expect(screen.getByRole('alert')).toHaveTextContent(/recorded actions/i);
    expect(screen.queryByText(/contain no saved entries yet/i)).not.toBeInTheDocument();
  });

  it('surfaces persisted changes, questions, conflicts, and information gaps without resolving them', async () => {
    mockedGetJSON
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        id: 'change-1',
        change_type: 'sleep_duration',
        change_direction: 'increased',
        previous_state: 'about 6 hours',
        current_state: 'about 3 hours',
        explanation: 'Caregiver observations report shorter sleep.',
        evidence_ids: ['evidence-1'],
        is_active: true,
      }])
      .mockResolvedValueOnce([{
        id: 'question-1',
        question: 'Has the sleep change happened for several nights?',
        priority: 'important',
        status: 'open',
        asked_at: '2026-10-21T12:00:00Z',
      }])
      .mockResolvedValueOnce([{
        id: 'conflict-1',
        field: 'eating',
        description: 'One caregiver reported low intake; another reported a normal meal.',
        resolution_status: 'unresolved',
        evidence_ids: ['evidence-2', 'evidence-3'],
      }])
      .mockResolvedValueOnce([{
        id: 'gap-1',
        field: 'hydration',
        description: 'Fluid intake has not been recorded for the recent period.',
        priority: 'important',
        lifecycle_status: 'open',
      }]);

    renderJourney();

    await waitFor(() => {
      expect(screen.getByText(/persisted change assessments/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/has the sleep change happened for several nights/i)).toBeInTheDocument();
    expect(screen.getByText(/one caregiver reported low intake/i)).toBeInTheDocument();
    expect(screen.getByText(/fluid intake has not been recorded/i)).toBeInTheDocument();
    expect(screen.getByText(/does not choose which account is true/i)).toBeInTheDocument();
  });

  it('does not assert emptiness when no care-record identity is available', async () => {
    mockedGetPersonId.mockReturnValue('');
    renderJourney();

    expect(screen.getByText(/current record state could not be confirmed/i)).toBeInTheDocument();
    expect(mockedGetJSON).not.toHaveBeenCalled();
  });
});
