import { jest } from '@jest/globals'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'

const mockGetJSON = jest.fn()
let mockPersonIdListener: ((id: string) => void) | null = null
const mockSubscribe = jest.fn((callback: (id: string) => void) => {
  mockPersonIdListener = callback
  return () => {
    if (mockPersonIdListener === callback) mockPersonIdListener = null
  }
})

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
    mockPersonIdListener = null
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

  it('clears the previous record immediately and ignores its late response after a context switch', async () => {
    let resolveFirstRequest: ((value: unknown) => void) | undefined
    mockGetJSON
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirstRequest = resolve }))
      .mockResolvedValueOnce([{
        id: 'caregiver-2',
        person_id: 'care-record-2',
        name: 'Caregiver Two',
        email: 'caregiver-two@example.test',
        relationship: 'Son',
        timezone: 'Africa/Lagos',
        created_at: '2026-10-22T10:00:00Z',
      }])

    render(<CareCircle />)
    await waitFor(() => expect(mockGetJSON).toHaveBeenCalledTimes(1))
    expect(mockPersonIdListener).toBeTruthy()

    act(() => mockPersonIdListener?.('care-record-2'))

    expect(await screen.findByRole('heading', { name: 'Caregiver Two' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Caregiver One' })).not.toBeInTheDocument()

    await act(async () => {
      resolveFirstRequest?.([{
        id: 'caregiver-1',
        person_id: 'care-record-1',
        name: 'Caregiver One',
        email: 'caregiver@example.test',
        relationship: 'Daughter',
        timezone: 'America/New_York',
        created_at: '2026-10-21T10:00:00Z',
      }])
    })

    expect(screen.getByRole('heading', { name: 'Caregiver Two' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Caregiver One' })).not.toBeInTheDocument()
  })

  it('does not offer fake create-circle or add-member actions', async () => {
    mockGetJSON.mockResolvedValueOnce([])

    render(<CareCircle />)

    expect(await screen.findByText('No caregiver records have been added to this care recipient yet.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /new care circle/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /add member/i })).not.toBeInTheDocument()
  })
})
