import { useEffect, useState } from 'react'
import { getJSON, getPersonId, subscribeToPersonId } from '../api/client'

interface Insight {
  id: string
  title: string
  description: string
  insight_type: string
  confidence: number
  evidence_ids: string[]
  possible_context?: string
}

export default function Insights() {
  const [personId, setPersonIdState] = useState(getPersonId())
  const [insights, setInsights] = useState<Insight[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadVersion, setReloadVersion] = useState(0)

  useEffect(() => subscribeToPersonId(setPersonIdState), [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setLoadError(null)
      setInsights([])
      if (!personId.trim()) {
        setLoadError('Select an authorized care record to view its insights.')
        setLoading(false)
        return
      }
      try {
        const data = await getJSON<unknown>(`/insights/${encodeURIComponent(personId)}`)
        if (!Array.isArray(data) || !data.every(insight =>
          insight && typeof insight.id === 'string' &&
          typeof insight.title === 'string' &&
          typeof insight.description === 'string' &&
          typeof insight.insight_type === 'string' &&
          typeof insight.confidence === 'number' && Number.isFinite(insight.confidence) &&
          Array.isArray(insight.evidence_ids)
        )) {
          throw new Error('The server returned incomplete insight records. No empty state has been assumed.')
        }
        if (!cancelled) setInsights(data as Insight[])
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : 'Insights could not be loaded. Their state is unknown.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [personId, reloadVersion])

  const typeLabel: Record<string, string> = {
    observation: 'Observation',
    concern: 'Concern',
    recommendation: 'Recommendation',
    uncertainty: 'Uncertainty',
  }
  const confidenceColor = (c: number) => c >= 0.8 ? 'var(--trust)' : c >= 0.5 ? 'var(--unknown)' : '#dc2626'

  return (
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '4px' }}>What SolenOS knows</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '32px' }}>
        Insights returned for the selected care record, with their linked evidence and uncertainty.
      </p>
      {loading && <p role="status" style={{ color: 'var(--text-secondary)' }}>Loading insights…</p>}
      {!loading && loadError && <section role="alert" style={{ border: '1px solid var(--error)', borderRadius: 10, padding: 16, color: 'var(--error)' }}>
        <strong>Insights unavailable.</strong><p style={{ marginTop: 8 }}>{loadError}</p>
        <button type="button" onClick={() => setReloadVersion(value => value + 1)} style={{ marginTop: 10 }}>Retry</button>
      </section>}
      {!loading && !loadError && insights.length === 0 && <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>No insights are recorded for this care record.</p>}
      {!loading && !loadError && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {insights.map(ins => (
            <div key={ins.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div>
                  <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>{typeLabel[ins.insight_type] || ins.insight_type}</span>
                  <span style={{ fontSize: '16px', fontWeight: 500 }}>{ins.title}</span>
                </div>
                <span style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '999px', background: ins.confidence >= 0.8 ? 'var(--trust-soft)' : ins.confidence >= 0.5 ? 'var(--unknown-soft)' : '#fef2f2', color: confidenceColor(ins.confidence) }}>{Math.round(ins.confidence * 100)}% confidence</span>
              </div>
              <p style={{ fontSize: '14px', color: 'var(--text)', marginBottom: '16px' }}>{ins.description}</p>
              <div style={{ background: 'var(--accent-soft)', borderRadius: '8px', padding: '12px 16px', marginBottom: '12px' }}>
                <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Evidence</span>
                <span style={{ fontSize: '13px', color: 'var(--text)' }}>{ins.evidence_ids.length} source{ins.evidence_ids.length !== 1 ? 's' : ''} linked</span>
              </div>
              {ins.possible_context && <div style={{ background: 'var(--unknown-soft)', borderRadius: '8px', padding: '12px 16px' }}>
                <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--unknown)', display: 'block', marginBottom: '4px' }}>Possible context</span>
                <span style={{ fontSize: '13px', color: 'var(--text)' }}>{ins.possible_context}</span>
              </div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
