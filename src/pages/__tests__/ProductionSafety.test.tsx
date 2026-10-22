import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import { MemoryRouter } from 'react-router-dom'
import Community from '../Community'
import TeamDashboard from '../TeamDashboard'
import Login from '../Login'
import ProfessionalDashboard from '../ProfessionalDashboard'
import InvestorDashboard from '../InvestorDashboard'
import CareCircle from '../CareCircle'
import CareCapture from '../../components/CareCapture'
import { getJSON, getCaregiverId, getPersonId, postJSON } from '../../api/client'

jest.mock('../../api/client', () => ({
  getJSON: jest.fn(),
  postJSON: jest.fn(),
  getPersonId: jest.fn(),
  getCaregiverId: jest.fn(),
}))

const mockedGetJSON = jest.mocked(getJSON)
const mockedPostJSON = jest.mocked(postJSON)
const mockedGetPersonId = jest.mocked(getPersonId)
const mockedGetCaregiverId = jest.mocked(getCaregiverId)

describe('Phase 4 production data safety', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedGetPersonId.mockReturnValue('person-real-1')
    mockedGetCaregiverId.mockReturnValue('caregiver-real-1')
  })

  afterEach(() => cleanup())

  it('does not display invented community posts when the API fails', async () => {
    mockedGetJSON.mockRejectedValue(new Error('service unavailable'))

    render(
      <MemoryRouter>
        <Community />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('alert')).toHaveTextContent('Community posts could not be loaded')
    expect(screen.queryByText(/M\. Johnson|sample caregiver|sample post|DEMO_RISK/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/sample posts/i)).not.toBeInTheDocument()
  })

  it('never renders caregiver monitoring, moderation, or metrics from demo defaults', () => {
    render(<TeamDashboard />)

    expect(screen.getByRole('heading', { name: /team dashboard unavailable/i })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(/cannot be verified as an authorized/i)
    expect(screen.queryByText(/M\. Johnson|142 caregivers|4\.2 helpfulness|DEMO_RISK|DEMO_REPORT/i)).not.toBeInTheDocument()
  })

  it('preserves care-capture text when the save request fails', async () => {
    mockedPostJSON.mockRejectedValueOnce(new Error('service unavailable'))

    render(<CareCapture personId="person-real-1" />)

    const note = 'Observed a change in sleep; exact start time is uncertain.'
    const input = screen.getByPlaceholderText(/describe what you observed/i)
    fireEvent.change(input, { target: { value: note } })
    fireEvent.click(screen.getByRole('button', { name: /save what changed/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/save could not be confirmed/i)
    expect(input).toHaveValue(note)
    expect(screen.queryByText('Care update saved.')).not.toBeInTheDocument()
  })

  it('does not pretend role selection is authentication', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: /secure sign-in is not available yet/i })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(/would not authenticate you/i)
    expect(screen.queryByRole('button', { name: /enter solenos as/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/three login paths/i)).not.toBeInTheDocument()
  })

  it('keeps professional multi-patient data hidden without verified authorization', () => {
    render(<ProfessionalDashboard />)

    expect(screen.getByRole('heading', { name: /professional dashboard unavailable/i })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(/cannot verify a professional identity/i)
    expect(mockedGetJSON).not.toHaveBeenCalled()
  })

  it('keeps investor metrics hidden without an authorized investor session', () => {
    render(
      <MemoryRouter>
        <InvestorDashboard />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: /investor metrics unavailable/i })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(/cannot verify an investor session/i)
    expect(mockedGetJSON).not.toHaveBeenCalled()
  })

  it('does not offer fake care-circle membership or invitation actions', () => {
    render(<CareCircle />)

    expect(screen.getByRole('heading', { name: /care circle unavailable/i })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(/required backend routes and authorization checks/i)
    expect(screen.queryByRole('button', { name: /add member to circle/i })).not.toBeInTheDocument()
    expect(mockedGetJSON).not.toHaveBeenCalled()
  })

  it('does not report a valid empty record when the record API fails', async () => {
    mockedGetJSON.mockRejectedValue(new Error('service unavailable'))

    const Record = (await import('../Record')).default
    render(
      <MemoryRouter>
        <Record />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not be loaded/i)
    expect(screen.queryByText(/no evidence recorded yet/i)).not.toBeInTheDocument()
  })
})
