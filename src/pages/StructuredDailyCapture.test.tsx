import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StructuredDailyCapture from './StructuredDailyCapture';
import CareCapture from '../components/CareCapture';
import { getCaregiverId, postJSON } from '../api/client';

// Mock the postJSON function
jest.mock('../api/client', () => ({
  getPersonId: () => 'test-person-id',
  getCaregiverId: jest.fn().mockReturnValue('caregiver-123'),
  getJSON: jest.fn().mockResolvedValue([]),
  postJSON: jest.fn().mockResolvedValue({}),
  postFormData: async (path: string, body: FormData) => {
    const response = await fetch(path, { method: 'POST', body });
    if (!response.ok) throw new Error('Failed to upload image');
    return response.json();
  },
}));

describe('StructuredDailyCapture', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the main heading', () => {
    render(<StructuredDailyCapture />);
    const heading = screen.getByRole('heading', { name: /structured daily capture/i });
    expect(heading).toBeInTheDocument();
  });

  it('should have sections for medications, vitals, and scales', () => {
    render(<StructuredDailyCapture />);
    
    expect(screen.getByRole('heading', { name: /medications/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /vitals/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /scales/i })).toBeInTheDocument();
  });

  it('should allow adding a medication', async () => {
    render(<StructuredDailyCapture />);
    
    // Fill in medication form
    await userEvent.type(screen.getByLabelText(/medication name/i), 'Aspirin');
    await userEvent.selectOptions(screen.getByLabelText(/status/i), 'given');
    await userEvent.type(screen.getByLabelText(/dose/i), '10mg');
    
    // Submit medication form
    await userEvent.click(screen.getByRole('button', { name: /add medication/i }));
    
    // Verify medication is added to the list
    expect(await screen.findByText(/aspirin/i)).toBeInTheDocument();
    expect(await screen.findByText(/10mg/i)).toBeInTheDocument();
  });

  it('should allow adding a vital', async () => {
    render(<StructuredDailyCapture />);
    
    // Fill in vital form
    await userEvent.selectOptions(screen.getByLabelText(/vital type/i), 'heart_rate');
    await userEvent.type(screen.getByLabelText(/value/i), '72');
    await userEvent.type(screen.getByLabelText(/unit/i), 'bpm');
    
    // Submit vital form
    await userEvent.click(screen.getByRole('button', { name: /add vital/i }));
    
    // Verify vital is added to the list
    expect(await screen.findByRole('heading', { name: /heart rate/i })).toBeInTheDocument();
    expect(await screen.findByText(/72 bpm/i)).toBeInTheDocument();
  });

  it('should allow adding a scale observation', async () => {
    render(<StructuredDailyCapture />);
    
    // Fill in scale form
    await userEvent.selectOptions(screen.getByLabelText(/scale type/i), 'mood');
    fireEvent.change(screen.getByLabelText(/score \(1-5\)/i), { target: { value: '4' } });
    
    // Submit scale form
    await userEvent.click(screen.getByRole('button', { name: /add scale/i }));
    
    // Verify scale is added to the list
    expect(await screen.findByRole('heading', { name: /mood/i })).toBeInTheDocument();
    expect(await screen.findByText(/4\/5/i)).toBeInTheDocument();
  });

  it('saves a situation using the selected caregiver identity', async () => {
    render(<CareCapture />);
    await userEvent.type(screen.getByPlaceholderText(/Add any additional notes about the day/i), 'Sleep was disrupted');
    await userEvent.click(screen.getByRole('button', { name: /save what changed/i }));

    await waitFor(() => {
      expect(postJSON).toHaveBeenCalledWith('/api/situation', {
        caregiver_id: 'caregiver-123',
        person_id: 'test-person-id',
        raw_input: 'Sleep was disrupted',
      });
    });
  });

  it('does not submit a situation when caregiver context is missing', async () => {
    (getCaregiverId as jest.Mock).mockReturnValueOnce(null);
    render(<CareCapture />);
    await userEvent.type(screen.getByPlaceholderText(/Add any additional notes about the day/i), 'Sleep was disrupted');
    await userEvent.click(screen.getByRole('button', { name: /save what changed/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/sign in and select an authorized care record/i);
    expect(postJSON).not.toHaveBeenCalled();
  });

  it('should handle form submission', async () => {
    render(<StructuredDailyCapture />);
    
    // Add a medication first
    await userEvent.type(screen.getByLabelText(/medication name/i), 'Aspirin');
    await userEvent.selectOptions(screen.getByLabelText(/status/i), 'given');
    await userEvent.click(screen.getByRole('button', { name: /add medication/i }));
    
    // Wait for medication to be added
    expect(await screen.findByText(/aspirin/i)).toBeInTheDocument();
    
    // Submit the form
    await userEvent.click(screen.getByRole('button', { name: /save daily capture/i }));
    
    // Verify postJSON was called
    expect(require('../api/client').postJSON).toHaveBeenCalledWith(
      '/daily/log',
      expect.objectContaining({
        medications: expect.arrayContaining([
          expect.objectContaining({
            medication_name: 'Aspirin',
            status: 'given'
          })
        ])
      })
    );
  });
});