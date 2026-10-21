import { useCallback, useEffect, useState } from 'react'
import { getJSON, postJSON, getPersonId } from '../api/client'

interface Caregiver {
  id: string
  person_id: string
  name: string
  email: string
  relationship: string
  timezone: string
  created_at?: string
}

interface CaregiverInvitation {
  invitation_token: string
  caregiver_id: string
  person_id: string
  permissions: string[]
  expires_at: string
}

export default function CareCircle() {
  const personId = getPersonId()
  const [caregivers, setCaregivers] = useState<Caregiver[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [invitation, setInvitation] = useState<(CaregiverInvitation & { caregiver_name: string }) | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [relationship, setRelationship] = useState('family caregiver')
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')

  const fetchCaregivers = useCallback(async () => {
    if (!personId) {
      setCaregivers([])
      setError('Sign in and select an authorized care record to manage its care circle.')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const result = await getJSON(`/caregivers/person/${encodeURIComponent(personId)}`)
      if (!Array.isArray(result)) throw new Error('The backend returned an invalid caregiver list.')
      setCaregivers(result as Caregiver[])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load caregivers.')
    } finally {
      setLoading(false)
    }
  }, [personId])

  useEffect(() => {
    void fetchCaregivers()
  }, [fetchCaregivers])

  const issueInvitation = async (caregiver: Caregiver) => {
    setSubmitting(true)
    setError(null)
    setNotice(null)
    setInvitation(null)
    try {
      const result = await postJSON('/auth/caregiver-invitations', {
        person_id: personId,
        caregiver_id: caregiver.id,
        permissions: ['read', 'write'],
      }) as CaregiverInvitation

      if (!result?.invitation_token) throw new Error('The backend did not return an invitation token.')
      setInvitation({ ...result, caregiver_name: caregiver.name })
      setNotice(`Invitation created for ${caregiver.name}. Share the token using a trusted channel.`)
    } catch (cause) {
      setError(cause instanceof Error
        ? cause.message
        : 'Could not create the caregiver invitation. You may need care-record owner permissions.')
    } finally {
      setSubmitting(false)
    }
  }

  const createCaregiver = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!personId) {
      setError('Sign in and select an authorized care record before adding a caregiver.')
      return
    }

    setSubmitting(true)
    setError(null)
    setNotice(null)
    try {
      const created = await postJSON('/caregivers', {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        relationship: relationship.trim(),
        person_id: personId,
        timezone,
      }) as Caregiver

      if (!created?.id) throw new Error('The backend did not return a caregiver ID.')
      setCaregivers(previous => [...previous, created])
      setName('')
      setEmail('')
      setRelationship('family caregiver')
      setShowForm(false)
      await issueInvitation(created)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not add the caregiver.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div style={{ padding: '24px' }} role="status">Loading care circle…</div>
  }

  return (
    <main style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 650, margin: '0 0 8px' }}>Care Circle</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>
            Manage caregiver identities and create secure invitations to this care record.
          </p>
        </div>
        <button type="button" onClick={() => { setShowForm(value => !value); setError(null) }} disabled={!personId || submitting}
          style={{ padding: '10px 16px', border: 0, borderRadius: '8px', background: 'var(--trust)', color: 'white', cursor: 'pointer' }}>
          {showForm ? 'Cancel' : 'Add caregiver'}
        </button>
      </header>

      {error && <p role="alert" style={{ color: 'var(--error)', marginBottom: '16px' }}>{error}</p>}
      {notice && <p role="status" style={{ color: 'var(--trust)', marginBottom: '16px' }}>{notice}</p>}

      {invitation && (
        <section aria-labelledby="care-circle-invitation" style={{ border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', marginBottom: '24px', background: 'var(--surface)' }}>
          <h2 id="care-circle-invitation" style={{ fontSize: '16px', marginTop: 0 }}>Invitation for {invitation.caregiver_name}</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            This token expires {new Date(invitation.expires_at).toLocaleString()}. Share it privately with the intended caregiver only.
          </p>
          <code style={{ display: 'block', overflowWrap: 'anywhere', padding: '12px', borderRadius: '8px', background: 'var(--bg)' }}>
            {invitation.invitation_token}
          </code>
          <button type="button" onClick={() => setInvitation(null)} style={{ marginTop: '12px' }}>Hide invitation token</button>
        </section>
      )}

      {showForm && (
        <form onSubmit={createCaregiver} style={{ display: 'grid', gap: '12px', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', marginBottom: '24px', background: 'var(--surface)' }}>
          <h2 style={{ fontSize: '16px', margin: 0 }}>Add caregiver</h2>
          <label style={{ display: 'grid', gap: '6px', fontSize: '13px' }}>
            Full name
            <input required maxLength={200} value={name} onChange={event => setName(event.target.value)} autoComplete="name" />
          </label>
          <label style={{ display: 'grid', gap: '6px', fontSize: '13px' }}>
            Email address
            <input required type="email" maxLength={254} value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" />
          </label>
          <label style={{ display: 'grid', gap: '6px', fontSize: '13px' }}>
            Relationship to the person receiving care
            <input required maxLength={120} value={relationship} onChange={event => setRelationship(event.target.value)} />
          </label>
          <label style={{ display: 'grid', gap: '6px', fontSize: '13px' }}>
            Time zone
            <input required maxLength={100} value={timezone} onChange={event => setTimezone(event.target.value)} />
          </label>
          <button type="submit" disabled={submitting || !name.trim() || !email.trim() || !relationship.trim()}>
            {submitting ? 'Saving…' : 'Add caregiver and create invitation'}
          </button>
        </form>
      )}

      <section aria-labelledby="care-circle-caregivers">
        <h2 id="care-circle-caregivers" style={{ fontSize: '18px', marginBottom: '12px' }}>Caregivers ({caregivers.length})</h2>
        {caregivers.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>No caregivers are linked to this care record yet.</p>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {caregivers.map(caregiver => (
              <article key={caregiver.id} style={{ border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', background: 'var(--surface)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', margin: '0 0 4px' }}>{caregiver.name}</h3>
                    <p style={{ fontSize: '13px', margin: '0 0 4px', color: 'var(--text-secondary)' }}>{caregiver.email}</p>
                    <p style={{ fontSize: '13px', margin: 0 }}>{caregiver.relationship}</p>
                  </div>
                  <button type="button" disabled={submitting || !personId} onClick={() => void issueInvitation(caregiver)}>
                    Create invitation
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
