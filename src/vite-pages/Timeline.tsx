import { useEffect, useState } from 'react'
import { getJSON } from '../api/client'

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
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const data = await getJSON('/events/demo-person-id')
        setEvents(data)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

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

  const formatTime = (d: string) => {
    const date = new Date(d)
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

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
        A complete, ordered record of care events. Times are shown in local timezone.
      </p>

      {loading && <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>}

      {!loading && events.length === 0 && (
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>No events recorded yet.</p>
      )}

      {!loading && Object.entries(grouped).map(([day, dayEvents]) => (
        <div key={day} style={{ marginBottom: '32px' }}>
          <h3 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: '12px' }}>
            {formatDate(dayEvents[0].occurred_at)}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingLeft: '16px', borderLeft: '2px solid var(--border)' }}>
            {dayEvents.map(evt => (
              <div key={evt.id} style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: '12px', padding: '16px 20px', position: 'relative'
              }}>
                <div style={{ position: 'absolute', left: '-21px', top: '20px', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)' }} />
                <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>{evt.title}</div>
                {evt.description && (
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{evt.description}</p>
                )}
                <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'inline-block' }}>
                    {formatTime(evt.occurred_at)}
                  </span>
                  {evt.time_provenance && (
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                      Time source: {evt.time_provenance}
                    </span>
                  )}
                  {evt.location && (
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      Location: {evt.location}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
