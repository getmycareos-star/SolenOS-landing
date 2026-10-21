import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CareCircle from './CareCircle'
import { getJSON, postJSON } from '../api/client'

jest.mock('../api/client', () => ({
  getPersonId: () => 'person-1',
  getJSON: jest.fn().mockResolvedValue([
    {
      id: 'caregiver-1',
      person_id: 'person-1',
      name: 'Alex Caregiver',
      email: 'alex@example.com',
      relationship: 'family caregiver',
      timezone: 'UTC',
    },
  ]),
  postJSON: jest.fn(),
}))

const caregiver = {
  id: 'caregiver-2',
  person_id: 'person-1',
  name: 'Sam Caregiver',
  email: 'sam@example.com',
  relationship: 'sibling',
  timezone: 'Africa/Lagos',
}

describe('CareCircle', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getJSON as jest.Mock).mockResolvedValue([{
      id: 'caregiver-1',
      person_id: 'person-1',
      name: 'Alex Caregiver',
      email: 'alex@example.com',
      relationship: 'family caregiver',
      timezone: 'UTC',
    }])
    ;(postJSON as jest.Mock).mockImplementation(async (path: string) => {
      if (path === '/caregivers') return caregiver
      if (path === '/auth/caregiver-invitations') {
        return {
          invitation_token: 'secure-invitation-token',
          caregiver_id: caregiver.id,
          person_id: 'person-1',
          permissions: ['read', 'write'],
          expires_at: '2026-10-28T12:00:00Z',
        }
      }
      return {}
    })
  })

  it('creates a secure invitation for an existing caregiver', async () => {
    render(<CareCircle />)
    await userEvent.click(await screen.findByRole('button', { name: /create invitation/i }))

    await waitFor(() => {
      expect(postJSON).toHaveBeenCalledWith('/auth/caregiver-invitations', {
        person_id: 'person-1',
        caregiver_id: 'caregiver-1',
        permissions: ['read', 'write'],
      })
    })
    expect(await screen.findByText('secure-invitation-token')).toBeInTheDocument()
  })

  it('creates a caregiver profile and requests an invitation', async () => {
    render(<CareCircle />)
    await userEvent.click(await screen.findByRole('button', { name: /add caregiver/i }))
    await userEvent.type(screen.getByLabelText(/full name/i), 'Sam Caregiver')
    await userEvent.type(screen.getByLabelText(/email address/i), 'sam@example.com')
    await userEvent.clear(screen.getByLabelText(/relationship to the person/i))
    await userEvent.type(screen.getByLabelText(/relationship to the person/i), 'sibling')
    await userEvent.clear(screen.getByLabelText(/time zone/i))
    await userEvent.type(screen.getByLabelText(/time zone/i), 'Africa/Lagos')
    await userEvent.click(screen.getByRole('button', { name: /add caregiver and create invitation/i }))

    await waitFor(() => {
      expect(postJSON).toHaveBeenCalledWith('/caregivers', {
        name: 'Sam Caregiver',
        email: 'sam@example.com',
        relationship: 'sibling',
        person_id: 'person-1',
        timezone: 'Africa/Lagos',
      })
      expect(postJSON).toHaveBeenCalledWith('/auth/caregiver-invitations', {
        person_id: 'person-1',
        caregiver_id: 'caregiver-2',
        permissions: ['read', 'write'],
      })
    })
    expect(await screen.findByText('secure-invitation-token')).toBeInTheDocument()
  })
})
