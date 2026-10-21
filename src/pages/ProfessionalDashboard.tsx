import { useEffect, useState } from 'react'
import { getJSON, getPersonId } from '../api/client'

type RecordItem = Record<string, unknown>

function readableDate(value: unknown): string {
  if (typeof value !== 'string' || !value) return 'Date not recorded'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

function itemTitle(item: RecordItem, fallback: string): string {
  for (const key of ['title', 'summary', 'event_type', 'type', 'name', 'status']) {
    if (typeof item[key] === 'string' && item[key]) return item[key] as string
  }
  return fallback
}

function itemDetail(item: RecordItem): string {
  for (const key of ['description', 'detail', 'source_text', 'notes', 'content']) {
    if (typeof item[key] === 'string' && item[key]) return item[key] as string
  }
  return 'No additional detail recorded.'
}

export default function ProfessionalDashboard() {
  const personId = getPersonId()
  const [events, setEvents] = useState<RecordItem[]>([])
  const [appointments, setAppointments] = useState<RecordItem[]>([])
  const [insights, setInsights] = useState<RecordItem[]>([])
  const [caregivers, setCaregivers] = useState<RecordItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    if (!personId) {
      setEvents([]); setAppointments([]); setInsights([]); setCaregivers([])
      setError('Select a care recipient to view their existing care record.')
      setLoading(false)
      return
    }
    setLoading(true); setError(null)
    const results = await Promise.allSettled([
      getJSON('/events/' + encodeURIComponent(personId)),
      getJSON('/appointments/' + encodeURIComponent(personId)),
      getJSON('/insights/' + encodeURIComponent(personId)),
      getJSON('/caregivers/' + encodeURIComponent(personId)),
    ])
    const failures = results.filter((r) => r.status === 'rejected')
    const values = results.map((r) => r.status === 'fulfilled' ? r.value : [])
    setEvents(Array.isArray(values[0]) ? values[0] as RecordItem[] : [])
    setAppointments(Array.isArray(values[1]) ? values[1] as RecordItem[] : [])
    setInsights(Array.isArray(values[2]) ? values[2] as RecordItem[] : [])
    setCaregivers(Array.isArray(values[3]) ? values[3] as RecordItem[] : [])
    if (failures.length) setError('Some care-record sections could not be retrieved. Displayed sections contain only data returned successfully by the backend; retry to refresh.')
    setLoading(false)
  }

  useEffect(() => { void load() }, [personId])

  const section = (title: string, items: RecordItem[], empty: string) => (
    <section style={{ marginTop: 20, padding: 16, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)' }}>
      <h2 style={{ fontSize: 16, fontWeight: 600 }}>{title} <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>({items.length})</span></h2>
      {items.length === 0 ? <p style={{ marginTop: 10, color: 'var(--text-secondary)', fontSize: 13 }}>{empty}</p> : (
        <ul style={{ listStyle: 'none', padding: 0, margin: '10px 0 0', display: 'grid', gap: 10 }}>
          {items.slice(0, 10).map((item, index) => (
            <li key={typeof item.id === 'string' ? item.id : index} style={{ paddingTop: 10, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 500 }}>{itemTitle(item, title.slice(0, -1) || 'Record')}</div>
              <div style={{ marginTop: 4, fontSize: 13, lineHeight: 1.5, color: 'var(--text-secondary)' }}>{itemDetail(item)}</div>
              <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-secondary)' }}>{readableDate(item.created_at ?? item.updated_at ?? item.occurred_at ?? item.appointment_date)}</div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '28px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div><h1 style={{ fontSize: 24, fontWeight: 600 }}>Professional Care Overview</h1><p style={{ marginTop: 6, color: 'var(--text-secondary)', fontSize: 13 }}>Existing records for the currently selected care recipient. This is not a multi-patient professional dashboard.</p></div>
        <button onClick={() => void load()} disabled={loading} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', cursor: loading ? 'default' : 'pointer' }}>{loading ? 'Refreshing…' : 'Refresh'}</button>
      </div>
      {error && <p role="alert" style={{ marginTop: 16, color: 'var(--error)', fontSize: 13 }}>{error}</p>}
      {loading && <p style={{ marginTop: 16, color: 'var(--text-secondary)' }}>Loading care records…</p>}
      {!loading && <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginTop: 20 }}>
          {[['Care events', events.length], ['Appointments', appointments.length], ['Insights', insights.length], ['Linked caregivers', caregivers.length]].map(([label, count]) => <div key={String(label)} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14, background: 'var(--surface)' }}><div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{label}</div><div style={{ marginTop: 6, fontSize: 24, fontWeight: 600 }}>{count}</div></div>)}
        </div>
        {section('Care events', events, 'No care events were returned for this person.')}
        {section('Appointments', appointments, 'No appointments were returned for this person.')}
        {section('Insights', insights, 'No insights were returned for this person.')}
        {section('Caregivers', caregivers, 'No linked caregivers were returned for this person.')}
      </>}
    </main>
  )
}
