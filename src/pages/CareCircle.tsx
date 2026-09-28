import { useEffect, useState } from 'react'
import { getJSON, getPersonId } from '../api/client'

interface Caregiver {
  id: string
  name: string
  relationship: string
}

interface DailyEntry {
  id: string
  event_type: string
  title: string
  description?: string
  occurred_at: string
  tags: string[]
}

export default function CareCircle() {
  const [caregivers, setCaregivers] = useState<Caregiver[]>([])
  const [entries, setEntries] = useState<DailyEntry[]>([])
  const [loadingCaregivers, setLoadingCaregivers] = useState(true)
  const [loadingEntries, setLoadingEntries] = useState(true)
  const personId = getPersonId()

  useEffect(() => {
    async function loadCaregivers() {
      try {
        const data = await getJSON(`/caregivers/${personId}`)
        setCaregivers(data as Caregiver[])
      } catch (e) {
        console.error(e)
        setCaregivers([
          { id: 'demo-caregiver', name: 'Demo Caregiver', relationship: 'Family' }
        ])
      } finally {
        setLoadingCaregivers(false)
      }
    }
    loadCaregivers()
  }, [personId])

  useEffect(() => {
    async function loadEntries() {
      try {
        const data = await getJSON(`/daily-care/${personId}`)
        setEntries(data as DailyEntry[])
      } catch (e) {
        console.error(e)
      } finally {
        setLoadingEntries(false)
      }
    }
    loadEntries()
  }, [personId])

  return (
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '4px' }}>Care Circle</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
        Multi-caregiver sharing and wellbeing checks.
      </p>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 500, marginBottom: '12px' }}>Caregivers</h2>
        {loadingCaregivers ? (
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Loading...</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {caregivers.map(c => (
              <div key={c.id} style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: '12px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div>
                  <span style={{ fontSize: '14px', fontWeight: 500 }}>{c.name}</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginLeft: '8px' }}>{c.relationship}</span>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{c.id.slice(0, 8)}</span>
              </div>
            ))}
          </div>
        )}
        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '12px', fontStyle: 'italic' }}>
          Caregiver sharing is local to this installation. To share across installations, use the "Export summary" feature from the Export page.
        </p>
      </section>

      <section>
        <h2 style={{ fontSize: '16px', fontWeight: 500, marginBottom: '12px' }}>Caregiver wellbeing</h2>
        {loadingEntries ? (
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Loading...</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {entries.filter(e => e.tags?.includes('wellbeing')).map(entry => (
              <div key={entry.id} style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: '12px', padding: '16px 20px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 500 }}>
                    {entry.tags?.find(t => t.startsWith('stress_'))
                      ? `Stress level ${entry.tags.find(t => t.startsWith('stress_'))!.split('_')[2]}/5`
                      : 'Wellbeing check'}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {new Date(entry.occurred_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                {entry.description && (
                  <p style={{ fontSize: '13px', color: 'var(--text)' }}>{entry.description}</p>
                )}
              </div>
            ))}
            {entries.filter(e => e.tags?.includes('wellbeing')).length === 0 && (
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>No wellbeing checks recorded yet. Add one from the Daily Care page.</p>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
