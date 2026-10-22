
import { useEffect, useState } from 'react'
import { getJSON, getPersonId } from '../api/client'

interface ContinuityInsight {
  id: string
  person_id: string
  current_evidence_id: string
  current_event_title: string
  current_event_timestamp: string // ISO date string
  prior_evidence_id: string
  prior_event_title: string
  prior_event_timestamp: string // ISO date string
  temporal_distance_days: number
  relationship_type: string
  supporting_evidence_ids: string[]
  explanation: string
  uncertainty_state: string // low, medium, high
  provenance: string
  context_factors: any[] | null
  is_active: boolean
  created_at: string // ISO date string
}

export default function ContinuityInsights() {
  const [insights, setInsights] = useState<ContinuityInsight[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const personId = getPersonId()

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      if (!personId) {
        setError('Select an authorized care record before viewing continuity insights.')
        setLoading(false)
        return
      }
      try {
        const data = await getJSON(`/continuity/${encodeURIComponent(personId)}/insights`)
        if (!Array.isArray(data)) throw new Error('The continuity service returned an invalid response.')
        if (!cancelled) setInsights(data as ContinuityInsight[])
      } catch (e) {
        console.error('Failed to load continuity insights:', e)
        if (!cancelled) setError('Continuity insights could not be loaded. This does not mean no insights exist.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [personId])

  const relationshipTypeLabels: Record<string, string> = {
    observed: 'Observed',
    reported: 'Reported',
    documented: 'Documented',
    inferred: 'Inferred',
    verified: 'Verified',
    conflicting: 'Conflicting',
    unknown: 'Unknown'
  }

  const uncertaintyStateColors: Record<string, string> = {
    low: 'var(--trust)',
    medium: 'var(--warning)',
    high: 'var(--error)'
  }

  return (
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '4px' }}>
        Continuity Insights
      </h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '32px' }}>
        Discover how your recent observations connect to past events in the care record.
      </p>

      {loading && <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>}

      {error && <p style={{ color: '#dc2626', fontSize: '13px' }}>{error}</p>}

      {!loading && !error && insights.length === 0 && (
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          No continuity insights yet. Record some events to see connections emerge.
        </p>
      )}

      {!loading && insights.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {insights.map(insight => (
            <div key={insight.id} style={{
              background: 'var(--surface)', 
              border: '1px solid var(--border)', 
              borderRadius: '12px', 
              padding: '20px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div>
                  <span style={{
                    fontSize: '11px', 
                    textTransform: 'uppercase', 
                    letterSpacing: '0.06em',
                    color: 'var(--text-secondary)', 
                    marginBottom: '4px', 
                    display: 'block'
                  }}>
                    {relationshipTypeLabels[insight.relationship_type] || insight.relationship_type}
                  </span>
                  <span style={{ fontSize: '16px', fontWeight: 500 }}>
                    {insight.explanation}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <span style={{
                    fontSize: '12px', 
                    padding: '4px 10px', 
                    borderRadius: '999px',
                    background: insight.uncertainty_state === 'low' ? 'var(--trust-soft)' : 
                              insight.uncertainty_state === 'medium' ? 'var(--warning-soft)' : 
                              'var(--error-soft)',
                    color: insight.uncertainty_state === 'low' ? 'var(--trust)' : 
                              insight.uncertainty_state === 'medium' ? 'var(--warning)' : 
                              'var(--error)'
                  }}>
                    {insight.uncertainty_state === 'low' ? 'Low uncertainty' : 
                      insight.uncertainty_state === 'medium' ? 'Medium uncertainty' : 
                      'High uncertainty'}
                  </span>
                  <span style={{
                    fontSize: '11px', 
                    color: 'var(--text-secondary)',
                    marginTop: '4px'
                  }}>
                    {(new Date(insight.current_event_timestamp)).toLocaleDateString()} → 
                    {(new Date(insight.prior_event_timestamp)).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div style={{ background: 'var(--accent-soft)', borderRadius: '8px', padding: '12px 16px', marginBottom: '12px' }}>
                <span style={{ 
                  fontSize: '11px', 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.06em', 
                  color: 'var(--text-secondary)', 
                  display: 'block', 
                  marginBottom: '4px' 
                }}>
                  Supporting Evidence
                </span>
                <span style={{ 
                  fontSize: '13px', 
                  color: 'var(--text)' 
                }}>
                  {insight.supporting_evidence_ids.length} source{insight.supporting_evidence_ids.length !== 1 ? 's' : ''} linked
                </span>
              </div>

              {insight.context_factors && insight.context_factors.length > 0 && (
                <div style={{ 
                  background: 'var(--unknown-soft)', 
                  borderRadius: '8px', 
                  padding: '12px 16px' 
                }}>
                  <span style={{ 
                    fontSize: '11px', 
                    textTransform: 'uppercase', 
                    letterSpacing: '0.06em', 
                    color: 'var(--unknown)', 
                    display: 'block', 
                    marginBottom: '4px' 
                  }}>
                    Context Factors
                  </span>
                  <span style={{ 
                    fontSize: '13px', 
                    color: 'var(--text)' 
                  }}>
                    {insight.context_factors.length} contextual factors
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
