import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import FirstUseJourney from './FirstUseJourney';
import { getJSON, getPersonId } from '../api/client';

jest.mock('../api/client', () => ({
  getJSON: jest.fn(),
  getPersonId: jest.fn(),
}));

const mockedGetJSON = getJSON as jest.MockedFunction<typeof getJSON>;
const mockedGetPersonId = getPersonId as jest.MockedFunction<typeof getPersonId>;

function renderJourney() {
  return render(
    <MemoryRouter>
      <FirstUseJourney />
    </MemoryRouter>,
  );
}

describe('FirstUseJourney', () => {
  beforeEach(() => {
    mockedGetPersonId.mockReturnValue('person-real-1');
    mockedGetJSON.mockReset();
  });

  it('discovers the three primary starting points and wider product areas', async () => {
    mockedGetJSON.mockResolvedValue([]);
    renderJourney();

    expect(screen.getByRole('heading', { name: /keep the care story connected/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /start daily capture/i })).toHaveAttribute('href', '/daily-care');
    expect(screen.getByRole('link', { name: /open companion/i })).toHaveAttribute('href', '/companion');
    expect(screen.getByRole('link', { name: /add a text document/i })).toHaveAttribute('href', '/record');
    expect(screen.getByRole('link', { name: /community/i })).toHaveAttribute('href', '/community');

    await waitFor(() => {
      expect(screen.getByText(/has no events or evidence yet/i)).toBeInTheDocument();
    });
  });

  it('does not call a record empty when the record request fails', async () => {
    mockedGetJSON.mockRejectedValue(new Error('backend unavailable'));
    renderJourney();

    await waitFor(() => {
      expect(screen.getByText(/record state could not be confirmed/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/has no events or evidence yet/i)).not.toBeInTheDocument();
  });

  it('reports existing saved information when either source has records', async () => {
    mockedGetJSON
      .mockResolvedValueOnce([{ id: 'event-1' }])
      .mockResolvedValueOnce([]);

    renderJourney();

    await waitFor(() => {
      expect(screen.getByText(/saved care information was found/i)).toBeInTheDocument();
    });
  });

  it('does not assert emptiness when no care-record identity is available', async () => {
    mockedGetPersonId.mockReturnValue(null);
    renderJourney();

    expect(screen.getByText(/record state could not be confirmed/i)).toBeInTheDocument();
    expect(mockedGetJSON).not.toHaveBeenCalled();
  });
});
