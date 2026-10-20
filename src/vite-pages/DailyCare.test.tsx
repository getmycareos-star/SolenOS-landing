import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DailyCare from './DailyCare';

// Mock the postJSON and getJSON functions
jest.mock('../api/client', () => ({
  ...jest.requireActual('../api/client'),
  postJSON: jest.fn().mockResolvedValue({}),
  getJSON: jest.fn().mockResolvedValue([])
}));

// Mock the useLocationPermission hook
jest.mock('../lib/permissions/useLocationPermission', () => ({
  useLocationPermission: () => ({
    state: { status: 'unknown' },
    requestLocation: jest.fn()
  })
}));

// Mock the useState hook to control location state
let locationState = null;
const useStateMock = (initialValue) => {
  if (initialValue === null && typeof initialValue === 'object' && 'latitude' in initialValue) {
    // This is our location state
    return [locationState, (newValue) => { locationState = newValue; }];
  }
  // For other useState calls, return the actual state
  const [state, setState] = jest.requireActual('react').useState(initialValue);
  return [state, setState];
};

jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useState: useStateMock
}));

describe('DailyCare', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.setItem("solenos_person_id", "test-person-id");
    localStorage.setItem("solenos_caregiver_id", "test-caregiver-id");
    locationState = null;
  });

  it('should render the main heading', () => {
    render(<DailyCare />);
    const heading = screen.getByRole('heading', { name: /what matters today/i });
    expect(heading).toBeInTheDocument();
  });

  it('should have a location section', () => {
    render(<DailyCare />);
    expect(screen.getByRole('heading', { name: /location/i })).toBeInTheDocument();
  });

  it('should show location request button when state is unknown', () => {
    render(<DailyCare />);
    const locationButton = screen.getByRole('button', { name: /use my current location/i });
    expect(locationButton).toBeInTheDocument();
  });

  it('should handle location request', async () => {
    // Mock the useLocationPermission hook to return a granted state
    jest.mock('../lib/permissions/useLocationPermission', () => ({
      useLocationPermission: () => ({
        state: { 
          status: 'granted',
          latitude: 40.7128,
          longitude: -74.0060,
          accuracy: 10,
          timestamp: Date.now()
        },
        requestLocation: jest.fn()
      })
    }));
    
    render(<DailyCare />);
    
    // Click the location button
    await userEvent.click(screen.getByRole('button', { name: /use my current location/i }));
    
    // Verify location is displayed
    expect(await screen.findByText(/40.712800°/)).toBeInTheDocument();
    expect(await screen.findByText(/-74.006000°/)).toBeInTheDocument();
    expect(await screen.findByText(/accuracy: 10 meters/)).toBeInTheDocument();
  });

  it('should handle manual location entry when permission denied', async () => {
    // Mock the useLocationPermission hook to return a denied state
    jest.mock('../lib/permissions/useLocationPermission', () => ({
      useLocationPermission: () => ({
        state: { status: 'denied' },
        requestLocation: jest.fn()
      })
    }));
    
    render(<DailyCare />);
    
    // Verify manual input fields are shown
    expect(screen.getByPlaceholderText(/latitude/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/longitude/i)).toBeInTheDocument();
    
    // Enter manual coordinates
    await userEvent.type(screen.getByPlaceholderText(/latitude/i), '34.0522');
    await userEvent.type(screen.getByPlaceholderText(/longitude/i), '-118.2437');
    
    // Verify the values are entered
    expect(screen.getByPlaceholderText(/latitude/i)).toHaveValue('34.0522');
    expect(screen.getByPlaceholderText(/longitude/i)).toHaveValue('-118.2437');
  });

  it('should handle form submission with location', async () => {
    // Mock the useLocationPermission hook to return a granted state
    jest.mock('../lib/permissions/useLocationPermission', () => ({
      useLocationPermission: () => ({
        state: { 
          status: 'granted',
          latitude: 40.7128,
          longitude: -74.0060,
          accuracy: 10,
          timestamp: Date.now()
        },
        requestLocation: jest.fn()
      })
    }));
    
    render(<DailyCare />);
    
    // Fill in some form data
    await userEvent.selectOptions(screen.getByLabelText(/mood/i), 'Calm');
    await userEvent.selectOptions(screen.getByLabelText(/agitation level/i), 'None');
    
    // Set location via the mock (since we can't easily trigger the location request in test)
    // In a real test, we would click the button and wait for the async operation
    
    // Submit the form
    await userEvent.click(screen.getByRole('button', { name: /save daily care entry/i }));
    
    // Verify postJSON was called with location data
    expect(require('../api/client').postJSON).toHaveBeenCalledWith(
      '/daily/log',
      expect.objectContaining({
        person_id: 'test-person-id',
        caregiver_id: 'test-caregiver-id',
        medications: [],
        notes: expect.stringContaining('Mood selected: Calm'),
        scales: expect.arrayContaining([expect.objectContaining({ axis: 'agitation', score: 1 })]),
        location: {
          latitude: 40.7128,
          longitude: -74.0060,
          accuracy: 10,
          timestamp: expect.any(Number)
        },
        location_provenance: 'user_provided'
      })
    );
  });
});