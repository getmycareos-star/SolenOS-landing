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
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const days = 30

  const personId = getPersonId()

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setLoadError(null)
      if (!personId) {
        setLoadError('Select an authorized care record before viewing longitudinal evidence.')
        setLoading(false)
        return
      }
      try {
        const [snaps, tl] = await Promise.all([
          getJSON(`/longitudinal/evidence/snapshots/${encodeURIComponent(personId)}?limit=30`),
          getJSON(`/longitudinal/evidence/timeline/${encodeURIComponent(personId)}?days=${days}`),
        ])
        if (!Array.isArray(snaps) || !tl || !Array.isArray(tl.timeline)) {
          throw new Error('The longitudinal evidence service returned an invalid response.')
        }
        if (!cancelled) {
          setSnapshots(snaps as Snapshot[])
          setTimeline(tl.timeline as TimelinePoint[])
        }
      } catch (e) {
        console.error('Failed to load longitudinal evidence:', e)
        if (!cancelled) setLoadError('Longitudinal evidence could not be loaded. Empty charts or lists cannot be inferred from this failure.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [personId, days])

  async function createSnapshot() {
    if (!personId) { setActionError('Select an authorized care record first.'); return }
    setActionError(null)
    try {
      await postJSON(`/longitudinal/evidence/snapshots?person_id=${personId}`, {})
      const snaps = await getJSON(`/longitudinal/evidence/snapshots/${personId}?limit=30`)
      if (!Array.isArray(snaps)) throw new Error('The snapshot service returned an invalid response.')
      setSnapshots(snaps as Snapshot[])
    } catch (e) {
      console.error(e)
      setActionError('Could not create or reload the snapshot. The record has not been confirmed updated.')
    }
  }

  async function computeTrends() {
    if (!personId) { setActionError('Select an authorized care record first.'); return }
    setActionError(null)
    try {
      await postJSON(`/longitudinal/evidence/trends/compute?person_id=${personId}&window_type=weekly`, {})
    } catch (e) {
      console.error(e)
      setActionError('Could not compute evidence trends. No update has been confirmed.')
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
      {loadError && <p role="alert" style={{ color: 'var(--error)', fontSize: '14px' }}>{loadError}</p>}
      {actionError && <p role="alert" style={{ color: 'var(--error)', fontSize: '14px' }}>{actionError}</p>}

      {!loading && !loadError && (
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
