import { FormEvent, useEffect, useState } from 'react'
import { getJSON, postJSON, getPersonId } from '../api/client'

interface CareCircle {
  id: string
  person_id: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string | null
}

interface CareCircleMembership {
  id: string
  care_circle_id: string
  person_id: string
  member_caregiver_id: string
  role: string
  role_description: string | null
  access_level: string
  can_view_information: boolean
  can_contribute_information: boolean
  can_receive_notifications: boolean
  can_participate_in_decisions: boolean
  relationship_to_person: string | null
  invitation_status: string
  joined_at: string
  left_at: string | null
  is_active: boolean
  created_at: string
  updated_at: string | null
}

interface LinkedCaregiver {
  id: string
  name: string
  relationship: string
  email?: string | null
}

const ACCESS_LEVELS = [
  { value: 'viewer', label: 'Viewer', description: 'Can view approved care information.' },
  { value: 'contributor', label: 'Contributor', description: 'Can view and contribute care information.' },
  { value: 'coordinator', label: 'Coordinator', description: 'Can view, contribute, and participate in care decisions.' },
]

const ROLES = [
  'family_member',
  'primary_caregiver',
  'appointment_coordinator',
  'medication_manager',
  'overnight_caregiver',
  'emergency_contact',
  'other',
]

export default function CareCircle() {
  const [careCircles, setCareCircles] = useState<CareCircle[]>([])
  const [selectedCircle, setSelectedCircle] = useState<CareCircle | null>(null)
  const [circleMembers, setCircleMembers] = useState<CareCircleMembership[]>([])
  const [linkedCaregivers, setLinkedCaregivers] = useState<LinkedCaregiver[]>([])
  const [loading, setLoading] = useState(true)
  const [savingCircle, setSavingCircle] = useState(false)
  const [savingMember, setSavingMember] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [circleName, setCircleName] = useState('')
  const [circleDescription, setCircleDescription] = useState('')
  const [memberCaregiverId, setMemberCaregiverId] = useState('')
  const [memberRole, setMemberRole] = useState('family_member')
  const [memberAccessLevel, setMemberAccessLevel] = useState('contributor')
  const [memberRelationship, setMemberRelationship] = useState('')
  const personId = getPersonId()

  useEffect(() => {
    void loadInitialData()
  }, [personId])

  async function loadInitialData() {
    if (!personId) {
      setCareCircles([])
      setLinkedCaregivers([])
      setError('No authorized care record is selected. Select a care record before managing a care circle.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [circles, caregivers] = await Promise.all([
        getJSON(`/care-circle/person/${encodeURIComponent(personId)}`),
        getJSON(`/caregivers/${encodeURIComponent(personId)}`),
      ])
      if (!Array.isArray(circles) || !Array.isArray(caregivers)) {
        throw new Error('The care circle or caregiver response was incomplete.')
      }
      setCareCircles(circles as CareCircle[])
      setLinkedCaregivers(caregivers as LinkedCaregiver[])
    } catch (err) {
      console.error('Failed to load care circle data:', err)
      setError(err instanceof Error ? err.message : 'Care circle data could not be loaded.')
    } finally {
      setLoading(false)
    }
  }

  async function createCareCircle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!personId || !circleName.trim()) {
      setError('A care record and a circle name are required.')
      return
    }
    setSavingCircle(true)
    setError(null)
    setSuccess(null)
    try {
      const circle = await postJSON('/care-circle/', {
        person_id: personId,
        name: circleName.trim(),
        description: circleDescription.trim() || null,
      }) as CareCircle
      setCareCircles(previous => [circle, ...previous])
      setSelectedCircle(circle)
      setCircleMembers([])
      setCircleName('')
      setCircleDescription('')
      setSuccess('Care circle created. You are its owner.')
      await loadMembers(circle.id)
    } catch (err) {
      console.error('Failed to create care circle:', err)
      setError(err instanceof Error ? err.message : 'Care circle could not be created.')
    } finally {
      setSavingCircle(false)
    }
  }

  async function loadMembers(circleId: string) {
    setError(null)
    try {
      const data = await getJSON(`/care-circle/${encodeURIComponent(circleId)}/members`)
      if (!Array.isArray(data)) throw new Error('The member response was incomplete.')
      setCircleMembers(data as CareCircleMembership[])
    } catch (err) {
      console.error('Failed to load care circle members:', err)
      setError(err instanceof Error ? err.message : 'Care circle members could not be loaded.')
      setCircleMembers([])
    }
  }

  async function selectCircle(circle: CareCircle) {
    setSelectedCircle(circle)
    setCircleMembers([])
    setSuccess(null)
    setMemberCaregiverId('')
    await loadMembers(circle.id)
  }

  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedCircle || !memberCaregiverId) {
      setError('Choose a caregiver already linked to this care record.')
      return
    }
    setSavingMember(true)
    setError(null)
    setSuccess(null)
    try {
      const member = await postJSON(`/care-circle/${encodeURIComponent(selectedCircle.id)}/members`, {
        member_caregiver_id: memberCaregiverId,
        role: memberRole,
        access_level: memberAccessLevel,
        relationship_to_person: memberRelationship.trim() || null,
      }) as CareCircleMembership
      setCircleMembers(previous => [...previous.filter(item => item.id !== member.id), member])
      setMemberCaregiverId('')
      setMemberRelationship('')
      setSuccess('Caregiver added with the selected access level.')
    } catch (err) {
      console.error('Failed to add care circle member:', err)
      setError(err instanceof Error ? err.message : 'The caregiver could not be added.')
    } finally {
      setSavingMember(false)
    }
  }

  if (loading) {
    return <div style={{ padding: '24px 32px', color: 'var(--text-secondary)' }}>Loading care circles…</div>
  }

  const existingMemberIds = new Set(circleMembers.map(member => member.member_caregiver_id))
  const availableCaregivers = linkedCaregivers.filter(caregiver => !existingMemberIds.has(caregiver.id))
  const caregiverName = (id: string) => linkedCaregivers.find(caregiver => caregiver.id === id)?.name || 'Linked caregiver'

  return (
    <div style={{ padding: '24px 32px', maxWidth: '960px', margin: '0 auto' }}>
      <header style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '6px' }}>Family care coordination</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.5 }}>
          Organize the caregivers already linked to this care record, assign clear roles, and limit access by responsibility.
        </p>
      </header>

      {error && <p role="alert" style={{ color: 'var(--error)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>{error}</p>}
      {success && <p role="status" style={{ color: 'var(--trust)', background: 'var(--surface)', border: '1px solid var(--trust)', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>{success}</p>}

      <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px 20px', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '12px' }}>Create a care circle</h2>
        <form onSubmit={createCareCircle} style={{ display: 'grid', gap: '10px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600 }}>
            Circle name
            <input value={circleName} onChange={event => setCircleName(event.target.value)} required maxLength={120} placeholder="e.g. Mum's care team" style={{ display: 'block', width: '100%', marginTop: '5px', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }} />
          </label>
          <label style={{ fontSize: '12px', fontWeight: 600 }}>
            Purpose (optional)
            <textarea value={circleDescription} onChange={event => setCircleDescription(event.target.value)} maxLength={2000} rows={2} placeholder="What should this group coordinate?" style={{ display: 'block', width: '100%', marginTop: '5px', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', resize: 'vertical' }} />
          </label>
          <div>
            <button type="submit" disabled={savingCircle || !circleName.trim()} style={{ padding: '10px 16px', borderRadius: '8px', border: 'none', background: 'var(--trust)', color: 'white', fontSize: '13px', fontWeight: 600, cursor: savingCircle ? 'default' : 'pointer', opacity: savingCircle ? 0.7 : 1 }}>
              {savingCircle ? 'Creating…' : 'Create care circle'}
            </button>
          </div>
        </form>
      </section>

      <section style={{ marginBottom: '28px' }}>
        <h2 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '12px' }}>Your care circles</h2>
        {careCircles.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px' }}>
            No care circles have been created for this record yet.
          </p>
        ) : (
          <div style={{ display: 'grid', gap: '10px' }}>
            {careCircles.map(circle => (
              <article key={circle.id} style={{ background: 'var(--surface)', border: selectedCircle?.id === circle.id ? '1px solid var(--trust)' : '1px solid var(--border)', borderRadius: '10px', padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: 600 }}>{circle.name}</h3>
                    {circle.description && <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>{circle.description}</p>}
                    <p style={{ color: 'var(--text-secondary)', fontSize: '11px', marginTop: '6px' }}>Created {new Date(circle.created_at).toLocaleString()}</p>
                  </div>
                  <button type="button" onClick={() => void selectCircle(circle)} style={{ padding: '8px 12px', borderRadius: '7px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '12px', cursor: 'pointer' }}>
                    {selectedCircle?.id === circle.id ? 'Refresh members' : 'Manage members'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {selectedCircle && (
        <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px 20px' }}>
          <h2 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '4px' }}>{selectedCircle.name}: members</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '16px' }}>
            Permissions are enforced by the care-circle API for membership management. This workflow adds existing linked caregivers only.
          </p>

          {circleMembers.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px' }}>No active members were returned for this circle.</p>
          ) : (
            <div style={{ display: 'grid', gap: '10px', marginBottom: '20px' }}>
              {circleMembers.map(member => (
                <div key={member.id} style={{ border: '1px solid var(--border)', borderRadius: '9px', padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                    <div>
                      <strong style={{ fontSize: '14px' }}>{caregiverName(member.member_caregiver_id)}</strong>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '4px' }}>{member.role.replace(/_/g, ' ')} · {member.access_level}</p>
                      {member.relationship_to_person && <p style={{ color: 'var(--text-secondary)', fontSize: '11px', marginTop: '3px' }}>Relationship: {member.relationship_to_person}</p>}
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                      {member.can_view_information && <span style={{ fontSize: '10px', padding: '3px 6px', borderRadius: '4px', background: 'var(--bg)' }}>View</span>}
                      {member.can_contribute_information && <span style={{ fontSize: '10px', padding: '3px 6px', borderRadius: '4px', background: 'var(--bg)' }}>Contribute</span>}
                      {member.can_receive_notifications && <span style={{ fontSize: '10px', padding: '3px 6px', borderRadius: '4px', background: 'var(--bg)' }}>Notifications</span>}
                      {member.can_participate_in_decisions && <span style={{ fontSize: '10px', padding: '3px 6px', borderRadius: '4px', background: 'var(--bg)' }}>Decisions</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={addMember} style={{ display: 'grid', gap: '10px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600 }}>Add a linked caregiver</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
              Email invitations and external account acceptance are not implemented yet. No outside person can be granted access by entering an email here.
            </p>
            <label style={{ fontSize: '12px', fontWeight: 600 }}>
              Caregiver
              <select value={memberCaregiverId} onChange={event => setMemberCaregiverId(event.target.value)} required style={{ display: 'block', width: '100%', marginTop: '5px', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}>
                <option value="">Select an existing linked caregiver</option>
                {availableCaregivers.map(caregiver => <option key={caregiver.id} value={caregiver.id}>{caregiver.name} · {caregiver.relationship}</option>)}
              </select>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600 }}>
                Responsibility
                <select value={memberRole} onChange={event => setMemberRole(event.target.value)} style={{ display: 'block', width: '100%', marginTop: '5px', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}>
                  {ROLES.map(role => <option key={role} value={role}>{role.replace(/_/g, ' ')}</option>)}
                </select>
              </label>
              <label style={{ fontSize: '12px', fontWeight: 600 }}>
                Access level
                <select value={memberAccessLevel} onChange={event => setMemberAccessLevel(event.target.value)} style={{ display: 'block', width: '100%', marginTop: '5px', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}>
                  {ACCESS_LEVELS.map(level => <option key={level.value} value={level.value}>{level.label}</option>)}
                </select>
              </label>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>{ACCESS_LEVELS.find(level => level.value === memberAccessLevel)?.description}</p>
            <label style={{ fontSize: '12px', fontWeight: 600 }}>
              Relationship to care recipient (optional)
              <input value={memberRelationship} onChange={event => setMemberRelationship(event.target.value)} maxLength={100} placeholder="e.g. daughter, sibling, neighbor" style={{ display: 'block', width: '100%', marginTop: '5px', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }} />
            </label>
            <div>
              <button type="submit" disabled={savingMember || !memberCaregiverId} style={{ padding: '10px 16px', borderRadius: '8px', border: 'none', background: 'var(--trust)', color: 'white', fontSize: '13px', fontWeight: 600, cursor: savingMember ? 'default' : 'pointer', opacity: savingMember ? 0.7 : 1 }}>
                {savingMember ? 'Adding…' : 'Add caregiver to circle'}
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  )
}
