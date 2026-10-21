import { jest } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StructuredDailyCapture from './StructuredDailyCapture';

describe('StructuredDailyCapture', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) }) as unknown as typeof fetch;
    localStorage.setItem("solenos_person_id", "test-person-id");
    localStorage.setItem("solenos_caregiver_id", "test-caregiver-id");
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
    fireEvent.change(screen.getByLabelText(/value/i), { target: { value: '72' } });
    fireEvent.change(screen.getByLabelText(/unit/i), { target: { value: 'bpm' } });
    
    // Submit vital form
    await userEvent.click(screen.getByRole('button', { name: /add vital/i }));
    
    // Verify vital is added to the list
    expect(screen.getAllByText(/heart rate/i).length).toBeGreaterThanOrEqual(2);
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
    expect(screen.getAllByText(/mood/i).length).toBeGreaterThanOrEqual(2);
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
    
    // Verify the real API client sends the expected request body.
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/daily/log'),
        expect.objectContaining({ method: 'POST', body: expect.any(String) }),
      );
    });
    const fetchMock = global.fetch as jest.Mock;
    const call = fetchMock.mock.calls.find(([url]) => String(url).includes('/daily/log'));
    expect(call).toBeDefined();
    expect(JSON.parse(call![1].body as string)).toEqual(expect.objectContaining({
      medications: expect.arrayContaining([
        expect.objectContaining({ medication_name: 'Aspirin', status: 'given' }),
      ]),
    }));
  });
});