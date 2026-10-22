import { getCaregiverId, getPersonId, setPersonId } from '../client'

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
})
