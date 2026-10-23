import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Companion from './Companion';
import { getPersonId, postJSON } from '../api/client';

jest.mock('../api/client', () => ({
  getPersonId: jest.fn(),
  postJSON: jest.fn(),
}));

const mockedGetPersonId = getPersonId as jest.MockedFunction<typeof getPersonId>;
const mockedPostJSON = postJSON as jest.MockedFunction<typeof postJSON>;

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

describe('Companion first-use continuity', () => {
  beforeEach(() => {
    mockedGetPersonId.mockReturnValue('person-companion-test');
  });

  it('shows only confirmed backend replies as conversation and offers explicit capture handoff', async () => {
    mockedPostJSON.mockResolvedValue({
      reply: 'The note says the appointment moved to Thursday. Confirm the date with the clinic.',
      session_id: 'conversation-session-1',
      guard_verdict: 'passed',
      safety_note: null,
      confidence: 0.8,
      evidence_ids: [],
      ai_generated: true,
      provider_status: 'connected',
    });

    render(<MemoryRouter><Companion /></MemoryRouter>);
    fireEvent.change(screen.getByPlaceholderText(/type a message/i), {
      target: { value: 'The appointment moved to Thursday.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^send$/i }));

    await waitFor(() => expect(screen.getByText(/confirm the date with the clinic/i)).toBeInTheDocument());
    expect(screen.getByText(/conversation response only · not automatically saved as a living care record fact/i)).toBeInTheDocument();
    expect(screen.getByText(/ai-generated response · provider: connected/i)).toBeInTheDocument();
    expect(screen.getByText(/no living care record evidence was cited/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /use my message as a capture draft/i })).toHaveAttribute(
      'href',
      '/daily-care?draft=The%20appointment%20moved%20to%20Thursday.',
    );
    expect(mockedPostJSON).toHaveBeenCalledWith('/conversation/message', {
      person_id: 'person-companion-test',
      text: 'The appointment moved to Thursday.',
      session_id: null,
    });
  });

  it('preserves the unsent message and shows a recovery error when the backend fails', async () => {
    mockedPostJSON.mockRejectedValue(new Error('backend unavailable'));
    render(<MemoryRouter><Companion /></MemoryRouter>);
    const input = screen.getByPlaceholderText(/type a message/i) as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: 'Please help me understand this change.' } });
    fireEvent.click(screen.getByRole('button', { name: /^send$/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/server did not confirm/i));
    expect(input.value).toBe('Please help me understand this change.');
  });
});
