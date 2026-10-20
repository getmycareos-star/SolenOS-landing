import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getJSON, postJSON, getPersonId } from '../api/client'

interface Snapshot {
  id: string
  snapshot_time: string
  period_type: string
  total_evidence_count: number
  active_evidence_count: number
}

interface TimelinePoint {
  day: string
  count: number
  avg_confidence?: number
}

export default function LongitudinalEvidence() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [timeline, setTimeline] = useState<TimelinePoint[]>([])
  const [loading, setLoading] = useState(true)
  const days = 30

  const personId = getPersonId()

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [snaps, tl] = await Promise.all([
          getJSON(`/longitudinal/evidence/snapshots/${personId}?limit=30`).catch(() => []),
          getJSON(`/longitudinal/evidence/timeline/${personId}?days=${days}`).catch(() => ({ timeline: [] })),
        ])
        setSnapshots(snaps)
        setTimeline(tl.timeline || [])
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [personId, days])

  async function createSnapshot() {
    try {
      await postJSON(`/longitudinal/evidence/snapshots?person_id=${personId}`, {})
      const snaps = await getJSON(`/longitudinal/evidence/snapshots/${personId}?limit=30`)
      setSnapshots(snaps)
    } catch (e) {
      console.error(e)
    }
  }

  async function computeTrends() {
    try {
      await postJSON(`/longitudinal/evidence/trends/compute?person_id=${personId}&window_type=weekly`, {})
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '4px' }}>Evidence Over Time</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.5, maxWidth: '500px' }}>
            Longitudinal view of evidence: trends, quality, confidence, and relationships.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={createSnapshot} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', fontSize: '13px' }}>
            Snapshot
          </button>
          <button onClick={computeTrends} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--accent)', background: 'var(--accent)', color: 'white', cursor: 'pointer', fontSize: '13px' }}>
            Compute Trends
          </button>
          <Link to="/evidence" style={{ fontSize: '12px', color: 'var(--text-secondary)', textDecoration: 'none', alignSelf: 'center' }}>
            ← Evidence
          </Link>
        </div>
      </div>

      {loading && <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>}

      {!loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: '12px', padding: '16px 20px',
          }}>
            <h3 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Daily evidence volume
            </h3>
            {timeline.length === 0 ? (
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>No data yet.</p>
            ) : (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '160px' }}>
                {timeline.map((point, i) => {
                  const maxCount = Math.max(...timeline.map(t => t.count), 1)
                  return (
                    <div
                      key={i}
                      title={`${point.day}: ${point.count} evidence`}
                      style={{
                        flex: 1,
                        height: `${Math.max((point.count / maxCount) * 100, 2)}%`,
                        background: 'var(--accent)',
                        borderRadius: '4px 4px 0 0',
                        minWidth: '8px',
                        opacity: 0.85,
                      }}
                    />
                  )
                })}
              </div>
            )}
          </div>

          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: '12px', padding: '16px 20px',
          }}>
            <h3 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '12px' }}>
              Snapshots ({snapshots.length})
            </h3>
            {snapshots.length === 0 ? (
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>No snapshots yet. Create one above.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {snapshots.map(snap => (
                  <div key={snap.id} style={{
                    background: 'var(--bg)', borderRadius: '8px', padding: '12px 16px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <div>
                      <span style={{ fontSize: '14px', fontWeight: 500 }}>
                        {snap.period_type} · {new Date(snap.snapshot_time).toLocaleString()}
                      </span>
                      <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        <span>Total: {snap.total_evidence_count}</span>
                        <span>Active: {snap.active_evidence_count}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
