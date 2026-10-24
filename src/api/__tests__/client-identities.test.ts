import { clearAuthSession, getAccessToken, getCaregiverId, getPersonId, setPersonId } from '../client'

describe('care-record identity storage integrity', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('clears legacy placeholder values instead of returning them as identities', () => {
    localStorage.setItem('solenos_person_id', ['demo', 'person', 'id'].join('-'))
    expect(getPersonId()).toBe('')
    expect(localStorage.getItem('solenos_person_id')).toBeNull()

    localStorage.setItem('solenos_caregiver_id', ['demo', 'caregiver'].join('-'))
    expect(getCaregiverId()).toBeNull()
    expect(localStorage.getItem('solenos_caregiver_id')).toBeNull()

    localStorage.setItem('solenos_caregiver_id', ['current', 'user', 'id'].join('-'))
    expect(getCaregiverId()).toBeNull()
    expect(localStorage.getItem('solenos_caregiver_id')).toBeNull()
  })

  it('refuses to persist a placeholder ID passed by a caller', () => {
    setPersonId(['demo', 'person', 'id'].join('-'))
    expect(getPersonId()).toBe('')
    expect(localStorage.getItem('solenos_person_id')).toBeNull()
  })

  it('preserves a non-placeholder selected care-record ID', () => {
    setPersonId('person-real-123')
    expect(getPersonId()).toBe('person-real-123')
    expect(localStorage.getItem('solenos_person_id')).toBe('person-real-123')
  })

  it('clears the previous account identity on logout or failed account resolution', () => {
    localStorage.setItem('solenos_access_token', 'old-token')
    localStorage.setItem('solenos_caregiver_id', 'old-caregiver')
    localStorage.setItem('solenos_person_id', 'old-person')
    localStorage.setItem('solenos_identifier', 'old@example.invalid')
    localStorage.setItem('solenos_user_role', 'caregiver')

    clearAuthSession()

    expect(getAccessToken()).toBe('')
    expect(getCaregiverId()).toBeNull()
    expect(getPersonId()).toBe('')
    expect(localStorage.getItem('solenos_identifier')).toBeNull()
    expect(localStorage.getItem('solenos_user_role')).toBeNull()
  })
})
