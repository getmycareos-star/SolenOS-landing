import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getJSON } from '../api/client'

interface Event {
  id: string
  event_type: string
  occurred_at: string
  title: string
  description?: string
  time_provenance?: string
  location?: string
}

interface Insight {
  id: string
  title: string
  description: string
  confidence: number
  insight_type: string
  possible_context?: string
  time_provenance?: string
}

interface ObservationTrend {
  tag: string
  count: number
  first_observed: string
  last_observed: string
  trend: string
}

interface ReasoningSummary {
  confirmed_facts: Array<{ key: string; value: any[]; confidence: number }>
  open_questions: Array<{ key: string; value: any[] }>
  preferences: Array<{ key: string; value: any[] }>
  rejected_assumptions: Array<{ key: string; value: any[] }>
  care_patterns: Array<{ key: string; value: any[] }>
  coordination_decisions: Array<{ key: string; value: any[] }>
}

interface DailyIntelligence {
  id: string
  intelligence_date: string
  overdue_items: any[]
  upcoming_items: any[]
  active_windows: any[]
  expired_windows: any[]
  daily_summary: string
}

export default function Dashboard() {
  const [events, setEvents] = useState<Event[]>([])
  const [insights, setInsights] = useState<Insight[]>([])
  const [trends, setTrends] = useState<ObservationTrend[]>([])
  const [reasoning, setReasoning] = useState<ReasoningSummary | null>(null)
  const [dailyIntel, setDailyIntel] = useState<DailyIntelligence | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [evts, inss, trendData, reasoningData, intelData] = await Promise.all([
          getJSON('/events/demo-person-id'),
          getJSON('/insights/demo-person-id'),
          getJSON('/observations/demo-person-id/trends').catch(() => []),
          getJSON('/reasoning/demo-person-id/summary').catch(() => null),
          getJSON('/daily-intelligence/demo-person-id').catch(() => null),
        ])
        setEvents(evts.slice(0, 5))
        setInsights(inss.slice(0, 3))
        setTrends(trendData.slice(0, 5))
        setReasoning(reasoningData)
        setDailyIntel(intelData)
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
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '4px' }}>What matters today</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '32px' }}>
        A calm view of what changed and what needs attention.
      </p>

      {loading && <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>}

      {!loading && (
        <>
          {dailyIntel && (
            <section style={{ marginBottom: '40px' }}>
              <h2 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                Daily summary
              </h2>
              <div style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: '12px', padding: '16px 20px'
              }}>
                <p style={{ fontSize: '14px', lineHeight: 1.6 }}>{dailyIntel.daily_summary}</p>
                {dailyIntel.overdue_items.length > 0 && (
                  <div style={{ marginTop: '12px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--unknown)', fontWeight: 500 }}>
                      {dailyIntel.overdue_items.length} overdue
                    </span>
                  </div>
                )}
                {dailyIntel.active_windows.length > 0 && (
                  <div style={{ marginTop: '8px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 500 }}>
                      {dailyIntel.active_windows.length} active monitoring period(s)
                    </span>
                  </div>
                )}
              </div>
            </section>
          )}

          <section style={{ marginBottom: '40px' }}>
            <h2 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Recent events
            </h2>
            {events.length === 0 && (
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>No events recorded yet.</p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {events.map(evt => (
                <div key={evt.id} style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: '12px', padding: '16px 20px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 500 }}>{evt.title}</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{formatDate(evt.occurred_at)}</span>
                  </div>
                  {evt.description && (
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{evt.description}</p>
                  )}
                  {evt.time_provenance && (
                    <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px', fontStyle: 'italic' }}>
                      Time source: {evt.time_provenance}
                    </p>
                  )}
                  {evt.location && (
                    <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      Location: {evt.location}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <Link to="/timeline" style={{ display: 'inline-block', marginTop: '16px', fontSize: '13px', color: 'var(--text-secondary)', textDecoration: 'none' }}>
              View full timeline →
            </Link>
          </section>

          {trends.length > 0 && (
            <section style={{ marginBottom: '40px' }}>
              <h2 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                Observation patterns
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {trends.map(trend => (
                  <div key={trend.tag} style={{
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: '12px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                  }}>
                    <div>
                      <span style={{ fontSize: '14px', fontWeight: 500, textTransform: 'capitalize' }}>{trend.tag.replace(/_/g, ' ')}</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginLeft: '8px' }}>
                        {trend.count} observation{trend.count !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <span style={{
                      fontSize: '11px', padding: '2px 8px', borderRadius: '999px',
                      background: trend.trend === 'Strong pattern' ? 'var(--trust-soft)' : 'var(--unknown-soft)',
                      color: trend.trend === 'Strong pattern' ? 'var(--trust)' : 'var(--unknown)'
                    }}>
                      {trend.trend}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {reasoning && (
            <section style={{ marginBottom: '40px' }}>
              <h2 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                What the system knows
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {reasoning.confirmed_facts.length > 0 && (
                  <div style={{ background: 'var(--trust-soft)', borderRadius: '12px', padding: '16px 20px' }}>
                    <h3 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--trust)', marginBottom: '8px' }}>Confirmed</h3>
                    {reasoning.confirmed_facts.map((fact, i) => (
                      <p key={i} style={{ fontSize: '13px', color: 'var(--text)' }}>{fact.key}: {JSON.stringify(fact.value)}</p>
                    ))}
                  </div>
                )}
                {reasoning.open_questions.length > 0 && (
                  <div style={{ background: 'var(--unknown-soft)', borderRadius: '12px', padding: '16px 20px' }}>
                    <h3 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--unknown)', marginBottom: '8px' }}>Open questions</h3>
                    {reasoning.open_questions.map((q, i) => (
                      <p key={i} style={{ fontSize: '13px', color: 'var(--text)' }}>{q.key}: {JSON.stringify(q.value)}</p>
                    ))}
                  </div>
                )}
                {reasoning.preferences.length > 0 && (
                  <div style={{ background: 'var(--accent-soft)', borderRadius: '12px', padding: '16px 20px' }}>
                    <h3 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', marginBottom: '8px' }}>Preferences</h3>
                    {reasoning.preferences.map((pref, i) => (
                      <p key={i} style={{ fontSize: '13px', color: 'var(--text)' }}>{pref.key}: {JSON.stringify(pref.value)}</p>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          <section>
            <h2 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Active insights
            </h2>
            {insights.length === 0 && (
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>No insights yet.</p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {insights.map(ins => (
                <div key={ins.id} style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: '12px', padding: '16px 20px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 500 }}>{ins.title}</span>
                    <span style={{
                      fontSize: '11px', padding: '2px 8px', borderRadius: '999px',
                      background: ins.confidence >= 0.8 ? 'var(--trust-soft)' : 'var(--unknown-soft)',
                      color: ins.confidence >= 0.8 ? 'var(--trust)' : 'var(--unknown)'
                    }}>
                      {Math.round(ins.confidence * 100)}% confidence
                    </span>
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{ins.description}</p>
                  {ins.time_provenance && (
                    <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px', fontStyle: 'italic' }}>
                      Time source: {ins.time_provenance}
                    </p>
                  )}
                  {ins.possible_context && (
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px', fontStyle: 'italic' }}>
                      Possible context: {ins.possible_context}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <Link to="/insights" style={{ display: 'inline-block', marginTop: '16px', fontSize: '13px', color: 'var(--text-secondary)', textDecoration: 'none' }}>
              View all insights →
            </Link>
          </section>
        </>
      )}
    </div>
  )
}
