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
    expect(screen.queryByText('No community posts yet. Be the first to share.')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Share what worked/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Find wisdom' })).toBeDisabled()
    await waitFor(() => expect(mockGetJSON).toHaveBeenCalledTimes(1))
  })

  it('does not increase a reaction count when the API rejects the reaction', async () => {
    mockGetJSON.mockResolvedValueOnce({
      posts: [{
        id: 'post-1',
        author_type: 'peer_caregiver',
        author_label: 'Caregiver',
        author_avatar_seed: 'cg',
        title: 'A real post',
        body: 'A caregiver-shared experience.',
        media: [],
        visibility: 'public',
        care_stage: 'moderate',
        tags: [],
        created_at: '2026-10-21T10:00:00.000Z',
        updated_at: null,
        provenance_source: 'community:peer_caregiver',
        reaction_counts: { like: 3, thank_you: 0, support: 0 },
        comment_count: 0,
        user_reaction: null,
      }],
    })
    mockPostJSON.mockRejectedValueOnce(new Error('404 Not Found'))

    render(
      <MemoryRouter>
        <Community />
      </MemoryRouter>,
    )

    const likeButton = await screen.findByRole('button', { name: /👍 3/ })
    likeButton.click()

    expect(await screen.findByRole('alert')).toHaveTextContent('Your reaction was not saved.')
    expect(screen.getByRole('button', { name: /👍 3/ })).toBeInTheDocument()
    expect(mockPostJSON).toHaveBeenCalledTimes(1)
  })

})
