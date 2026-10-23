import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Record from './Record'
import { getJSON, getPersonId, getCaregiverId, postJSON } from '../api/client'

jest.mock('../api/client', () => ({
  getJSON: jest.fn(),
  getPersonId: jest.fn(),
  getCaregiverId: jest.fn(),
  postJSON: jest.fn(),
  patchJSON: jest.fn(),
}))

const currentTimeline = [
  {
    id: 'event:event-1',
    kind: 'care_event',
    source_id: 'event-1',
    occurred_at: '2026-10-22T08:30:00Z',
    recorded_at: '2026-10-22T08:31:00Z',
    title: 'Hospital discharge',
    summary: 'Returned home after discharge.',
    status: 'recorded',
    source_type: 'care_event',
    time_provenance: 'caregiver_reported',
    evidence: [
      {
        id: 'evidence-1',
        type: 'discharge_instruction',
        source_text: 'Call the clinic if dizziness worsens.',
        uploaded_at: '2026-10-22T08:00:00Z',
      },
    ],
    details: { event_type: 'hospital_discharge' },
  },
]

describe('Living Care Record timeline', () => {
  beforeEach(() => {
    ;(getPersonId as jest.Mock).mockReturnValue('person-1')
    ;(getCaregiverId as jest.Mock).mockReturnValue('caregiver-1')
    ;(getJSON as jest.Mock).mockImplementation((path: string) => {
      if (path.startsWith('/care-record/')) {
        return Promise.resolve({ person_id: 'person-1', returned_count: 1, has_more: false, timeline: currentTimeline })
      }
      return Promise.resolve([])
    })
    ;(postJSON as jest.Mock).mockResolvedValue([])
  })

  it('loads a unified timeline and shows linked source material alongside continuity panels', async () => {
    render(
      <MemoryRouter>
        <Record />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(getJSON).toHaveBeenCalledWith('/care-record/person-1?limit=200&offset=0')
    })
    expect(await screen.findByText('Hospital discharge')).toBeTruthy()
    expect(screen.getByText('Returned home after discharge.')).toBeTruthy()
    expect(screen.getByText('Supporting source material')).toBeTruthy()
    expect(screen.getByText('Call the clinic if dizziness worsens.')).toBeTruthy()
    expect(screen.getByText('Care Continuity Integrity')).toBeTruthy()
  })

  it('loads older records without replacing the current timeline', async () => {
    ;(getJSON as jest.Mock).mockImplementation((path: string) => {
      if (path.startsWith('/care-record/') && path.includes('offset=1')) {
        return Promise.resolve({
          has_more: false,
          timeline: [
            {
              id: 'observation:older-1',
              kind: 'observation',
              source_id: 'older-1',
              occurred_at: '2026-10-10T07:00:00Z',
              recorded_at: '2026-10-10T07:01:00Z',
              title: 'Care observation',
              summary: 'Older observation',
              status: 'recorded',
            },
          ],
        })
      }
      if (path.startsWith('/care-record/')) {
        return Promise.resolve({ has_more: true, timeline: currentTimeline })
      }
      return Promise.resolve([])
    })

    render(
      <MemoryRouter>
        <Record />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Hospital discharge')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Load older records' }))
    expect(await screen.findByText('Older observation')).toBeTruthy()
    await waitFor(() => {
      expect(getJSON).toHaveBeenLastCalledWith('/care-record/person-1?limit=200&offset=1')
    })
    expect(screen.queryByRole('button', { name: 'Load older records' })).toBeNull()
    expect(screen.getByText('Hospital discharge')).toBeTruthy()
  })

  it('reports an invalid unified timeline response instead of silently showing an empty record', async () => {
    ;(getJSON as jest.Mock).mockImplementation((path: string) => {
      if (path.startsWith('/care-record/')) return Promise.resolve({ items: [] })
      return Promise.resolve([])
    })

    render(
      <MemoryRouter>
        <Record />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByText(/could not be loaded/i)).toBeTruthy()
  })
})
