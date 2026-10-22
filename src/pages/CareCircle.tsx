import { useEffect, useState } from 'react'
import { getJSON, postJSON, patchJSON, getPersonId } from '../api/client'

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
  member_person_id: string | null
  member_account_id: string | null
  role: string
  role_description: string | null
  access_level: string
  can_view_information: boolean
  can_contribute_information: boolean
  can_receive_notifications: boolean
  can_participate_in_decisions: boolean
  relationship_to_person: string | null
  contact_information: any
  invitation_status: string
  joined_at: string
  left_at: string | null
  is_active: boolean
  created_at: string
  updated_at: string | null
}

interface CreateCareCircleData {
  name: string
  description: string | null
}

interface AddMemberToCircleData {
  member_person_id: string | null
  member_account_id: string | null
  role: string
  role_description: string | null
  access_level: string
  relationship_to_person: string | null
  contact_information: any
}

export default function CareCircle() {
  const [careCircles, setCareCircles] = useState<CareCircle[]>([])
  const [selectedCircle, setSelectedCircle] = useState<CareCircle | null>(null)
  const [circleMembers, setCircleMembers] = useState<CareCircleMembership[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const personId = getPersonId()

  useEffect(() => {
    fetchCareCircles()
  }, [personId])

  const fetchCareCircles = async () => {
    if (!personId) {
      setCareCircles([])
      setError('No care record is selected. Select an authorized care record to view care circles.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await getJSON(`/care-circle/person/${encodeURIComponent(personId)}`)
      setCareCircles(data as CareCircle[])
    } catch (err: any) {
      console.error('Failed to fetch care circles:', err)
      setError(err.message || 'Failed to load care circles')
    } finally {
      setLoading(false)
    }
  }

  const createCareCircle = async (data: CreateCareCircleData) => {
    setLoading(true)
    setError(null)
    try {
      const newCircle = await postJSON(`/care-circle/`, data)
      setCareCircles(prev => [...prev, newCircle as CareCircle])
    } catch (err: any) {
      console.error('Failed to create care circle:', err)
      setError(err.message || 'Failed to create care circle')
    } finally {
      setLoading(false)
    }
  }

  const addMemberToCircle = async (circleId: string, data: AddMemberToCircleData) => {
    setLoading(true)
    setError(null)
    try {
      const membership = await postJSON(`/care-circle/${circleId}/members`, data)
      setCircleMembers(prev => [...prev, membership as CareCircleMembership])
    } catch (err: any) {
      console.error('Failed to add member to circle:', err)
      setError(err.message || 'Failed to add member to circle')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '24px 32px', textAlign: 'center' }}>
        <div style={{ fontSize: '20px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          Loading care circles...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '24px 32px', textAlign: 'center' }}>
        <div style={{ fontSize: '20px', color: 'var(--error)', marginBottom: '16px' }}>
          {error}
        </div>
        <button
          onClick={fetchCareCircles}
          style={{
            padding: '8px 16px', borderRadius: '8px', border: 'none',
            background: 'var(--trust)', color: 'white', fontSize: '13px',
            cursor: 'pointer'
          }}
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div style={{ padding: '24px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '4px' }}>Care Circle Management</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
          Manage family and support networks around the person receiving care.
        </p>
        <button
          onClick={() => {
            // In a real implementation, this would open a modal to create a new care circle
            alert('Create care circle functionality would be implemented here')
          }}
          style={{
            padding: '8px 16px', borderRadius: '8px', border: 'none',
            background: 'var(--trust)', color: 'white', fontSize: '13px',
            cursor: 'pointer'
          }}
        >
          New Care Circle
        </button>
      </div>
      
      {/* Care Circles List */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 500, marginBottom: '12px' }}>Your Care Circles</h2>
        {careCircles.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', textAlign: 'center' }}>
            No care circles created yet. Click "New Care Circle" to get started.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {careCircles.map(circle => (
              <div key={circle.id} style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: '12px', padding: '16px 20px',
                cursor: 'pointer'
              }}
              onClick={() => {
                setSelectedCircle(circle)
                // In a real implementation, this would also fetch the circle members
                alert(`Fetching members for circle: ${circle.name}`)
              }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: 600 }}>{circle.name}</div>
                    {circle.description && (
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        {circle.description}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    {circle.is_active ? 'Active' : 'Inactive'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      
      {/* Selected Circle Details */}
      {selectedCircle && (
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>
                {selectedCircle.name}
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px' }}>
                {selectedCircle.description || 'No description provided'}
              </p>
              <div style={{ display: 'flex', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Created:</div>
                  <div style={{ fontSize: '13px' }}>
                    {new Date(selectedCircle.created_at).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Status:</div>
                  <div style={{ fontSize: '13px', fontWeight: 500 }}>
                    {selectedCircle.is_active ? 'Active' : 'Inactive'}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedCircle(null)}
                style={{
                  background: 'none', border: 'none', color: 'var(--text-secondary)',
                  cursor: 'pointer', fontSize: '20px'
                }}
              >
                ✕
              </button>
            </div>
          </div>
          
          {/* Circle Members */}
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>Members ({circleMembers.length})</h3>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
              {circleMembers.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', textAlign: 'center' }}>
                  No members yet. Add members using the "Add Member" functionality.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {circleMembers.map((member, index) => (
                    <div key={index} style={{ 
                      background: 'var(--surface-soft)', borderRadius: '8px', padding: '12px 16px',
                      marginBottom: index < circleMembers.length - 1 ? 8 : 0
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 600 }}>
                            {member.member_person_id || member.member_account_id ? 
                              'Member' : 'Unknown'}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            {member.role.replace(/_/g, ' ')}
                          </div>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {member.can_view_information ? '👁️' : '🚫'} 
                          {member.can_contribute_information ? '📝' : '🚫'}
                          {member.can_receive_notifications ? '🔔' : '🚫'}
                          {member.can_participate_in_decisions ? '🗳️' : '🚫'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ marginTop: '16px', textAlign: 'right' }}>
              <button
                onClick={() => {
                  // In a real implementation, this would open a modal to add a member
                  alert('Add member functionality would be implemented here')
                }}
                style={{
                  padding: '8px 16px', borderRadius: '8px', border: 'none',
                  background: 'var(--trust)', color: 'white', fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Add Member to Circle
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}