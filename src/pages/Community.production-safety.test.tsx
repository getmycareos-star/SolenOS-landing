import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Community from './Community'
import { computePoolRunway } from '../lib/cognitive-relief/modules/runway'
import { DEFAULT_PROFILE } from '../lib/cognitive-relief/types'

jest.mock('../api/client', () => ({
  getJSON: jest.fn(),
  postJSON: jest.fn(),
  getCaregiverId: jest.fn(() => 'caregiver-from-local-storage'),
  checkAuthState: jest.fn(async () => ({ authenticated: false, sessionInfo: null })),
}))

import { getJSON, postJSON } from '../api/client'

const mockedGetJSON = getJSON as jest.Mock
const mockedPostJSON = postJSON as jest.Mock

describe('Community production data integrity', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('shows a distinct load error and never substitutes invented posts when the API fails', async () => {
    mockedGetJSON.mockRejectedValue(new Error('API unavailable'))

    render(<MemoryRouter><Community /></MemoryRouter>)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Community posts could not be loaded',
    )
    expect(screen.queryByText(/M\. Johnson|sample caregiver|sample post|DEMO_/i)).not.toBeInTheDocument()
    expect(mockedPostJSON).not.toHaveBeenCalled()
  })

  it('blocks community posting when the session is not authenticated and preserves the draft', async () => {
    mockedGetJSON.mockRejectedValue(new Error('API unavailable'))

    render(<MemoryRouter><Community /></MemoryRouter>)

    fireEvent.click(screen.getByRole('button', { name: /share what worked/i }))
    const draft = 'A real draft that must not be discarded'
    fireEvent.change(screen.getByPlaceholderText(/share a tip, routine/i), {
      target: { value: draft },
    })
    fireEvent.click(screen.getByRole('button', { name: /^share$/i }))

    expect(await screen.findByText(/cannot verify an authenticated caregiver session/i)).toBeInTheDocument()
    expect(screen.getByDisplayValue(draft)).toBeInTheDocument()
    expect(mockedPostJSON).not.toHaveBeenCalled()
  })
})

describe('Care-finance estimates remain evidence-bound', () => {
  it('does not infer money or caregiver-time depletion from keywords', () => {
    const result = computePoolRunway(DEFAULT_PROFILE, 2400, ['property tax due', 'roof repair', 'no backup'])
    expect(result.runways).toHaveLength(2)
    expect(result.runways.every((entry) => entry.estimated_depletion_window.toLowerCase().includes('unknown'))).toBe(true)
    expect(result.runways.every((entry) => entry.assumptions_used.length > 0)).toBe(true)
    expect(JSON.stringify(result)).not.toMatch(/\$150|\$200|\$300|around early fall|moderate — monitor/i)
  })

  it('does not invent a budget when none was provided', () => {
    const result = computePoolRunway(DEFAULT_PROFILE, null)
    expect(result.optional_budget).toBeNull()
    expect(result.runways[0].estimated_depletion_window).toContain('no caregiver-entered budget')
  })
})
