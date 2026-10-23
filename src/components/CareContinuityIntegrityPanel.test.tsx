import { render, screen, waitFor } from '@testing-library/react';
import CareContinuityIntegrityPanel from './CareContinuityIntegrityPanel';
import { getJSON, postJSON, getCaregiverId } from '../api/client';

jest.mock('../api/client', () => ({
  getJSON: jest.fn(),
  postJSON: jest.fn(),
  patchJSON: jest.fn(),
  getCaregiverId: jest.fn(),
}));

const mockedGetJSON = getJSON as jest.MockedFunction<typeof getJSON>;
const mockedPostJSON = postJSON as jest.MockedFunction<typeof postJSON>;
const mockedGetCaregiverId = getCaregiverId as jest.MockedFunction<typeof getCaregiverId>;

describe('CareContinuityIntegrityPanel source availability', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetCaregiverId.mockReturnValue('caregiver-1');
    mockedPostJSON.mockResolvedValue([]);
  });

  it('keeps successful sections visible while treating a failed freshness source as unknown', async () => {
    mockedGetJSON
      .mockResolvedValueOnce([{
        id: 'assertion-1',
        field: 'sleep',
        assertion_kind: 'time_bound_observation',
        asserted_value: 'slept poorly',
        source_label: 'Caregiver report',
        evidence_ids: [],
        assertion_status: 'unreviewed',
        recorded_at: '2026-10-22T08:00:00Z',
      }])
      .mockRejectedValueOnce(new Error('freshness endpoint unavailable'))
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    render(<CareContinuityIntegrityPanel personId="person-1" />);

    expect(await screen.findByText(/sleep: slept poorly/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/could not verify: freshness and review status/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/freshness unknown/i)).toBeInTheDocument();
    expect(screen.queryByText(/no source-attributed reports have been entered/i)).not.toBeInTheDocument();
  });

  it('does not claim there is no evidence when the evidence source could not be checked', () => {
    render(
      <CareContinuityIntegrityPanel
        personId="person-1"
        evidenceItems={[]}
        evidenceAvailable={false}
      />,
    );

    expect(screen.getByText(/evidence source could not be checked/i)).toBeInTheDocument();
  });
});
