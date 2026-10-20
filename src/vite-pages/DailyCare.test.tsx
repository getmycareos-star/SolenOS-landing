import { jest } from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

let mockLocationState: any = { status: 'unknown' };
let mockRequestLocation = jest.fn();

jest.unstable_mockModule('../lib/permissions/useLocationPermission', () => ({
  useLocationPermission: () => ({
    state: mockLocationState,
    requestLocation: mockRequestLocation,
  }),
}));

const { default: DailyCare } = await import('./DailyCare');

describe('DailyCare', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.setItem('solenos_person_id', 'test-person-id');
    localStorage.setItem('solenos_caregiver_id', 'test-caregiver-id');
    mockLocationState = { status: 'unknown' };
    mockRequestLocation = jest.fn();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    }) as unknown as typeof fetch;
  });

  it('renders the main heading', () => {
    render(<DailyCare />);
    expect(screen.getByRole('heading', { name: /what matters today/i })).toBeInTheDocument();
  });

  it('has a location section', () => {
    render(<DailyCare />);
    expect(screen.getByRole('heading', { name: /location/i })).toBeInTheDocument();
  });

  it('shows a location request button when permission is unknown', () => {
    render(<DailyCare />);
    expect(screen.getByRole('button', { name: /use my current location/i })).toBeInTheDocument();
  });

  it('displays coordinates when location permission is granted', async () => {
    mockLocationState = {
      status: 'granted',
      latitude: 40.7128,
      longitude: -74.006,
      accuracy: 10,
      timestamp: 1700000000000,
    };
    render(<DailyCare />);

    expect(await screen.findByText(/40\.712800°/)).toBeInTheDocument();
    expect(await screen.findByText(/-74\.006000°/)).toBeInTheDocument();
    expect(await screen.findByText(/accuracy: 10 meters/i)).toBeInTheDocument();
  });

  it('allows manual location entry when permission is denied', async () => {
    mockLocationState = { status: 'denied' };
    render(<DailyCare />);

    const latitude = screen.getByPlaceholderText(/latitude/i);
    const longitude = screen.getByPlaceholderText(/longitude/i);
    await userEvent.type(latitude, '34.0522');
    await userEvent.type(longitude, '-118.2437');

    expect(latitude).toHaveValue('34.0522');
    expect(longitude).toHaveValue('-118.2437');
  });

  it('submits a care record with the granted location and attribution', async () => {
    mockLocationState = {
      status: 'granted',
      latitude: 40.7128,
      longitude: -74.006,
      accuracy: 10,
      timestamp: 1700000000000,
    };
    render(<DailyCare />);

    await userEvent.selectOptions(screen.getByLabelText(/mood/i), 'Calm');
    await userEvent.selectOptions(screen.getByLabelText(/agitation level/i), 'None');
    await userEvent.click(screen.getByRole('button', { name: /save daily care entry/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/daily/log'),
        expect.objectContaining({ method: 'POST', body: expect.any(String) }),
      );
    });

    const fetchMock = global.fetch as jest.Mock;
    const call = fetchMock.mock.calls.find(([url]) => String(url).includes('/daily/log'));
    expect(call).toBeDefined();
    const body = JSON.parse(call![1].body as string);
    expect(body).toEqual(expect.objectContaining({
      person_id: 'test-person-id',
      caregiver_id: 'test-caregiver-id',
      medications: [],
      notes: expect.stringContaining('Mood selected: Calm'),
      scales: expect.arrayContaining([expect.objectContaining({ axis: 'agitation', score: 1 })]),
      location: {
        latitude: 40.7128,
        longitude: -74.006,
        accuracy: 10,
        timestamp: 1700000000000,
      },
      location_provenance: 'user_provided',
    }));
  });
});
