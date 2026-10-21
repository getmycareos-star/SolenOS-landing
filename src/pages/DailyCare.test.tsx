import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DailyCare from './DailyCare';

const mockLocationPermission = {
  state: { status: 'unknown' as string } as any,
  requestLocation: jest.fn().mockResolvedValue(undefined),
};

jest.mock('../api/client', () => ({
  getPersonId: jest.fn(() => 'test-person'),
  getJSON: jest.fn().mockResolvedValue([{ id: 'test-caregiver', name: 'Test Caregiver' }]),
  postJSON: jest.fn().mockResolvedValue({ id: 'entry-1' }),
}));

jest.mock('../lib/permissions/useLocationPermission', () => ({
  useLocationPermission: () => mockLocationPermission,
}));

describe('DailyCare', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { getPersonId } = require('../api/client');
    (getPersonId as jest.Mock).mockReturnValue('test-person');
    mockLocationPermission.state = { status: 'unknown' };
  });

  it('does not invent a care record or request caregivers when no record is selected', async () => {
    const { getPersonId, getJSON } = require('../api/client');
    (getPersonId as jest.Mock).mockReturnValue('');

    render(<DailyCare />);

    expect(await screen.findByText(/select a care record before recording daily care/i)).toBeInTheDocument();
    expect(getJSON).not.toHaveBeenCalled();
    expect(screen.queryByRole('option', { name: /demo caregiver/i })).not.toBeInTheDocument();
  });

  it('renders the main heading', async () => {
    render(<DailyCare />);
    expect(screen.getByRole('heading', { name: /what matters today/i })).toBeInTheDocument();
  });

  it('loads and displays the caregiver list', async () => {
    render(<DailyCare />);
    await waitFor(() => expect(screen.getByText(/recorded by/i)).toBeInTheDocument());
    expect(await screen.findByRole('option', { name: 'Test Caregiver' })).toBeInTheDocument();
  });

  it('shows the location request control while permission is unknown', () => {
    render(<DailyCare />);
    expect(screen.getByRole('button', { name: /use my current location/i })).toBeInTheDocument();
  });

  it('requests location when the user presses the location button', async () => {
    const user = userEvent.setup();
    render(<DailyCare />);
    await user.click(screen.getByRole('button', { name: /use my current location/i }));
    expect(mockLocationPermission.requestLocation).toHaveBeenCalledTimes(1);
  });

  it('shows manual coordinate inputs when location permission is denied', () => {
    mockLocationPermission.state = { status: 'denied' };
    render(<DailyCare />);
    expect(screen.getByPlaceholderText(/latitude/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/longitude/i)).toBeInTheDocument();
  });
});
