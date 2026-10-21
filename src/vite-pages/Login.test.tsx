import { jest } from '@jest/globals'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'

const mockGetJSON = jest.fn()
const mockPostJSON = jest.fn()
const mockSetAccessToken = jest.fn()
const mockClearAccessToken = jest.fn()
const mockSetPersonId = jest.fn()
const mockSetCaregiverId = jest.fn()

jest.unstable_mockModule('../api/client', () => ({
  getJSON: mockGetJSON,
  postJSON: mockPostJSON,
  setAccessToken: mockSetAccessToken,
  clearAccessToken: mockClearAccessToken,
  setPersonId: mockSetPersonId,
  setCaregiverId: mockSetCaregiverId,
}))

const { default: Login } = await import('./Login')

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}</div>
}

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  )
}

function configureSignedInAccountWithoutContexts() {
  mockPostJSON.mockImplementation(async (path: string, body: unknown) => {
    if (path === '/auth/login') {
      return {
        access_token: 'test-session-token',
        token_type: 'bearer',
        expires_at: '2099-01-01T00:00:00+00:00',
        account: { id: 'account-1', email: 'owner@example.com', display_name: 'Caregiver' },
      }
    }
    if (path === '/auth/care-contexts' && body && typeof body === 'object' && 'name' in body) {
      return { person_id: 'person-1', name: 'Mum', role: 'owner', permissions: ['read', 'write', 'admin'] }
    }
    if (path === '/auth/caregiver-invitations/accept') {
      return { person_id: 'person-2', caregiver_id: 'caregiver-2', account_id: 'account-1', permissions: ['read', 'write'] }
    }
    throw new Error(`Unexpected POST ${path}`)
  })
  mockGetJSON.mockImplementation(async (path: string) => {
    if (path === '/auth/care-contexts') return []
    if (path === '/auth/my-caregiver-links?person_id=person-1') {
      return [{ person_id: 'person-1', caregiver_id: 'caregiver-1', account_id: 'account-1', permissions: ['read', 'write', 'admin'] }]
    }
    throw new Error(`Unexpected GET ${path}`)
  })
}

describe('authenticated caregiver entry flow', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    configureSignedInAccountWithoutContexts()
  })

  it('creates a care context and selects the caregiver link created by the backend', async () => {
    renderLogin()
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'owner@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'long-enough-password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in securely' }))

    expect(await screen.findByRole('heading', { name: 'Create a care record' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText("Care recipient's name"), { target: { value: 'Mum' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create care record' }))

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/'))
    expect(mockSetAccessToken).toHaveBeenCalledWith('test-session-token')
    expect(mockSetPersonId).toHaveBeenCalledWith('person-1')
    expect(mockSetCaregiverId).toHaveBeenCalledWith('caregiver-1')
    expect(mockPostJSON).toHaveBeenCalledWith('/auth/care-contexts', { name: 'Mum' })
  })

  it('lets an authenticated caregiver accept a single-use invitation without creating a demo record', async () => {
    renderLogin()
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'invitee@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'long-enough-password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in securely' }))

    expect(await screen.findByRole('heading', { name: 'Create a care record' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'I have a caregiver invitation' }))
    fireEvent.change(screen.getByLabelText('Invitation token'), { target: { value: 'single-use-token' } })
    fireEvent.click(screen.getByRole('button', { name: 'Accept invitation' }))

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/'))
    expect(mockPostJSON).toHaveBeenCalledWith('/auth/caregiver-invitations/accept', { token: 'single-use-token' })
    expect(mockSetPersonId).toHaveBeenCalledWith('person-2')
    expect(mockSetCaregiverId).toHaveBeenCalledWith('caregiver-2')
  })
})
