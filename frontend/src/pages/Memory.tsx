import { useEffect, useState } from 'react'
import { getJSON } from '../api/client'

interface Observation {
  id: string
  observed_at: string
  original_text: string
  tags: string[] | null
}

interface ReasoningMemory {
  id: string
  memory_type: string
  key: string
  value: any[]
  confidence: number
  is_open_question: boolean
}

interface LearningEvent {
  id: string
  event_type: string
  detail: string
  source_type: string
  created_at: string
}

export default function Memory() {
  const [observations, setObservations] = useState<Observation[]>([])
  const [memories, setMemories] = useState<ReasoningMemory[]>([])
  const [events, setEvents] = useState<LearningEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [obs, mem, evts] = await Promise.all([
          getJSON('/observations/demo-person-id'),
          getJSON('/reasoning-memory/demo-person-id'),
          getJSON('/learning-events/demo-person-id').catch(() => []),
        ])
        setObservations(obs)
        setMemories(mem)
        setEvents(evts.slice(0, 20))
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

  const memoryTypeLabel: Record<string, { label: string; color: string; bg: string }> = {
    confirmed_fact: { label: 'Confirmed', color: 'var(--trust)', bg: 'var(--trust-soft)' },
    open_question: { label: 'Open question', color: 'var(--unknown)', bg: 'var(--unknown-soft)' },
    preference: { label: 'Preference', color: 'var(--accent)', bg: 'var(--accent-soft)' },
    rejected_assumption: { label: 'Rejected', color: '#dc2626', bg: '#fef2f2' },
    care_pattern: { label: 'Pattern', color: '#7c3aed', bg: '#f5f3ff' },
    coordination_decision: { label: 'Decision', color: '#2563eb', bg: '#eff6ff' },
    correction_history: { label: 'Correction', color: '#d97706', bg: '#fffbeb' },
    feedback: { label: 'Feedback', color: '#db2777', bg: '#fdf2f8' },
  }

  return (
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '4px' }}>What SolenOS remembers</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '32px' }}>
        The persistent understanding that compounds with every interaction.
      </p>

      {loading && <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>}

      {!loading && (
        <>
          <section style={{ marginBottom: '40px' }}>
            <h2 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Reasoning memory
            </h2>
            {memories.length === 0 && (
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>No reasoning memory yet.</p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {memories.map(mem => {
                const meta = memoryTypeLabel[mem.memory_type] || { label: mem.memory_type, color: 'var(--text-secondary)', bg: 'var(--accent-soft)' }
                return (
                  <div key={mem.id} style={{
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: '12px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px'
                  }}>
                    <span style={{
                      fontSize: '11px', padding: '2px 8px', borderRadius: '999px',
                      background: meta.bg, color: meta.color, whiteSpace: 'nowrap'
                    }}>
                      {meta.label}
                    </span>
                    <span style={{ fontSize: '14px', fontWeight: 500 }}>{mem.key}</span>
                    <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {Math.round(mem.confidence * 100)}%
                    </span>
                  </div>
                )
              })}
            </div>
          </section>

          <section style={{ marginBottom: '40px' }}>
            <h2 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Observations ({observations.length})
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {observations.map(obs => (
                <div key={obs.id} style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: '12px', padding: '16px 20px'
                }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    {formatDate(obs.observed_at)}
                  </div>
                  <p style={{ fontSize: '14px', lineHeight: 1.6 }}>{obs.original_text}</p>
                  {obs.tags && obs.tags.length > 0 && (
                    <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                      {obs.tags.map(tag => (
                        <span key={tag} style={{
                          fontSize: '11px', padding: '2px 8px', borderRadius: '999px',
                          background: 'var(--accent-soft)', color: 'var(--text-secondary)', textTransform: 'capitalize'
                        }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Learning events
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {events.map(evt => (
                <div key={evt.id} style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: '12px', padding: '12px 16px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{evt.event_type.replace(/_/g, ' ')}</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{formatDate(evt.created_at)}</span>
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--text)' }}>{evt.detail}</p>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
