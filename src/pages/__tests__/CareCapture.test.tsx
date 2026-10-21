import { jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CareCapture from '../../components/CareCapture';
import { getJSON, postJSON } from '../../api/client';

jest.mock('../../api/client', () => ({
  getJSON: jest.fn(),
  postJSON: jest.fn(),
  getPersonId: jest.fn(() => 'test-person-id'),
}));

describe('CareCapture caregiver workflow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getJSON as jest.Mock).mockResolvedValue([
      { id: 'caregiver-1', name: 'Test Caregiver' },
    ]);
    (postJSON as jest.Mock).mockResolvedValue({ ok: true });
  });

  it('resolves the linked caregiver and submits a care observation', async () => {
    const onCapture = jest.fn();
    render(<CareCapture pid="test-person-id" onCapture={onCapture} />);

    await waitFor(() => {
      expect(getJSON).toHaveBeenCalledWith('/caregivers/person/test-person-id');
    });

    const input = screen.getByPlaceholderText(/Dad wandered at 2 AM/i);
    fireEvent.change(input, {
      target: { value: 'Dad felt dizzy this morning' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save what changed/i }));

    await waitFor(() => {
      expect(postJSON).toHaveBeenCalledWith(
        '/situation',
        expect.objectContaining({
          caregiver_id: 'caregiver-1',
          person_id: 'test-person-id',
          raw_input: 'Dad felt dizzy this morning',
        }),
      );
    });
    expect(onCapture).toHaveBeenCalledWith('Dad felt dizzy this morning');
  });

  it('disables saving when no caregiver is linked to the person', async () => {
    (getJSON as jest.Mock).mockResolvedValueOnce([]);
    render(<CareCapture pid="test-person-id" />);

    await waitFor(() => {
      expect(screen.getByText(/no caregiver is linked/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /save what changed/i })).toBeDisabled();
  });
});
