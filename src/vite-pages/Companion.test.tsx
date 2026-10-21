import { jest } from '@jest/globals'
import { render, screen } from '@testing-library/react'

const mockPostJSON = jest.fn()

jest.unstable_mockModule('../api/client', () => ({
  postJSON: mockPostJSON,
  getPersonId: () => 'care-record-1',
}))

const { default: Companion } = await import('./Companion')

describe('Companion availability gate', () => {
  beforeEach(() => {
    mockPostJSON.mockReset()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: jest.fn(),
    })
  })

  it('does not accept or send care details while the backend endpoint is missing', () => {
    render(<Companion />)

    expect(screen.getByRole('status')).toHaveTextContent(
      'Do not enter sensitive care details here.',
    )
    expect(screen.getByPlaceholderText(/Companion unavailable/)).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
    expect(mockPostJSON).not.toHaveBeenCalled()
  })
})
