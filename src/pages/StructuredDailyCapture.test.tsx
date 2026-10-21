import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StructuredDailyCapture from './StructuredDailyCapture';

// Mock the postJSON function
jest.mock('../api/client', () => ({
  ...jest.requireActual('../api/client'),
  postJSON: jest.fn().mockResolvedValue({}),
  getPersonId: jest.fn(() => 'test-person'),
  getCaregiverId: jest.fn(() => 'test-caregiver')
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
    expect((await screen.findAllByText(/heart rate/i)).length).toBeGreaterThan(0);
    expect(await screen.findByText(/72 bpm/i)).toBeInTheDocument();
  });

  it('should allow adding a scale observation', async () => {
    render(<StructuredDailyCapture />);
    
    // Fill in scale form
    await userEvent.selectOptions(screen.getByLabelText(/scale type/i), 'mood');
    const scoreInput = screen.getByLabelText(/score \(1-5\)/i);
    await userEvent.clear(scoreInput);
    await userEvent.type(scoreInput, '4');
    
    // Submit scale form
    await userEvent.click(screen.getByRole('button', { name: /add scale/i }));
    
    // Verify scale is added to the list
    expect(await screen.findByText(/mood/i)).toBeInTheDocument();
    expect(await screen.findByText(/4\/5/i)).toBeInTheDocument();
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