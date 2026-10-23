import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Record from './Record';
import { getJSON, getPersonId, getCaregiverId, postJSON } from '../api/client';

jest.mock('../api/client', () => ({
  getJSON: jest.fn(),
  getPersonId: jest.fn(),
  getCaregiverId: jest.fn(),
  postJSON: jest.fn(),
}));

const mockedGetJSON = getJSON as jest.MockedFunction<typeof getJSON>;
const mockedGetPersonId = getPersonId as jest.MockedFunction<typeof getPersonId>;
const mockedGetCaregiverId = getCaregiverId as jest.MockedFunction<typeof getCaregiverId>;

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

describe('Living Care Record first-use workflow', () => {
  beforeEach(() => {
    mockedGetPersonId.mockReturnValue('person-first-record');
    mockedGetCaregiverId.mockReturnValue('caregiver-first-record');
    mockedGetJSON.mockResolvedValue([]);
  });

  it('shows an honest empty record and only advertises the supported text-document intake', async () => {
    render(<MemoryRouter><Record /></MemoryRouter>);

    await waitFor(() => expect(screen.getByText(/no evidence recorded yet/i)).toBeInTheDocument());
    expect(screen.getByText(/currently accepts \.txt/i)).toBeInTheDocument();
    expect(screen.getByText(/pdf and scanned-image ocr are not available/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /add a related observation/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /review recorded events/i })).toBeInTheDocument();
    expect(mockedGetJSON).toHaveBeenCalledWith('/evidence/person-first-record');
  });

  it('preserves an uploaded text document and supports a persisted correction review', async () => {
    mockedGetJSON
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        id: 'evidence-document-1',
        type: 'document',
        source_text: 'Appointment moved to Thursday.',
        original_file_path: 'appointment.txt',
        uploaded_at: new Date().toISOString(),
      }]);
    const file = new File(['Appointment moved to Thursday.'], 'appointment.txt', { type: 'text/plain' });
    Object.defineProperty(file, 'text', { value: async () => 'Appointment moved to Thursday.' });
    mockedPostJSON
      .mockResolvedValueOnce({
        qwen_extraction_status: 'pending_review',
        qwen_analysis_id: 'analysis-document-1',
        qwen_candidates: {
          observations: [{
            subject: 'Appointment',
            observation: 'Appointment moved to Thursday.',
            source_quote: 'Appointment moved to Thursday.',
            review_status: 'pending_review',
          }],
        },
      })
      .mockResolvedValueOnce({
        candidate: {
          subject: 'Appointment',
          observation: 'Appointment moved to Friday.',
          source_quote: 'Appointment moved to Thursday.',
          review_status: 'corrected_by_caregiver',
        },
        message: 'Caregiver correction saved for review.',
      });

    render(<MemoryRouter><Record /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(/no evidence recorded yet/i)).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/choose a text document/i), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: /save and analyze/i }));

    await waitFor(() => expect(screen.getByText(/appointment moved to thursday/i)).toBeInTheDocument());
    expect(screen.getByText(/pending_review/i)).toBeInTheDocument();
    expect(screen.getByText(/extracted observations are source-linked review candidates/i)).toBeInTheDocument();
    expect(await screen.findByText(/source document: appointment.txt/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/corrected document observation 1/i), {
      target: { value: 'Appointment moved to Friday.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save correction/i }));

    await waitFor(() => expect(screen.getByText(/caregiver correction saved for review/i)).toBeInTheDocument());
    expect(mockedPostJSON).toHaveBeenLastCalledWith('/capture/analyses/analysis-document-1/review', {
      candidate_index: 0,
      decision: 'correct',
      corrected_observation: 'Appointment moved to Friday.',
    });
    expect(screen.getByText(/appointment moved to friday/i)).toBeInTheDocument();
  });

  it('does not show an empty record when evidence retrieval fails', async () => {
    mockedGetJSON.mockRejectedValue(new Error('backend unavailable'));
    render(<MemoryRouter><Record /></MemoryRouter>);

    await waitFor(() => expect(screen.getByText(/could not be loaded/i)).toBeInTheDocument());
    expect(screen.queryByText(/no evidence recorded yet/i)).not.toBeInTheDocument();
  });
});
