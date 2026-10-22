import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DailyCare from './DailyCare';
import { getJSON, postJSON } from '../api/client';
import { useLocationPermission } from '../lib/permissions/useLocationPermission';

jest.mock('../api/client', () => ({
  getPersonId: () => 'test-person-id',
  getCaregiverId: () => 'caregiver-123',
  getJSON: jest.fn().mockResolvedValue([{ id: 'caregiver-123', name: 'Test Caregiver' }]),
  postJSON: jest.fn().mockResolvedValue({}),
}));

jest.mock('../lib/permissions/useLocationPermission', () => ({
  useLocationPermission: jest.fn(),
}));

const mockUseLocationPermission = useLocationPermission as jest.MockedFunction<typeof useLocationPermission>;

describe('DailyCare', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getJSON as jest.Mock).mockResolvedValue([{ id: 'caregiver-123', name: 'Test Caregiver' }]);
    (postJSON as jest.Mock).mockResolvedValue({});
    mockUseLocationPermission.mockReturnValue({
      state: { status: 'unknown' },
      requestLocation: jest.fn().mockResolvedValue(undefined),
    });
  });

  it('renders the main heading and location section', () => {
    render(<DailyCare />);
    expect(screen.getByRole('heading', { name: /what matters today/i })).toBeInTheDocument();
    expect(screen.getByText('Location', { exact: true })).toBeInTheDocument();
  });

  it('requests the current location when the location button is clicked', async () => {
    const requestLocation = jest.fn().mockResolvedValue(undefined);
    mockUseLocationPermission.mockReturnValue({
      state: { status: 'unknown' },
      requestLocation,
    });

    render(<DailyCare />);
    await userEvent.click(screen.getByRole('button', { name: /use my current location/i }));
    expect(requestLocation).toHaveBeenCalledTimes(1);
  });

  it('renders granted location data', () => {
    mockUseLocationPermission.mockReturnValue({
      state: {
        status: 'granted',
        latitude: 40.7128,
        longitude: -74.006,
        accuracy: 10,
        timestamp: Date.UTC(2026, 9, 21, 10, 0, 0),
      },
      requestLocation: jest.fn(),
    });

    render(<DailyCare />);
    expect(screen.getByText(/40\.712800°/)).toBeInTheDocument();
    expect(screen.getByText(/-74\.006000°/)).toBeInTheDocument();
    expect(screen.getByText(/accuracy: 10 meters/i)).toBeInTheDocument();
  });

  it('allows manual coordinate entry when location permission is denied', async () => {
    mockUseLocationPermission.mockReturnValue({
      state: { status: 'denied' },
      requestLocation: jest.fn(),
    });

    render(<DailyCare />);
    const latitude = screen.getByPlaceholderText(/latitude/i);
    const longitude = screen.getByPlaceholderText(/longitude/i);
    await userEvent.type(latitude, '34.0522');
    fireEvent.change(longitude, { target: { value: '-118.2437' } });
    expect(latitude).toHaveValue(34.0522);
    expect(longitude).toHaveValue(-118.2437);
  });

  it('submits the daily-care form with the granted location', async () => {
    mockUseLocationPermission.mockReturnValue({
      state: {
        status: 'granted',
        latitude: 40.7128,
        longitude: -74.006,
        accuracy: 10,
        timestamp: Date.UTC(2026, 9, 21, 10, 0, 0),
      },
      requestLocation: jest.fn(),
    });

    render(<DailyCare />);
    await userEvent.selectOptions(screen.getByLabelText(/mood/i), 'Calm');
    await userEvent.selectOptions(screen.getByLabelText(/agitation level/i), 'None');
    await userEvent.click(screen.getByRole('button', { name: /save daily care entry/i }));

    await waitFor(() => expect(postJSON).toHaveBeenCalledWith(
      '/daily/log',
      expect.objectContaining({
        person_id: 'test-person-id',
        caregiver_id: 'caregiver-123',
        medications: [],
        vitals: [],
        scales: expect.arrayContaining([
          expect.objectContaining({ axis: 'mood', score: 1 }),
          expect.objectContaining({ axis: 'agitation', score: 1, note: 'None' }),
          expect.objectContaining({ axis: 'wellbeing_stress', score: 3 }),
        ]),
        notes: '',
        location: {
          latitude: 40.7128,
          longitude: -74.006,
          accuracy: 10,
          timestamp: Date.UTC(2026, 9, 21, 10, 0, 0),
        },
        location_provenance: 'user_provided',
      })
    ));
  });
});
