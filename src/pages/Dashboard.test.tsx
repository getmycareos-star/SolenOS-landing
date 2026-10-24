import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from './Dashboard';
import { getJSON, getPersonId, getCaregiverId } from '../api/client';

jest.mock('../api/client', () => ({
  getJSON: jest.fn(),
  postJSON: jest.fn(),
  patchJSON: jest.fn(),
  deleteJSON: jest.fn(),
  getPersonId: jest.fn(),
  getCaregiverId: jest.fn(),
}));

jest.mock('../components/CareCapture', () => ({
  __esModule: true,
  default: () => <div data-testid="care-capture" />,
}));

const mockedGetJSON = jest.mocked(getJSON);
const mockedGetPersonId = jest.mocked(getPersonId);
const mockedGetCaregiverId = jest.mocked(getCaregiverId);

const reasoning = {
  confirmed_facts: [],
  open_questions: [],
  preferences: [],
  rejected_assumptions: [],
  care_patterns: [],
  coordination_decisions: [],
};

function dailyIntelligence(proactiveItems: Array<Record<string, unknown>> = []) {
  return {
    id: 'daily-intelligence-real-1',
    intelligence_date: '2026-10-24',
    overdue_items: [],
    upcoming_items: [],
    active_windows: [],
    expired_windows: [],
    proactive_items: proactiveItems,
    daily_summary: 'No overdue items were recorded in the connected care record.',
  };
}

function mockDashboardResponses(overrides: Record<string, unknown> = {}) {
  mockedGetJSON.mockImplementation(async (path: string) => {
    if (path.startsWith('/caregivers/')) return [];
    if (path.startsWith('/events/')) return [];
    if (path.startsWith('/insights/')) return [];
    if (path.startsWith('/observations/')) return [];
    if (path.startsWith('/reasoning/')) return reasoning;
    if (path.startsWith('/daily-intelligence/')) return dailyIntelligence([
      {
        id: 'proactive-1',
        title: 'Confirm the follow-up appointment',
        message: 'The recorded follow-up remains pending confirmation.',
        priority: 'coordination',
        status: 'pending_confirmation',
        source_ids: ['action-real-1'],
        source_evidence_ids: ['evidence-real-1'],
        source_passage: 'follow-up in two weeks',
        time_provenance: 'caregiver_recorded',
      },
    ]);
    if (path.startsWith('/actions/')) return [];
    if (path.startsWith('/appointments/')) return [];
    if (path.startsWith('/reminders/people/') && path.endsWith('/deliveries')) return [];
    if (path.startsWith('/reminders/people/')) return [];
    if (Object.prototype.hasOwnProperty.call(overrides, path)) return overrides[path];
    throw new Error(`Unexpected dashboard endpoint: ${path}`);
  });
}

describe('Dashboard proactive care integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetPersonId.mockReturnValue('person-real-1');
    mockedGetCaregiverId.mockReturnValue('caregiver-real-1');
    mockDashboardResponses();
  });

  afterEach(() => cleanup());

  it('renders only source-linked proactive items returned by the API', async () => {
    render(<MemoryRouter><Dashboard /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: 'Proactive care coordination' })).toBeInTheDocument();
    expect(screen.getByText('Confirm the follow-up appointment')).toBeInTheDocument();
    expect(screen.getByText('The recorded follow-up remains pending confirmation.')).toBeInTheDocument();
    expect(screen.getByText(/Source references: evidence-real-1, action-real-1/)).toBeInTheDocument();
    expect(screen.getByText(/Time provenance: caregiver recorded/)).toBeInTheDocument();

    await waitFor(() => {
      expect(mockedGetJSON).toHaveBeenCalledWith('/daily-intelligence/person-real-1');
    });
  });

  it('withholds malformed proactive cues instead of inventing titles or messages', async () => {
    mockedGetJSON.mockImplementation(async (path: string) => {
      if (path.startsWith('/caregivers/')) return [];
      if (path.startsWith('/events/')) return [];
      if (path.startsWith('/insights/')) return [];
      if (path.startsWith('/observations/')) return [];
      if (path.startsWith('/reasoning/')) return reasoning;
      if (path.startsWith('/daily-intelligence/')) return dailyIntelligence([
        { id: 'malformed-cue', priority: 'urgent' },
      ]);
      if (path.startsWith('/actions/')) return [];
      if (path.startsWith('/appointments/')) return [];
      if (path.startsWith('/reminders/people/') && path.endsWith('/deliveries')) return [];
      if (path.startsWith('/reminders/people/')) return [];
      throw new Error(`Unexpected dashboard endpoint: ${path}`);
    });

    render(<MemoryRouter><Dashboard /></MemoryRouter>);

    expect(await screen.findByText(/1 proactive cue\(s\) were withheld/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Proactive care coordination' })).not.toBeInTheDocument();
    expect(screen.queryByText('Care coordination item')).not.toBeInTheDocument();
    expect(screen.queryByText('Review the source record.')).not.toBeInTheDocument();
  });

  it('reports an unavailable daily-intelligence endpoint instead of substituting sample data', async () => {
    mockedGetJSON.mockImplementation(async (path: string) => {
      if (path.startsWith('/caregivers/')) return [];
      if (path.startsWith('/events/')) return [];
      if (path.startsWith('/insights/')) return [];
      if (path.startsWith('/observations/')) return [];
      if (path.startsWith('/reasoning/')) return reasoning;
      if (path.startsWith('/daily-intelligence/')) throw new Error('API unavailable');
      if (path.startsWith('/actions/')) return [];
      if (path.startsWith('/appointments/')) return [];
      if (path.startsWith('/reminders/people/') && path.endsWith('/deliveries')) return [];
      if (path.startsWith('/reminders/people/')) return [];
      throw new Error(`Unexpected dashboard endpoint: ${path}`);
    });

    render(<MemoryRouter><Dashboard /></MemoryRouter>);

    expect(await screen.findByText(/Some dashboard data could not be loaded: daily intelligence/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Proactive care coordination' })).not.toBeInTheDocument();
  });

  it('does not request or display another care record when no authorized person is selected', async () => {
    mockedGetPersonId.mockReturnValue('');

    render(<MemoryRouter><Dashboard /></MemoryRouter>);

    expect(await screen.findByText(/No care record is selected/)).toBeInTheDocument();
    expect(mockedGetJSON).not.toHaveBeenCalled();
    expect(screen.queryByRole('heading', { name: 'Proactive care coordination' })).not.toBeInTheDocument();
  });
});
