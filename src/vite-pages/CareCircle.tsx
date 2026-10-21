import { useCallback, useEffect, useState } from 'react'
import { getJSON, getPersonId, subscribeToPersonId } from '../api/client'

interface Caregiver {
  id: string
  person_id: string
  name: string
  email: string
  relationship: string
  timezone: string
  created_at: string
}

export default function CareCircle() {
  const [personId, setPersonIdState] = useState(getPersonId())
  const [caregivers, setCaregivers] = useState<Caregiver[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => subscribeToPersonId(setPersonIdState), [])

  const loadCaregivers = useCallback(async () => {
    if (!personId) {
      setCaregivers([])
      setError('Select an authorized care record to view its caregiver network.')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const result = await getJSON(`/caregivers/person/${encodeURIComponent(personId)}`)
      if (!Array.isArray(result)) {
        throw new Error('The server returned an unexpected caregiver list.')
      }
      setCaregivers(result as Caregiver[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load caregivers.')
    } finally {
      setLoading(false)
    }
  }, [personId])

  useEffect(() => {
    void loadCaregivers()
  }, [loadCaregivers])

  return (
    <main style={{ padding: '24px 32px', maxWidth: '960px', margin: '0 auto' }}>
      <header style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '8px' }}>Caregiver network</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Caregivers recorded for the selected care recipient. Access is checked by SolenOS before the records are returned.
        </p>
      </header>

      {loading && (
        <p role="status" style={{ color: 'var(--text-secondary)' }}>Loading caregivers…</p>
      )}

      {error && (
        <section role="alert" style={{ padding: '16px', border: '1px solid var(--border)', borderRadius: '12px' }}>
          <p style={{ color: 'var(--error)', marginBottom: '12px' }}>{error}</p>
          {personId && (
            <button type="button" onClick={() => void loadCaregivers()} style={{
              padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border)',
              background: 'var(--surface)', color: 'var(--text-primary)', cursor: 'pointer',
            }}>
              Retry
            </button>
          )}
        </section>
      )}

      {!loading && !error && caregivers.length === 0 && (
        <p style={{ color: 'var(--text-secondary)' }}>
          No caregiver records have been added to this care recipient yet.
        </p>
      )}

      {!loading && !error && caregivers.length > 0 && (
        <section aria-label="Caregivers" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {caregivers.map((caregiver) => (
            <article key={caregiver.id} style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: '12px', padding: '16px 20px',
            }}>
              <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px' }}>{caregiver.name}</h2>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                {caregiver.relationship}
              </p>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{caregiver.email}</p>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                Time zone: {caregiver.timezone}
              </p>
            </article>
          ))}
        </section>
      )}
    </main>
  )
}
