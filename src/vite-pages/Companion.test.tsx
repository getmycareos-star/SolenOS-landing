import { jest } from '@jest/globals'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const mockPostJSON = jest.fn()

jest.unstable_mockModule('../api/client', () => ({
  postJSON: mockPostJSON,
  getPersonId: () => 'care-record-1',
}))

const { default: Companion } = await import('./Companion')

describe('Companion request failure handling', () => {
  beforeEach(() => {
    mockPostJSON.mockReset()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: jest.fn(),
    })
  })

  it('does not pretend a missing backend endpoint produced an AI answer and preserves the draft', async () => {
    mockPostJSON.mockRejectedValueOnce(new Error('API 404'))

    render(<Companion />)

    const message = 'What changed since the last appointment?'
    fireEvent.change(screen.getByPlaceholderText(/Type a message/), {
      target: { value: message },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    expect(await screen.findByText(/Companion service is not connected to the backend yet/)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Type a message/)).toHaveValue(message)
    await waitFor(() => expect(mockPostJSON).toHaveBeenCalledTimes(1))
  })
})
