import { jest } from '@jest/globals'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const mockGetJSON = jest.fn()
const mockPostJSON = jest.fn()

jest.unstable_mockModule('../api/client', () => ({
  getJSON: mockGetJSON,
  postJSON: mockPostJSON,
  getPersonId: () => 'care-record-1',
}))

const { default: Community } = await import('./Community')

describe('Community unavailable state', () => {
  beforeEach(() => {
    cleanup()
    mockGetJSON.mockReset()
    mockPostJSON.mockReset()
    localStorage.clear()
  })

  it('never displays fabricated caregiver posts when the community API fails', async () => {
    mockGetJSON.mockRejectedValueOnce(new Error('404 Not Found'))

    render(
      <MemoryRouter>
        <Community />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No sample or invented caregiver posts are shown.',
    )
    expect(screen.queryByText('Managing sundowning evenings')).not.toBeInTheDocument()
    expect(screen.queryByText('Medication adherence hack')).not.toBeInTheDocument()
    await waitFor(() => expect(mockGetJSON).toHaveBeenCalledTimes(1))
  })

})
