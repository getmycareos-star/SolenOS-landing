import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import CareCapture from '../components/CareCapture'

function jsonResponse(status: number, payload: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    json: async () => payload,
  } as unknown as Response
}

describe('CareCapture persistence behavior', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('solenos_person_id', 'person-1')
    localStorage.setItem('solenos_caregiver_id', 'caregiver-1')
    jest.restoreAllMocks()
  })

  it('preserves the caregiver draft when saving the situation fails', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse(500, { detail: 'Database unavailable' }),
    ) as unknown as typeof fetch

    render(<CareCapture />)
    const draft = 'She was more confused after lunch today.'
    fireEvent.change(screen.getByRole('textbox'), { target: { value: draft } })
    fireEvent.click(screen.getByRole('button', { name: /save what changed/i }))

    await waitFor(() => {
      expect(screen.getByText('Failed to save')).toBeInTheDocument()
    })
    expect(screen.getByRole('textbox')).toHaveValue(draft)
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('clears the draft only after the care situation is saved, even if optional community matching is unavailable', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(jsonResponse(200, { success: true }))
      .mockResolvedValueOnce(jsonResponse(404, { detail: 'Not Found' }))
    global.fetch = fetchMock as unknown as typeof fetch
    const onCapture = jest.fn()

    render(<CareCapture onCapture={onCapture} />)
    const draft = 'She was more confused after lunch today.'
    fireEvent.change(screen.getByRole('textbox'), { target: { value: draft } })
    fireEvent.click(screen.getByRole('button', { name: /save what changed/i }))

    await waitFor(() => {
      expect(onCapture).toHaveBeenCalledWith(draft)
    })
    expect(screen.getByRole('textbox')).toHaveValue('')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
