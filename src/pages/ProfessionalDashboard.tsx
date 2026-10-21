import { useCallback, useEffect, useState } from 'react'
import { getJSON, getCaregiverId } from '../api/client'

interface ProfessionalRecord {
  person: { id: string; name: string }
  access_grant_id: string
  care_events_count: number
  appointments_count: number
  active_insights_count: number
  last_events: { id: string; title: string; description?: string | null; occurred_at?: string | null }[]
}

export default function ProfessionalDashboard() {
  const caregiverId = getCaregiverId() || ''
  const [records, setRecords] = useState<ProfessionalRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!caregiverId) {
      setRecords([]); setError('The authenticated professional account has no caregiver identity. Contact the SolenOS administrator.')
      setLoading(false); return
    }
    setLoading(true); setError(null)
    try {
      const response = await getJSON<{ care_recipients: ProfessionalRecord[]; count: number }>(
        '/professional/dashboard?professional_caregiver_id=' + encodeURIComponent(caregiverId),
      )
      if (!response || !Array.isArray(response.care_recipients)) throw new Error('The backend returned an invalid professional dashboard response.')
      setRecords(response.care_recipients)
    } catch (e) {
      setRecords([])
      setError(e instanceof Error ? e.message : 'Professional care recipients could not be retrieved.')
    } finally { setLoading(false) }
  }, [caregiverId])

  useEffect(() => { void load() }, [load])

  return (
    <main style={{ maxWidth: 1000, margin: '0 auto', padding: '28px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div><h1 style={{ fontSize: 24, fontWeight: 650 }}>Professional Care Dashboard</h1><p style={{ marginTop: 6, color: 'var(--text-secondary)', fontSize: 13 }}>Only care recipients with an active, recorded access grant are listed. This view does not establish professional licensure.</p></div>
        <button onClick={() => void load()} disabled={loading} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)' }}>{loading ? 'Refreshing…' : 'Refresh'}</button>
      </div>
      {error && <p role="alert" style={{ marginTop: 16, color: 'var(--error)', fontSize: 13 }}>{error}</p>}
      {loading && <p role="status" style={{ marginTop: 16, color: 'var(--text-secondary)' }}>Loading authorized care recipients…</p>}
      {!loading && !error && records.length === 0 && <section style={{ marginTop: 20, padding: 18, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)' }}><h2 style={{ fontSize: 16, fontWeight: 600 }}>No active care-record grants</h2><p style={{ marginTop: 8, color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6 }}>A caregiver must grant this professional account access to a care recipient. Records are not discoverable by professional accounts without an active grant.</p></section>}
      {!loading && records.map(record => <section key={record.person.id} style={{ marginTop: 18, padding: 18, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div><h2 style={{ fontSize: 18, fontWeight: 650 }}>{record.person.name}</h2><p style={{ marginTop: 4, fontSize: 11, color: 'var(--text-secondary)' }}>Care record ID: {record.person.id} · Grant: {record.access_grant_id}</p></div>
          <button onClick={() => void navigator.clipboard?.writeText(record.person.id)} style={{ padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface)', fontSize: 12 }}>Copy record ID</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginTop: 16 }}>
          {[['Care events', record.care_events_count], ['Appointments', record.appointments_count], ['Active insights', record.active_insights_count]].map(([label, value]) => <div key={String(label)} style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 8 }}><div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</div><div style={{ fontSize: 22, fontWeight: 650, marginTop: 5 }}>{value}</div></div>)}
        </div>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginTop: 18 }}>Recent recorded events</h3>
        {record.last_events.length ? <ul style={{ paddingLeft: 20, marginTop: 8 }}>{record.last_events.map(event => <li key={event.id} style={{ marginBottom: 10 }}><strong>{event.title}</strong><p style={{ marginTop: 3, fontSize: 13, color: 'var(--text-secondary)' }}>{event.description || 'No additional detail recorded.'}</p><p style={{ marginTop: 3, fontSize: 11, color: 'var(--text-secondary)' }}>{event.occurred_at ? new Date(event.occurred_at).toLocaleString() : 'Time not recorded'}</p></li>)}</ul> : <p style={{ marginTop: 8, fontSize: 13, color: 'var(--text-secondary)' }}>No care events have been recorded.</p>}
      </section>)}
    </main>
  )
}
