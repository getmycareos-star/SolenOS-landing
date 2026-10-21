import { useCallback, useEffect, useState } from 'react'
import { checkAuthState, getJSON, patchJSON } from '../api/client'

interface DashboardData {
  people_count: number
  caregiver_count: number
  care_event_count: number
  appointment_count: number
  community_post_count: number
  pending_moderation_count: number
  generated_at: string
  data_source: string
}

interface StateReport {
  care_events_by_type: { event_type: string; count: number }[]
  appointments_by_status: { status: string; count: number }[]
  community_posts_by_moderation_status: { status: string; count: number }[]
  generated_at: string
  limitations: string[]
}

interface ModerationPost {
  id: string
  author_label: string
  author_type: string
  post_type: string
  content: string
  tags: string[]
  created_at: string | null
  moderation_status: string
}

interface ModerationResponse {
  posts: ModerationPost[]
  count: number
}

function displayTimestamp(value?: string | null) {
  if (!value) return 'Time unavailable'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Time unavailable' : date.toLocaleString()
}

function CountCard({ label, value }: { label: string; value: number }) {
  return (
    <section style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 16, background: 'var(--surface)' }}>
      <p style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{label}</p>
      <p style={{ fontSize: 28, fontWeight: 650, marginTop: 6 }}>{value.toLocaleString()}</p>
    </section>
  )
}

export default function TeamDashboard() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [report, setReport] = useState<StateReport | null>(null)
  const [queue, setQueue] = useState<ModerationPost[]>([])
  const [loading, setLoading] = useState(true)
  const [busyPostId, setBusyPostId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const auth = await checkAuthState()
      if (!auth.authenticated || !auth.sessionInfo) {
        setDashboard(null); setReport(null); setQueue([])
        setError('Sign in with an active SolenOS Team account to view operational data.')
        return
      }
      if (auth.sessionInfo.role !== 'team') {
        setDashboard(null); setReport(null); setQueue([])
        setError('Access denied. This dashboard is restricted to provisioned SolenOS Team accounts.')
        return
      }

      const results = await Promise.allSettled([
        getJSON<DashboardData>('/team/dashboard'),
        getJSON<StateReport>('/team/state-report'),
        getJSON<ModerationResponse>('/team/moderation?status=pending&limit=50'),
      ])
      const failures: string[] = []
      if (results[0].status === 'fulfilled') setDashboard(results[0].value)
      else { setDashboard(null); failures.push('Operational counts could not be loaded.') }
      if (results[1].status === 'fulfilled') setReport(results[1].value)
      else { setReport(null); failures.push('State report could not be loaded.') }
      if (results[2].status === 'fulfilled' && Array.isArray(results[2].value.posts)) setQueue(results[2].value.posts)
      else { setQueue([]); failures.push('The moderation queue could not be loaded.') }
      if (failures.length) setError(failures.join(' '))
    } catch (e) {
      setDashboard(null); setReport(null); setQueue([])
      setError(e instanceof Error ? e.message : 'Team data could not be retrieved.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadData() }, [loadData])

  async function moderate(postId: string, status: 'published' | 'hidden' | 'removed') {
    setBusyPostId(postId)
    setError(null)
    setNotice(null)
    try {
      const result = await patchJSON<{ id: string; moderation_status: string }>(
        '/team/moderation/' + encodeURIComponent(postId),
        { moderation_status: status },
      )
      if (result?.id !== postId || result.moderation_status !== status) {
        throw new Error('The server did not confirm the moderation change. Refresh the queue before retrying.')
      }
      setNotice(status === 'published' ? 'Post published.' : status === 'hidden' ? 'Post hidden.' : 'Post removed.')
      await loadData()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The moderation change could not be confirmed.')
    } finally {
      setBusyPostId(null)
    }
  }

  return (
    <main style={{ maxWidth: 1040, margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 650 }}>SolenOS Team Dashboard</h1>
          <p style={{ marginTop: 6, lineHeight: 1.6, color: 'var(--text-secondary)', fontSize: 13 }}>
            Operational counts and community moderation from records stored in the SolenOS database. These are system records, not population-level care statistics.
          </p>
        </div>
        <button onClick={() => void loadData()} disabled={loading} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)' }}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error && <p role="alert" style={{ marginTop: 16, color: 'var(--error)', fontSize: 13 }}>{error}</p>}
      {notice && <p role="status" style={{ marginTop: 16, color: 'var(--trust)', fontSize: 13 }}>{notice}</p>}
      {loading && <p role="status" style={{ marginTop: 18, color: 'var(--text-secondary)' }}>Loading verified team data…</p>}

      {dashboard && (
        <>
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: 12, marginTop: 20 }}>
            <CountCard label="Care recipients" value={dashboard.people_count} />
            <CountCard label="Caregiver records" value={dashboard.caregiver_count} />
            <CountCard label="Care events" value={dashboard.care_event_count} />
            <CountCard label="Appointments" value={dashboard.appointment_count} />
            <CountCard label="Community posts" value={dashboard.community_post_count} />
            <CountCard label="Pending moderation" value={dashboard.pending_moderation_count} />
          </section>
          <p style={{ marginTop: 8, color: 'var(--text-secondary)', fontSize: 11 }}>
            Source: {dashboard.data_source}. Generated {displayTimestamp(dashboard.generated_at)}.
          </p>
        </>
      )}

      {report && (
        <section style={{ marginTop: 28, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 16 }}>
          <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
            <h2 style={{ fontWeight: 600, fontSize: 15 }}>Care events by type</h2>
            {report.care_events_by_type.length ? report.care_events_by_type.map(row => (
              <p key={row.event_type} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 10, fontSize: 13 }}>
                <span>{row.event_type}</span><strong>{row.count}</strong>
              </p>
            )) : <p style={{ marginTop: 10, color: 'var(--text-secondary)', fontSize: 13 }}>No care-event records are currently stored.</p>}
          </div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
            <h2 style={{ fontWeight: 600, fontSize: 15 }}>Appointments by status</h2>
            {report.appointments_by_status.length ? report.appointments_by_status.map(row => (
              <p key={row.status} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 10, fontSize: 13 }}>
                <span>{row.status}</span><strong>{row.count}</strong>
              </p>
            )) : <p style={{ marginTop: 10, color: 'var(--text-secondary)', fontSize: 13 }}>No appointment records are currently stored.</p>}
          </div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
            <h2 style={{ fontWeight: 600, fontSize: 15 }}>Community post status</h2>
            {report.community_posts_by_moderation_status.length ? report.community_posts_by_moderation_status.map(row => (
              <p key={row.status} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 10, fontSize: 13 }}>
                <span>{row.status}</span><strong>{row.count}</strong>
              </p>
            )) : <p style={{ marginTop: 10, color: 'var(--text-secondary)', fontSize: 13 }}>No community posts are currently stored.</p>}
          </div>
        </section>
      )}

      <section style={{ marginTop: 30 }}>
        <h2 style={{ fontSize: 18, fontWeight: 650 }}>Community moderation queue</h2>
        <p style={{ marginTop: 5, marginBottom: 14, color: 'var(--text-secondary)', fontSize: 12 }}>Only authenticated Team accounts can publish, hide, or remove a post.</p>
        {!loading && queue.length === 0 && !error && <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>No posts are awaiting moderation.</p>}
        {queue.map(post => (
          <article key={post.id} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 12, background: 'var(--surface)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <strong style={{ fontSize: 13 }}>{post.author_label} · {post.post_type}</strong>
              <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{displayTimestamp(post.created_at)}</span>
            </div>
            <p style={{ marginTop: 10, lineHeight: 1.6, fontSize: 14, whiteSpace: 'pre-wrap' }}>{post.content}</p>
            {post.tags?.length > 0 && <p style={{ marginTop: 8, color: 'var(--text-secondary)', fontSize: 11 }}>Tags: {post.tags.join(', ')}</p>}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
              <button disabled={busyPostId === post.id} onClick={() => void moderate(post.id, 'published')}>Publish</button>
              <button disabled={busyPostId === post.id} onClick={() => void moderate(post.id, 'hidden')}>Hide</button>
              <button disabled={busyPostId === post.id} onClick={() => void moderate(post.id, 'removed')}>Remove</button>
            </div>
          </article>
        ))}
        {report?.limitations.map(item => <p key={item} style={{ marginTop: 12, color: 'var(--text-secondary)', fontSize: 11 }}>{item}</p>)}
      </section>
    </main>
  )
}
