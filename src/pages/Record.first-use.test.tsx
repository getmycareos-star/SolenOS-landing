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

  it('does not show an empty record when evidence retrieval fails', async () => {
    mockedGetJSON.mockRejectedValue(new Error('backend unavailable'));
    render(<MemoryRouter><Record /></MemoryRouter>);

    await waitFor(() => expect(screen.getByText(/could not be loaded/i)).toBeInTheDocument());
    expect(screen.queryByText(/no evidence recorded yet/i)).not.toBeInTheDocument();
  });
});
