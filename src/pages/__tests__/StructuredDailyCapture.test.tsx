import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StructuredDailyCapture from '../StructuredDailyCapture';
import { postFormData, postJSON } from '../../api/client';

jest.mock('../../api/client', () => ({
  getPersonId: () => 'test-person-id',
  getCaregiverId: () => 'test-caregiver-id',
  getJSON: jest.fn().mockResolvedValue([]),
  postJSON: jest.fn().mockResolvedValue({ success: true, id: 'test-event-id' }),
  postFormData: jest.fn(),
}));

describe('StructuredDailyCapture photo evidence boundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('clearly states that photo evidence is unavailable and does not expose upload controls', () => {
    render(<StructuredDailyCapture />);

    expect(screen.getByText(/photo evidence unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/verified backend upload endpoint is not available/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/upload from device/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /take photo/i })).not.toBeInTheDocument();
  });

  it('allows medication details to be saved without making an unsupported upload request', async () => {
    const user = userEvent.setup();
    render(<StructuredDailyCapture />);

    await user.type(screen.getByLabelText(/medication name/i), 'Test Medication');
    await user.selectOptions(screen.getByLabelText(/status/i), 'given');
    await user.type(screen.getByLabelText(/dose/i), '10mg');
    await user.click(screen.getByRole('button', { name: /^add medication$/i }));

    expect(await screen.findByText(/test medication/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /save daily capture/i }));

    await waitFor(() => {
      expect(postJSON).toHaveBeenCalledWith(
        '/daily/log',
        expect.objectContaining({
          person_id: 'test-person-id',
          caregiver_id: 'test-caregiver-id',
          medications: expect.arrayContaining([
            expect.objectContaining({
              medication_name: 'Test Medication',
              photo_evidence_id: null,
            }),
          ]),
        }),
      );
    });
    expect(postFormData).not.toHaveBeenCalled();
  });
});
