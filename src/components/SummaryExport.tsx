import { useState } from 'react'
import { getJSON, getBlob, getPersonId } from '../api/client'

interface CareEvent {
  id: string
  event_type: string
  title: string
  description?: string
  occurred_at: string
  tags: string[]
}

interface EvidenceItem {
  id: string
  type: string
  source_text: string
  uploaded_at: string
  uploaded_by_caregiver_id?: string
  confidence: number
  evidence_status: string
}

interface SummaryData {
  person: { id: string; name: string; date_of_birth?: string }
  generated_at: string
  profile_completeness: string
  person_in_brief: {
    summary: string
    personalisation?: any
    what_settles_them?: any[]
    what_upsets_them?: any[]
  }
  recent_events: CareEvent[]
  evidence_trail?: EvidenceItem[]
  behavior_observations: any[]
  open_questions: any[]
  follow_ups_due: any[]
  active_actions: any[]
  insights: any[]
  meanings: any[]
  safety_flags: {
    attention_candidates: number
    follow_up_candidates: number
    behavior_safety_concerns: number
  }
  _disclaimer: string
}

interface SummaryExportProps {
  compact?: boolean
}

export default function SummaryExport({ compact = false }: SummaryExportProps) {
  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const personId = getPersonId()

  const loadSummary = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getJSON(`/summary/${personId}?include_evidence=true`) as { summary: SummaryData }
      setSummary(data.summary)
    } catch (e: any) {
      setError(e.message || 'Failed to load summary')
    } finally {
      setLoading(false)
    }
  }

  // The PDF is generated server-side so the same document can be emailed to a
  // GP portal or printed elsewhere. Fetched as a blob rather than navigating to
  // the URL, so the user stays on the page.
  const exportPDF = async () => {
    setError(null)
    try {
      const blob = await getBlob(`/care-summary/${personId}/pdf`)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `care-summary-${personId}-${new Date().toISOString().split('T')[0]}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      setError(e.message || 'Failed to build the PDF')
    }
  }

  const exportJSON = () => {
    if (!summary) return
    const blob = new Blob([JSON.stringify({ summary }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `solenOS-care-summary-${personId}-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportText = () => {
    if (!summary) return
    const lines: string[] = []
    lines.push('='.repeat(60))
    lines.push('SOLENOS — LIVING CARE SUMMARY')
    lines.push('='.repeat(60))
    lines.push(`Generated: ${new Date(summary.generated_at).toLocaleString()}`)
    lines.push(`Person: ${summary.person.name} (${summary.person.id})`)
    lines.push(`Profile: ${summary.profile_completeness}`)
    lines.push(`Disclaimer: ${summary._disclaimer}`)
    lines.push('')
    lines.push('--- PERSON IN BRIEF ---')
    lines.push(summary.person_in_brief.summary || '(no summary)')
    lines.push('')
    lines.push('--- RECENT EVENTS ---')
    summary.recent_events.forEach(e => {
      lines.push(`[${new Date(e.occurred_at).toLocaleDateString()}] ${e.title}`)
      if (e.description) lines.push(`  ${e.description}`)
      if (e.tags?.length) lines.push(`  Tags: ${e.tags.join(', ')}`)
      lines.push('')
    })
    lines.push('--- SAFETY FLAGS ---')
    lines.push(`Attention candidates: ${summary.safety_flags.attention_candidates}`)
    lines.push(`Follow-up candidates: ${summary.safety_flags.follow_up_candidates}`)
    lines.push(`Behavior safety concerns: ${summary.safety_flags.behavior_safety_concerns}`)
    lines.push('')
    lines.push('--- OPEN QUESTIONS ---')
    summary.open_questions.forEach(q => {
      lines.push(`[${q.category}] ${q.question}`)
    })
    if (summary.open_questions.length === 0) lines.push('(none)')
    lines.push('')
    lines.push('--- INSIGHTS ---')
    summary.insights.forEach(i => {
      lines.push(`[${Math.round(i.confidence * 100)}%] ${i.title}`)
      lines.push(`  ${i.description}`)
      lines.push(`  Evidence: ${i.evidence_ids?.length || 0} sources`)
      lines.push('')
    })
    lines.push('--- MEANINGS ---')
    summary.meanings.forEach(m => {
      lines.push(`[${Math.round(m.confidence * 100)}% | ${m.confidence_type}] ${m.longitudinal_pattern}`)
      if (m.rationale) lines.push(`  ${m.rationale}`)
      lines.push('')
    })

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `solenOS-care-summary-${personId}-${new Date().toISOString().split('T')[0]}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const copySummary = async () => {
    if (!summary) return
    const text = JSON.stringify({ summary }, null, 2)
    await navigator.clipboard.writeText(text)
    alert('Summary copied to clipboard.')
  }

  if (compact) {
    return (
      <button
        onClick={loadSummary}
        disabled={loading}
        style={{
          fontSize: '12px', padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border)',
          background: 'var(--surface)', cursor: loading ? 'default' : 'pointer'
        }}
      >
        {loading ? 'Loading...' : 'Export summary'}
      </button>
    )
  }

  return (
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '4px' }}>Living Care Summary</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
        A trust-first, evidence-linked summary of everything SolenOS knows about this person.
      </p>

      {!summary && !loading && (
        <button
          onClick={loadSummary}
          style={{
            padding: '12px 24px', borderRadius: '10px', border: 'none',
            background: 'var(--trust)', color: 'white', fontSize: '14px', fontWeight: 500, cursor: 'pointer'
          }}
        >
          Generate summary
        </button>
      )}

      {error && <p style={{ color: '#dc2626', fontSize: '13px' }}>{error}</p>}

      {summary && (
        <>
          <div style={{
            display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap'
          }}>
            <button onClick={exportPDF} style={{
              padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--trust)',
              background: 'var(--trust)', color: 'white', fontSize: '13px', cursor: 'pointer'
            }}>Download PDF for the appointment</button>
            <button onClick={exportJSON} style={{
              padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border)',
              background: 'var(--surface)', fontSize: '13px', cursor: 'pointer'
            }}>Download JSON</button>
            <button onClick={exportText} style={{
              padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border)',
              background: 'var(--surface)', fontSize: '13px', cursor: 'pointer'
            }}>Download text</button>
            <button onClick={copySummary} style={{
              padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border)',
              background: 'var(--surface)', fontSize: '13px', cursor: 'pointer'
            }}>Copy to clipboard</button>
          </div>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Person in brief
            </h2>
            <div style={{
              background: 'var(--trust-soft)', border: '1px solid var(--trust)',
              borderRadius: '12px', padding: '20px'
            }}>
              <p style={{ fontSize: '14px', lineHeight: 1.6, marginBottom: '8px' }}>
                <strong>{summary.person.name}</strong> — {summary.person_in_brief.summary}
              </p>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Profile completeness: <strong>{summary.profile_completeness}</strong>
              </p>
            </div>
          </section>

          {summary.evidence_trail && summary.evidence_trail.length > 0 && (
            <section style={{ marginBottom: '32px' }}>
              <h2 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                Evidence trail ({summary.evidence_trail.length} items)
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {summary.evidence_trail.slice(0, 20).map(e => (
                  <div key={e.id} style={{
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: '12px', padding: '12px 16px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>{e.type}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        {new Date(e.uploaded_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--text)', lineHeight: 1.5 }}>
                      {(e.source_text || '').slice(0, 200)}{(e.source_text || '').length > 200 && '...'}
                    </p>
                    <div style={{ marginTop: '6px', display: 'flex', gap: '8px' }}>
                      <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: e.evidence_status === 'confirmed' ? 'var(--trust-soft)' : 'var(--unknown-soft)', color: e.evidence_status === 'confirmed' ? 'var(--trust)' : 'var(--unknown)' }}>{e.evidence_status}</span>
                      {e.uploaded_by_caregiver_id && (
                        <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>By: {e.uploaded_by_caregiver_id}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {summary.open_questions.length > 0 && (
            <section style={{ marginBottom: '32px' }}>
              <h2 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                Open questions
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {summary.open_questions.map((q, i) => (
                  <div key={i} style={{
                    background: 'var(--unknown-soft)', border: '1px solid var(--unknown)',
                    borderRadius: '12px', padding: '12px 16px'
                  }}>
                    <p style={{ fontSize: '13px' }}><strong>[{q.category}]</strong> {q.question}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {summary.follow_ups_due.length > 0 && (
            <section style={{ marginBottom: '32px' }}>
              <h2 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                Follow-ups due
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {summary.follow_ups_due.map(f => (
                  <div key={f.id} style={{
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: '12px', padding: '12px 16px'
                  }}>
                    <p style={{ fontSize: '13px', fontWeight: 500 }}>{f.what_to_recheck}</p>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Due: {new Date(f.due_at).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
            {summary._disclaimer}
          </p>
        </>
      )}
    </div>
  )
}
