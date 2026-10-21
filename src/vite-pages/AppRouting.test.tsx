import { beforeEach, describe, expect, it } from '@jest/globals'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'

describe('public entry and workspace routing', () => {
  beforeEach(() => {
    cleanup()
    window.sessionStorage.clear()
    window.localStorage.clear()
  })

  it('keeps the public landing page at the root URL', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    )

    expect(
      screen.getByRole('heading', {
        name: /when you’re caring for someone, you shouldn’t have to remember everything/i,
      }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Enter SolenOS' })[0]).toHaveAttribute(
      'href',
      '/workspace?enter=1',
    )
  })

  it('sends an unauthenticated workspace entry to sign-in instead of a blank route', () => {
    render(
      <MemoryRouter initialEntries={['/workspace?enter=1']}>
        <App />
      </MemoryRouter>,
    )

    expect(screen.getByRole('button', { name: 'Sign in securely' })).toBeInTheDocument()
  })
})
