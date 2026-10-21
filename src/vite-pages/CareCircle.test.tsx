import { jest } from '@jest/globals'
import { cleanup, render, screen, waitFor } from '@testing-library/react'

const mockGetJSON = jest.fn()
const mockSubscribe = jest.fn(() => () => {})

jest.unstable_mockModule('../api/client', () => ({
  getJSON: mockGetJSON,
  getPersonId: () => 'care-record-1',
  subscribeToPersonId: mockSubscribe,
}))

const { default: CareCircle } = await import('./CareCircle')

describe('Caregiver network', () => {
  beforeEach(() => {
    cleanup()
    mockGetJSON.mockReset()
    mockSubscribe.mockClear()
  })

  it('loads only the supported caregiver endpoint for the selected care record', async () => {
    mockGetJSON.mockResolvedValueOnce([{
      id: 'caregiver-1',
      person_id: 'care-record-1',
      name: 'Caregiver One',
      email: 'caregiver@example.test',
      relationship: 'Daughter',
      timezone: 'America/New_York',
      created_at: '2026-10-21T10:00:00Z',
    }])

    render(<CareCircle />)

    expect(await screen.findByRole('heading', { name: 'Caregiver One' })).toBeInTheDocument()
    expect(screen.getByText('Daughter')).toBeInTheDocument()
    await waitFor(() => expect(mockGetJSON).toHaveBeenCalledWith('/caregivers/person/care-record-1'))
  })

  it('does not present a failed API response as an empty caregiver network', async () => {
    mockGetJSON.mockRejectedValueOnce(new Error('403 No access to this care record'))

    render(<CareCircle />)

    expect(await screen.findByRole('alert')).toHaveTextContent('403 No access to this care record')
    expect(screen.queryByText('No caregiver records have been added to this care recipient yet.')).not.toBeInTheDocument()
  })

  it('does not offer fake create-circle or add-member actions', async () => {
    mockGetJSON.mockResolvedValueOnce([])

    render(<CareCircle />)

    expect(await screen.findByText('No caregiver records have been added to this care recipient yet.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /new care circle/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /add member/i })).not.toBeInTheDocument()
  })
})
