import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CareCapture from './CareCapture';

jest.mock('../api/client', () => ({
  ...jest.requireActual('../api/client'),
  postJSON: jest.fn().mockResolvedValue({
    ok: true,
    message: 'Care input recorded successfully.',
    care_event_id: 'event-123',
    evidence_id: 'evidence-123',
    events: [{
      id: 'event-123',
      occurred_at: '2026-10-20T08:30:00Z',
      time_provenance: 'caregiver_reported_event_time',
      evidence_ids: ['evidence-123'],
    }],
    qwen_extraction_status: 'not_configured',
  }),
  getPersonId: jest.fn(() => 'person-real-123'),
  getCaregiverId: jest.fn(() => 'caregiver-real-123'),
}));

describe('CareCapture quick daily entry', () => {
  beforeEach(() => jest.clearAllMocks());

  it('offers the six common quick-entry categories and changes the prompt', async () => {
    render(<CareCapture />);
    expect(screen.getByRole('button', { name: 'Symptom' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Sleep' }));
    expect(screen.getByRole('button', { name: 'Sleep' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/how did they sleep/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/how did they sleep/i)).toBeInTheDocument();
  });

  it('sends the selected category and a caregiver-supplied event time without changing the source report', async () => {
    const { postJSON } = require('../api/client');
    render(<CareCapture />);
    await userEvent.click(screen.getByRole('button', { name: 'Sleep' }));
    await userEvent.type(screen.getByPlaceholderText(/how did they sleep/i), 'Slept about three hours and woke twice.');
    fireEvent.change(screen.getByLabelText('When did this happen?'), { target: { value: '2026-10-20T08:30' } });
    await userEvent.click(screen.getByRole('button', { name: /save what changed/i }));

    await waitFor(() => expect(postJSON).toHaveBeenCalledWith('/situation', expect.objectContaining({
      capture_category: 'sleep',
      timestamp: new Date('2026-10-20T08:30').toISOString(),
      raw_input: 'Slept about three hours and woke twice.',
      provenance: expect.objectContaining({ entry_method: 'quick_entry' }),
    })));
    expect(await screen.findByText(/event time reported by caregiver/i)).toBeInTheDocument();
    expect(screen.getByText('Slept about three hours and woke twice.')).toBeInTheDocument();
    expect(screen.getByLabelText('When did this happen?')).toHaveValue('');
  });
});
