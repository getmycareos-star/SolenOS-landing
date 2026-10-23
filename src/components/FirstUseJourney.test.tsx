import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import FirstUseJourney from './FirstUseJourney';
import { ensureAnonymousSession, getJSON, getPersonId } from '../api/client';

// Regression coverage for persisted returning-caregiver context and failure honesty.

jest.mock('../api/client', () => ({
  ensureAnonymousSession: jest.fn(),
  getJSON: jest.fn(),
  getPersonId: jest.fn(),
}));

const mockedEnsureAnonymousSession = ensureAnonymousSession as jest.MockedFunction<typeof ensureAnonymousSession>;
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
    mockedEnsureAnonymousSession.mockReset();
    mockedEnsureAnonymousSession.mockResolvedValue({
      person: { id: 'person-real-1', name: 'Care recipient', date_of_birth: null },
      caregiver: { id: 'caregiver-real-1', name: 'Caregiver', relationship: 'Family' },
      access_token: 'test-token', token_type: 'Bearer', expires_at: '2099-01-01T00:00:00Z', expires_in_seconds: 1,
    });
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
      .mockResolvedValueOnce([{ id: 'event-1', title: 'Poor sleep reported', occurred_at: '2026-10-21T21:00:00Z', recorded_at: '2026-10-23T10:00:00Z' }])
      .mockResolvedValueOnce([{ id: 'evidence-1', type: 'provider_note', title: 'Clinic note', created_at: '2026-10-20T10:00:00Z' }])
      .mockResolvedValueOnce([
        { id: 'action-1', normalized_action: 'Ask the clinic about sleep changes', status: 'active', deadline: '2026-10-24T12:00:00Z' },
        { id: 'action-2', normalized_action: 'Confirm the missed follow-up', status: 'pending_confirmation', deadline: '2020-01-01T00:00:00Z' },
      ]);

    renderJourney();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /continue from your care history/i })).toBeInTheDocument();
    });
    expect(screen.getAllByText('Poor sleep reported').length).toBeGreaterThan(0);
    expect(screen.getByText('Clinic note')).toBeInTheDocument();
    expect(screen.getByText('Ask the clinic about sleep changes')).toBeInTheDocument();
    expect(screen.getAllByText('Confirm the missed follow-up').length).toBeGreaterThan(0);
    expect(screen.getByText(/overdue open actions/i)).toBeInTheDocument();
    expect(screen.getByText(/status: pending_confirmation/i)).toBeInTheDocument();
    expect(screen.getByText(/latest event returned/i)).toBeInTheDocument();
    expect(screen.getAllByText(/event time:/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/entered into SolenOS:/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/does not yet establish which entries changed since your last review/i)).toBeInTheDocument();
  });

  it('orders events by occurrence time rather than when an old report was entered', async () => {
    mockedGetJSON
      .mockResolvedValueOnce([
        { id: 'old-event', title: 'Old report entered today', occurred_at: '2024-02-01T10:00:00Z', recorded_at: '2026-10-23T10:00:00Z' },
        { id: 'newer-event', title: 'Newer by event time', occurred_at: '2025-08-01T10:00:00Z', recorded_at: '2025-08-01T11:00:00Z' },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        id: 'change-1',
        change_type: 'sleep duration',
        explanation: 'Recorded assessment of sleep reports.',
        is_active: true,
        created_at: '2026-10-23T10:00:00Z',
        comparison_window_start: '2025-07-01T00:00:00Z',
        comparison_window_end: '2025-08-01T00:00:00Z',
        evidence_ids: ['evidence-old'],
      }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    renderJourney();

    await waitFor(() => expect(screen.getByText(/latest event returned/i)).toBeInTheDocument());
    const latestSummary = screen.getByText(/latest event returned/i).closest('p');
    expect(latestSummary).toHaveTextContent('Newer by event time');
    expect(latestSummary).not.toHaveTextContent('Old report entered today');
    expect(screen.getByText(/assessment save time is not the event time/i)).toBeInTheDocument();
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
    expect(screen.getAllByRole('alert').some((alert) => /recorded actions/i.test(alert.textContent || ''))).toBe(true);
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
      }, {
        id: 'gap-2',
        field: 'follow-up result',
        description: 'The requested follow-up result is still unresolved.',
        priority: 'high',
        lifecycle_status: 'reopened',
        expected_by: '2020-01-01T00:00:00Z',
      }]);

    renderJourney();

    await waitFor(() => {
      expect(screen.getByText(/persisted change assessments/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/has the sleep change happened for several nights/i)).toBeInTheDocument();
    expect(screen.getByText(/one caregiver reported low intake/i)).toBeInTheDocument();
    expect(screen.getAllByText(/fluid intake has not been recorded/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/follow-up result/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/overdue follow-up/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/does not choose which account is true/i)).toBeInTheDocument();
  });

  it('does not assert emptiness when no care-record identity is available', async () => {
    mockedGetPersonId.mockReturnValue('');
    mockedEnsureAnonymousSession.mockRejectedValue(new Error('No authorised session available'));
    renderJourney();

    await waitFor(() => expect(screen.getByText(/current record state could not be confirmed/i)).toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent(/authorised care-record session/i);
    expect(mockedGetJSON).not.toHaveBeenCalled();
  });
});
