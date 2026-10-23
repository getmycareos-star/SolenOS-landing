import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import { MemoryRouter } from 'react-router-dom'
import Community from '../Community'
import Memory from '../Memory'
import TeamDashboard from '../TeamDashboard'
import CareCapture from '../../components/CareCapture'
import DailyCare from '../DailyCare'
import Dashboard from '../Dashboard'
import { getJSON, getCaregiverId, getPersonId, postJSON } from '../../api/client'

jest.mock('../../lib/permissions/useLocationPermission', () => ({
  useLocationPermission: () => ({ state: { status: 'unsupported' }, requestLocation: jest.fn() }),
}))

jest.mock('../../api/client', () => ({
  getJSON: jest.fn(),
  postJSON: jest.fn(),
  getPersonId: jest.fn(),
  getCaregiverId: jest.fn(),
}))

const mockedGetJSON = jest.mocked(getJSON)
const mockedPostJSON = jest.mocked(postJSON)
const mockedGetPersonId = jest.mocked(getPersonId)
const mockedGetCaregiverId = jest.mocked(getCaregiverId)

describe('Phase 4 production data safety', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedGetPersonId.mockReturnValue('person-real-1')
    mockedGetCaregiverId.mockReturnValue('caregiver-real-1')
  })

  afterEach(() => cleanup())

  it('does not display invented community posts when the API fails', async () => {
    mockedGetJSON.mockRejectedValue(new Error('service unavailable'))

    render(
      <MemoryRouter>
        <Community />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('alert')).toHaveTextContent('Community posts could not be loaded')
    expect(screen.queryByText(/M\. Johnson|sample caregiver|sample post|DEMO_RISK/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/sample posts/i)).not.toBeInTheDocument()
  })

  it('never renders caregiver monitoring, moderation, or metrics from demo defaults', () => {
    render(<TeamDashboard />)

    expect(screen.getByRole('heading', { name: /team dashboard unavailable/i })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(/cannot be verified as an authorized/i)
    expect(screen.queryByText(/M\. Johnson|142 caregivers|4\.2 helpfulness|DEMO_RISK|DEMO_REPORT/i)).not.toBeInTheDocument()
  })

  it('preserves care-capture text when the save request fails', async () => {
    mockedPostJSON.mockRejectedValueOnce(new Error('service unavailable'))

    render(<CareCapture personId="person-real-1" />)

    const note = 'Observed a change in sleep; exact start time is uncertain.'
    const input = screen.getByPlaceholderText(/describe what you observed/i)
    fireEvent.change(input, { target: { value: note } })
    fireEvent.click(screen.getByRole('button', { name: /save what changed/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/save could not be confirmed/i)
    expect(input).toHaveValue(note)
    expect(screen.queryByText('Care update saved.')).not.toBeInTheDocument()
  })

  it('does not mark a 200 response as saved unless the backend confirms capture success', async () => {
    mockedPostJSON.mockResolvedValueOnce({
      ok: false,
      message: 'The capture was not accepted.',
    } as never);

    render(<CareCapture personId="person-real-1" />);

    const note = 'The caregiver noticed a change, but the time is uncertain.';
    const input = screen.getByPlaceholderText(/describe what you observed/i);
    fireEvent.change(input, { target: { value: note } });
    fireEvent.click(screen.getByRole('button', { name: /save what changed/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/capture was not accepted/i);
    expect(input).toHaveValue(note);
    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
  })

  it('reloads dashboard sections after a care capture is confirmed saved', async () => {
    mockedGetJSON.mockImplementation(async (path: string) => {
      if (path.startsWith('/events/')) return [];
      if (path.startsWith('/insights/')) return [];
      if (path.includes('/trends')) return [];
      if (path.includes('/reasoning/')) {
        return {
          confirmed_facts: [],
          open_questions: [],
          preferences: [],
          rejected_assumptions: [],
          care_patterns: [],
          coordination_decisions: [],
        };
      }
      if (path.startsWith('/daily-intelligence/')) {
        return {
          id: 'daily-1',
          intelligence_date: '2026-10-22',
          overdue_items: [],
          upcoming_items: [],
          active_windows: [],
          expired_windows: [],
          daily_summary: '',
        };
      }
      if (path.startsWith('/actions/')) return [];
      throw new Error(`Unexpected dashboard endpoint: ${path}`);
    });
    mockedPostJSON.mockResolvedValueOnce({
      ok: true,
      message: 'Care input recorded successfully.',
      analysis_status: 'complete',
    } as never);

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    const note = 'Breakfast was mostly uneaten; exact start time is uncertain.';
    const input = await screen.findByPlaceholderText(/describe what you observed/i);
    fireEvent.change(input, { target: { value: note } });
    fireEvent.click(screen.getByRole('button', { name: /save what changed/i }));

    expect(await screen.findByText('Care input recorded successfully.')).toBeInTheDocument();
    await waitFor(() => {
      expect(
        mockedGetJSON.mock.calls.filter(([path]) => String(path).startsWith('/events/')).length,
      ).toBe(2);
    });
  })

  it('preserves the original report and persists an explicit correction to a review-only extraction candidate', async () => {
    mockedPostJSON
      .mockResolvedValueOnce({
        ok: true,
        message: 'Care input recorded successfully.',
        events: [{ occurred_at: '2026-10-23T08:15:00Z' }],
        qwen_extraction_status: 'pending_review',
        qwen_analysis_id: 'analysis-1',
        qwen_candidates: {
          observations: [{
            subject: 'sleep',
            observation: 'Mum slept badly.',
            source_quote: 'Mum slept badly',
            time_expression: 'last night',
            certainty: 'reported',
            review_status: 'pending_review',
          }],
          open_questions: ['How many hours did Mum sleep?'],
          possible_safety_flags: [],
        },
      } as never)
      .mockResolvedValueOnce({
        candidate: {
          subject: 'sleep',
          observation: 'Mum slept poorly last night.',
          source_quote: 'Mum slept badly',
          review_status: 'corrected_by_caregiver',
        },
        message: 'Review decision saved with the original candidate preserved. The Living Care Record was not changed.',
      } as never)

    render(<CareCapture personId="person-real-1" />)
    const original = 'Mum slept badly, ate very little this morning, and says her knee hurts.'
    fireEvent.change(screen.getByPlaceholderText(/describe what you observed/i), { target: { value: original } })
    fireEvent.click(screen.getByRole('button', { name: /save what changed/i }))

    expect(await screen.findByRole('region', { name: /original captured report/i })).toHaveTextContent(original)
    expect(screen.getByText(/recorded event time/i)).toBeInTheDocument()
    expect(await screen.findByText(/how many hours did mum sleep/i)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/corrected observation 1/i), {
      target: { value: 'Mum slept poorly last night.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /save correction/i }))

    await waitFor(() => {
      expect(mockedPostJSON).toHaveBeenLastCalledWith('/capture/analyses/analysis-1/review', {
        candidate_index: 0,
        decision: 'correct',
        corrected_subject: 'sleep',
        corrected_observation: 'Mum slept poorly last night.',
      })
    })
    expect(await screen.findByText(/living care record was not changed/i)).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /original captured report/i })).toHaveTextContent(original)
    expect(screen.getByText(/corrected by caregiver/i)).toBeInTheDocument()
  })

  it('does not report a valid empty record when the record API fails', async () => {
    mockedGetJSON.mockRejectedValue(new Error('service unavailable'))

    const Record = (await import('../Record')).default
    render(
      <MemoryRouter>
        <Record />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not be loaded/i)
    expect(screen.queryByText(/no evidence recorded yet/i)).not.toBeInTheDocument()
  })

  it('does not report empty memory when one of its data requests fails', async () => {
    mockedGetJSON.mockRejectedValue(new Error('service unavailable'))

    render(<Memory />)

    expect(await screen.findByRole('alert')).toHaveTextContent(/memory information could not be loaded/i)
    expect(screen.queryByText(/no reasoning memory yet/i)).not.toBeInTheDocument()
  })

  it('does not issue care-record requests when no record is selected', async () => {
    mockedGetPersonId.mockReturnValue('')

    const Record = (await import('../Record')).default
    render(
      <MemoryRouter>
        <Record />
      </MemoryRouter>,
    )

    expect(screen.getByRole('alert')).toHaveTextContent(/no care record is selected/i)
    expect(mockedGetJSON).not.toHaveBeenCalled()
  })

  it('passes persisted source identifiers and the exact event time to Delta reconciliation', async () => {
    mockedGetJSON.mockImplementation(async (path: string) => {
      if (path.startsWith('/caregivers/')) return [{ id: 'caregiver-real-1', name: 'Caregiver' }] as never
      if (path.startsWith('/care-delta/runs/')) return [] as never
      throw new Error(`Unexpected GET endpoint: ${path}`)
    })
    mockedPostJSON.mockImplementation(async (path: string) => {
      if (path === '/situation') return {
        ok: true,
        message: 'Care update saved.',
        care_event_id: 'event-saved-1',
        evidence_id: 'evidence-saved-1',
        events: [{ id: 'event-saved-1', occurred_at: '2026-10-23T08:15:42Z', evidence_ids: ['evidence-saved-1'] }],
        qwen_extraction_status: 'not_configured',
        qwen_analysis_id: 'analysis-saved-1',
        qwen_candidates: null,
      } as never
      if (path === '/care-delta/reconcile') return {
        event_summary: 'Reconciliation result returned.',
        caregiver_summary: 'Reconciliation result returned.',
        provenance: { persisted: true, model_provider: 'test', model: 'test' },
      } as never
      throw new Error(`Unexpected POST endpoint: ${path}`)
    })

    render(<DailyCare />)
    const note = 'A caregiver recorded a change in the daily routine.'
    fireEvent.change(screen.getByPlaceholderText(/describe what you observed, when it happened/i), { target: { value: note } })
    fireEvent.click(screen.getByRole('button', { name: /save what changed/i }))

    expect(await screen.findByText('Reconciliation result returned.')).toBeInTheDocument()
    await waitFor(() => {
      expect(mockedPostJSON).toHaveBeenCalledWith('/care-delta/reconcile', expect.objectContaining({
        person_id: 'person-real-1',
        source_event_id: 'event-saved-1',
        evidence_ids: ['evidence-saved-1'],
        content: note,
        event_date: '2026-10-23T08:15:42.000Z',
        persist: true,
      }))
    })
  })


  it('keeps server-completed care actions visible after dashboard reload and retains overdue active actions', async () => {
    mockedGetJSON.mockImplementation(async (path: string) => {
      if (path.startsWith('/caregivers/')) return [];
      if (path.startsWith('/events/')) return [];
      if (path.startsWith('/insights/')) return [];
      if (path.includes('/trends')) return [];
      if (path.includes('/reasoning/')) {
        return {
          confirmed_facts: [], open_questions: [], preferences: [],
          rejected_assumptions: [], care_patterns: [], coordination_decisions: [],
        };
      }
      if (path.startsWith('/daily-intelligence/')) {
        return {
          id: 'daily-1', intelligence_date: '2026-10-23',
          overdue_items: [], upcoming_items: [], active_windows: [],
          expired_windows: [], daily_summary: '',
        };
      }
      if (path.startsWith('/actions/')) return [
        {
          id: 'action-overdue-1',
          normalized_action: 'Confirm follow-up appointment',
          status: 'active',
          created_at: '2026-10-20T08:00:00Z',
          deadline: '2026-10-21T08:00:00Z',
        },
        {
          id: 'action-completed-1',
          normalized_action: 'Collect discharge paperwork',
          status: 'completed',
          created_at: '2026-10-20T08:00:00Z',
          completed_at: '2026-10-22T10:30:00Z',
          completed_by_caregiver_id: 'caregiver-real-1',
          completed_by_caregiver_label: 'Primary caregiver',
        },
      ] as never;
      if (path.startsWith('/appointments/')) return [];
      throw new Error(`Unexpected dashboard endpoint: ${path}`);
    });

    render(<MemoryRouter><Dashboard /></MemoryRouter>);

    expect(await screen.findByText('Confirm follow-up appointment')).toBeInTheDocument();
    expect(screen.getByText(/Overdue ·/)).toBeInTheDocument();
    expect(await screen.findByText('Collect discharge paperwork')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Completed' })).toBeDisabled();
    expect(screen.getByText(/Completed:/)).toBeInTheDocument();
    expect(screen.getByText('Completed by: Primary caregiver')).toBeInTheDocument();
    expect(mockedGetJSON).toHaveBeenCalledWith('/actions/person-real-1');
  });


  it('does not report a care action complete unless the backend confirms the completed status', async () => {
    mockedGetJSON.mockImplementation(async (path: string) => {
      if (path.startsWith('/caregivers/')) return [];
      if (path.startsWith('/events/')) return [];
      if (path.startsWith('/insights/')) return [];
      if (path.includes('/trends')) return [];
      if (path.includes('/reasoning/')) {
        return {
          confirmed_facts: [], open_questions: [], preferences: [],
          rejected_assumptions: [], care_patterns: [], coordination_decisions: [],
        };
      }
      if (path.startsWith('/daily-intelligence/')) {
        return {
          id: 'daily-1', intelligence_date: '2026-10-23',
          overdue_items: [], upcoming_items: [], active_windows: [],
          expired_windows: [], daily_summary: '',
        };
      }
      if (path.startsWith('/actions/')) return [{
        id: 'action-open-1',
        normalized_action: 'Confirm follow-up appointment',
        status: 'active',
        created_at: '2026-10-20T08:00:00Z',
      }] as never;
      if (path.startsWith('/appointments/')) return [];
      throw new Error(`Unexpected dashboard endpoint: ${path}`);
    });
    mockedPostJSON.mockImplementation(async (path: string) => {
      if (path === '/evidence') return { id: 'evidence-completion-1' } as never;
      if (path === '/actions/action-open-1/complete') return { status: 'active' } as never;
      throw new Error(`Unexpected POST endpoint: ${path}`);
    });

    render(<MemoryRouter><Dashboard /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Mark Complete' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/server did not confirm/i);
    expect(screen.getByRole('button', { name: 'Mark Complete' })).toBeEnabled();
    expect(screen.queryByText(/^Completed:/)).not.toBeInTheDocument();
  });

})
