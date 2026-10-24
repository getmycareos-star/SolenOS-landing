import { useEffect, useState } from 'react'
import { getJSON, getPersonId, subscribeToPersonId } from '../api/client'

interface Event {
  id: string
  event_type: string
  occurred_at: string
  title: string
  description?: string
  evidence_ids?: string[]
  time_provenance?: string
  location_provenance?: string
  location?: string
}

export default function Timeline() {
  const [personId, setPersonIdState] = useState(getPersonId())
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadVersion, setReloadVersion] = useState(0)

  useEffect(() => subscribeToPersonId(setPersonIdState), [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setLoadError(null)
      setEvents([])
      if (!personId.trim()) {
        setLoadError('Select an authorized care record to view its timeline.')
        setLoading(false)
        return
      }
      try {
        const data = await getJSON<unknown>(`/events/${encodeURIComponent(personId)}`)
        if (!Array.isArray(data) || !data.every(event =>
          event && typeof event.id === 'string' &&
          typeof event.title === 'string' &&
          typeof event.occurred_at === 'string' &&
          Number.isFinite(new Date(event.occurred_at).getTime())
        )) {
          throw new Error('The server returned an incomplete timeline. No empty timeline has been assumed.')
        }
        if (!cancelled) setEvents(data as Event[])
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : 'The timeline could not be loaded. Its contents are unknown.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [personId, reloadVersion])

  const formatDate = (d: string) => {
    const date = new Date(d)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / 86400000)
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  }

  const formatTime = (d: string) => new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  const grouped = events.reduce<Record<string, Event[]>>((acc, evt) => {
    const day = new Date(evt.occurred_at).toDateString()
    acc[day] = acc[day] || []
    acc[day].push(evt)
    return acc
  }, {})

  return (
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '4px' }}>What happened</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '32px' }}>
        Care events recorded for the selected care record. Times are shown in local timezone.
      </p>
      {loading && <p role="status" style={{ color: 'var(--text-secondary)' }}>Loading timeline…</p>}
      {!loading && loadError && <section role="alert" style={{ border: '1px solid var(--error)', borderRadius: 10, padding: 16, color: 'var(--error)' }}>
        <strong>Timeline unavailable.</strong><p style={{ marginTop: 8 }}>{loadError}</p>
        <button type="button" onClick={() => setReloadVersion(value => value + 1)} style={{ marginTop: 10 }}>Retry</button>
      </section>}
      {!loading && !loadError && events.length === 0 && <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>No events are recorded for this care record.</p>}
      {!loading && !loadError && Object.entries(grouped).map(([day, dayEvents]) => (
        <div key={day} style={{ marginBottom: '32px' }}>
          <h3 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: '12px' }}>{formatDate(dayEvents[0].occurred_at)}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingLeft: '16px', borderLeft: '2px solid var(--border)' }}>
            {dayEvents.map(evt => (
              <div key={evt.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px 20px', position: 'relative' }}>
                <div style={{ position: 'absolute', left: '-21px', top: '20px', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)' }} />
                <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>{evt.title}</div>
                {evt.description && <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{evt.description}</p>}
                <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'inline-block' }}>{formatTime(evt.occurred_at)}</span>
                  {evt.time_provenance && <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>Time source: {evt.time_provenance}</span>}
                  {evt.location && <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Location: {evt.location}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
