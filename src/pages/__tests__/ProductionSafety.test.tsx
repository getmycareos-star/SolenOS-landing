import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import { MemoryRouter } from 'react-router-dom'
import Community from '../Community'
import Memory from '../Memory'
import TeamDashboard from '../TeamDashboard'
import CareCapture from '../../components/CareCapture'
import Dashboard from '../Dashboard'
import { getJSON, getCaregiverId, getPersonId, postJSON } from '../../api/client'

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

  it('opens with a care overview and routes daily capture to its own screen', async () => {
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
      if (path.startsWith('/appointments/')) return [];
      if (path.startsWith('/caregivers/')) return [];
      throw new Error(`Unexpected dashboard endpoint: ${path}`);
    });

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /care overview/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /record today's change/i })).toHaveAttribute('href', '/daily-care');
    expect(screen.getByRole('link', { name: /open care record/i })).toHaveAttribute('href', '/record');
    expect(screen.getByRole('link', { name: /view timeline/i })).toHaveAttribute('href', '/timeline');
    expect(screen.queryByPlaceholderText(/describe what you observed/i)).not.toBeInTheDocument();
    expect(await screen.findByText(/care overview/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(mockedGetJSON.mock.calls.some(([path]) => String(path).startsWith('/events/'))).toBe(true);
    });
    expect(screen.queryByText(/Living Care Record system model/i)).not.toBeInTheDocument();
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
})
