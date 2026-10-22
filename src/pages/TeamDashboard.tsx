import { useCallback, useEffect, useState } from 'react'
import { getJSON, patchJSON } from '../api/client'

interface DashboardMetrics {
  people_count: number; caregiver_count: number; care_event_count: number
  appointment_count: number; community_post_count: number; pending_moderation_count: number
  generated_at: string; data_source: string
}
interface StateReport {
  care_events_by_type: { event_type: string; count: number }[]
  appointments_by_status: { status: string; count: number }[]
  community_posts_by_moderation_status: { status: string; count: number }[]
  generated_at: string; limitations: string[]
}
interface Post {
  id: string; content: string; author_label: string; post_type: string
  care_stage?: string | null; tags: string[]; created_at?: string | null
  moderation_status: string
}

const panel = { marginTop: 18, padding: 16, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)' }

export default function TeamDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [report, setReport] = useState<StateReport | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setNotice(null);
    // Clear prior values before refresh. A failed request must never leave old
    // values looking like current operational data.
    setMetrics(null);
    setReport(null);
    setPosts([]);

    try {
      const results = await Promise.allSettled([
        getJSON<unknown>('/team/dashboard'),
        getJSON<unknown>('/team/state-report'),
        getJSON<unknown>('/team/moderation?status=pending'),
      ]);
      const labels = ['team dashboard metrics', 'state report', 'moderation queue'];
      const failures = results
        .map((result, index) => result.status === 'rejected' ? labels[index] : null)
        .filter((label): label is string => label !== null);
      if (failures.length) {
        throw new Error(`Could not verify ${failures.join(', ')}. Dashboard data is unavailable; empty results are not inferred from failed requests.`);
      }

      const [metricsValue, reportValue, moderationValue] = results.map(
        result => (result as PromiseFulfilledResult<unknown>).value,
      );
      const nextMetrics = metricsValue as DashboardMetrics;
      const nextReport = reportValue as StateReport;
      const nextModeration = moderationValue as { posts: Post[] };

      if (
        !nextMetrics || typeof nextMetrics !== 'object' ||
        !['people_count', 'caregiver_count', 'care_event_count', 'appointment_count', 'community_post_count', 'pending_moderation_count']
          .every(key => typeof (nextMetrics as unknown as Record<string, unknown>)[key] === 'number'
            && Number.isFinite((nextMetrics as unknown as Record<string, number>)[key])
            && (nextMetrics as unknown as Record<string, number>)[key] >= 0) ||
        typeof nextMetrics.generated_at !== 'string' || !nextMetrics.generated_at ||
        typeof nextMetrics.data_source !== 'string' || !nextMetrics.data_source
      ) {
        throw new Error('The server returned incomplete dashboard metrics. They were not displayed as live data.');
      }
      if (
        !nextReport || typeof nextReport !== 'object' ||
        !Array.isArray(nextReport.care_events_by_type) ||
        !Array.isArray(nextReport.appointments_by_status) ||
        !Array.isArray(nextReport.community_posts_by_moderation_status) ||
        !Array.isArray(nextReport.limitations) ||
        typeof nextReport.generated_at !== 'string' || !nextReport.generated_at
      ) {
        throw new Error('The server returned an incomplete state report. It was not displayed as live data.');
      }
      if (!nextModeration || !Array.isArray(nextModeration.posts) || !nextModeration.posts.every(post =>
        post && typeof post.id === 'string' && post.id &&
        typeof post.content === 'string' &&
        typeof post.author_label === 'string' &&
        typeof post.post_type === 'string' &&
        typeof post.moderation_status === 'string' &&
        Array.isArray(post.tags)
      )) {
        throw new Error('The server returned an incomplete moderation queue. It was not treated as an empty queue.');
      }

      setMetrics(nextMetrics);
      setReport(nextReport);
      setPosts(nextModeration.posts);
    } catch (e) {
      setMetrics(null);
      setReport(null);
      setPosts([]);
      setLoadError(e instanceof Error ? e.message : 'Team dashboard data could not be verified.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load() }, [load])

  async function moderate(postId: string, moderation_status: 'published' | 'hidden' | 'removed') {
    setActionError(null); setNotice(null)
    try {
      const result = await patchJSON<{ id: string; moderation_status: string }>('/team/moderation/' + encodeURIComponent(postId), { moderation_status })
      if (result.id !== postId || result.moderation_status !== moderation_status) throw new Error('Backend did not confirm the moderation update.')
      setNotice('Moderation status saved.')
      await load()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Moderation update could not be confirmed.')
    }
  }

  return (
    <main style={{ maxWidth: 1040, margin: '0 auto', padding: '28px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div><h1 style={{ fontSize: 24, fontWeight: 650 }}>SolenOS Team Dashboard</h1><p style={{ marginTop: 6, color: 'var(--text-secondary)', fontSize: 13 }}>Database-backed operational aggregates and Community moderation. Not population-level research statistics.</p></div>
        <button onClick={() => void load()} disabled={loading} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)' }}>{loading ? 'Refreshing…' : 'Refresh'}</button>
      </div>
      {loadError && <p role="alert" style={{ marginTop: 14, color: 'var(--error)', fontSize: 13 }}>{loadError}</p>}
      {actionError && <p role="alert" style={{ marginTop: 14, color: 'var(--error)', fontSize: 13 }}>{actionError}</p>}
      {notice && <p role="status" style={{ marginTop: 14, color: 'var(--trust)', fontSize: 13 }}>{notice}</p>}
      {metrics && <section style={panel}>
        <h2 style={{ fontSize: 16, fontWeight: 600 }}>Live database counts</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginTop: 14 }}>
          {[
            ['Care recipients', metrics.people_count], ['Caregivers', metrics.caregiver_count],
            ['Care events', metrics.care_event_count], ['Appointments', metrics.appointment_count],
            ['Community posts', metrics.community_post_count], ['Pending moderation', metrics.pending_moderation_count],
          ].map(([label, value]) => <div key={String(label)} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}><div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{label}</div><div style={{ fontSize: 24, fontWeight: 650, marginTop: 5 }}>{value}</div></div>)}
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 12 }}>Source: {metrics.data_source}. Generated {new Date(metrics.generated_at).toLocaleString()}.</p>
      </section>}
      {report && <section style={panel}>
        <h2 style={{ fontSize: 16, fontWeight: 600 }}>State report</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20, marginTop: 12 }}>
          <div><h3 style={{ fontSize: 13, fontWeight: 600 }}>Care events by type</h3>{report.care_events_by_type.length ? report.care_events_by_type.map(row => <p key={row.event_type} style={{ fontSize: 13, marginTop: 6 }}>{row.event_type}: {row.count}</p>) : <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>No event rows.</p>}</div>
          <div><h3 style={{ fontSize: 13, fontWeight: 600 }}>Appointments by status</h3>{report.appointments_by_status.length ? report.appointments_by_status.map(row => <p key={row.status} style={{ fontSize: 13, marginTop: 6 }}>{row.status}: {row.count}</p>) : <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>No appointment rows.</p>}</div>
          <div><h3 style={{ fontSize: 13, fontWeight: 600 }}>Community moderation states</h3>{report.community_posts_by_moderation_status.length ? report.community_posts_by_moderation_status.map(row => <p key={row.status} style={{ fontSize: 13, marginTop: 6 }}>{row.status}: {row.count}</p>) : <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>No Community rows.</p>}</div>
        </div>
        {report.limitations.map(item => <p key={item} style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 10 }}>{item}</p>)}
      </section>}
      <section style={panel}>
        <h2 style={{ fontSize: 16, fontWeight: 600 }}>{loadError ? 'Community moderation queue' : `Community moderation queue (${posts.length})`}</h2>
        {loadError ? <p role="alert" style={{ fontSize: 13, color: 'var(--error)', marginTop: 10 }}>Moderation queue unavailable. No empty-queue state is inferred.</p> : posts.length === 0 ? <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 10 }}>No posts awaiting review.</p> : <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>{posts.map(post => <article key={post.id} style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}><strong>{post.post_type === 'question' ? 'Question' : 'Caregiver experience'}</strong><span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{post.moderation_status}</span></div>
          <p style={{ marginTop: 8, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{post.content}</p>
          <p style={{ marginTop: 6, fontSize: 12, color: 'var(--text-secondary)' }}>{post.author_label} · {post.care_stage || 'Stage not specified'} · {(post.tags || []).join(', ')}</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            <button onClick={() => void moderate(post.id, 'published')} style={{ padding: '8px 10px', border: 0, borderRadius: 7, background: 'var(--trust)', color: 'white' }}>Publish</button>
            <button onClick={() => void moderate(post.id, 'hidden')} style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface)' }}>Hide</button>
            <button onClick={() => void moderate(post.id, 'removed')} style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface)' }}>Remove</button>
          </div>
        </article>)}</div>}
      </section>
    </main>
  )
}
