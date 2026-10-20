import { useEffect, useState } from 'react'
import { getJSON } from '../api/client'

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
  const [insights, setInsights] = useState<Insight[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const data = await getJSON('/insights/demo-person-id')
        setInsights(data)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

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
        Every insight shows its evidence, confidence, and what still needs confirmation.
      </p>

      {loading && <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>}

      {!loading && insights.length === 0 && (
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>No insights yet.</p>
      )}

      {!loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {insights.map(ins => (
            <div key={ins.id} style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: '12px', padding: '20px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div>
                  <span style={{
                    fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em',
                    color: 'var(--text-secondary)', marginBottom: '4px', display: 'block'
                  }}>
                    {typeLabel[ins.insight_type] || ins.insight_type}
                  </span>
                  <span style={{ fontSize: '16px', fontWeight: 500 }}>{ins.title}</span>
                </div>
                <span style={{
                  fontSize: '12px', padding: '4px 10px', borderRadius: '999px',
                  background: ins.confidence >= 0.8 ? 'var(--trust-soft)' : ins.confidence >= 0.5 ? 'var(--unknown-soft)' : '#fef2f2',
                  color: confidenceColor(ins.confidence)
                }}>
                  {Math.round(ins.confidence * 100)}% confidence
                </span>
              </div>

              <p style={{ fontSize: '14px', color: 'var(--text)', marginBottom: '16px' }}>{ins.description}</p>

              <div style={{ background: 'var(--accent-soft)', borderRadius: '8px', padding: '12px 16px', marginBottom: '12px' }}>
                <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Evidence
                </span>
                <span style={{ fontSize: '13px', color: 'var(--text)' }}>
                  {ins.evidence_ids.length} source{ins.evidence_ids.length !== 1 ? 's' : ''} linked
                </span>
              </div>

              {ins.possible_context && (
                <div style={{ background: 'var(--unknown-soft)', borderRadius: '8px', padding: '12px 16px' }}>
                  <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--unknown)', display: 'block', marginBottom: '4px' }}>
                    Possible context
                  </span>
                  <span style={{ fontSize: '13px', color: 'var(--text)' }}>{ins.possible_context}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
