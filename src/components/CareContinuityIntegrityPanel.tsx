import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { getJSON, postJSON, patchJSON, getCaregiverId } from '../api/client'

type Assertion = {
  id: string
  field: string
  assertion_kind: 'current_state' | 'time_bound_observation'
  asserted_value: string
  source_event_id?: string | null
  source_label: string
  source_text?: string | null
  evidence_ids: string[]
  assertion_status: string
  review_after_days?: number | null
  recorded_at: string
  observed_at?: string | null
}
type Freshness = {
  assertion_id: string
  status: 'within_review_window' | 'needs_confirmation' | 'historical' | 'time_bound_observation'
  age_days?: number | null
  review_after_days?: number | null
  explanation: string
}
type Question = {
  question: string
  subject_type: string
  subject_id: string
  priority: string
  reason: string
  evidence_ids: string[]
  source_kind: string
  source_id: string
  source_ids: string[]
  persisted_question_id?: string | null
}
type Revision = {
  id: string
  target_type: string
  target_id: string
  revision_number: number
  change_kind: string
  before_state?: Record<string, unknown> | null
  after_state?: Record<string, unknown> | null
  changed_at: string
  evidence_ids: string[]
}
type Contradiction = {
  id: string
  field: string
  description: string
  resolution_status: string
  resolution_notes?: string | null
  evidence_ids: string[]
  source_assertion_ids?: string[] | null
  matching_candidate_ids?: string[] | null
  event_id?: string | null
  context_key?: string | null
  effective_from?: string | null
  effective_to?: string | null
}
type Outcome = {
  id: string
  action_id: string
  outcome_status: string
  created_at: string
  notes?: string | null
  correction_text?: string | null
}
type PanelData = {
  assertions: Assertion[]
  freshness: Freshness[]
  questions: Question[]
  revisions: Revision[]
  outcomes: Outcome[]
  contradictions: Contradiction[]
}

const emptyData: PanelData = { assertions: [], freshness: [], questions: [], revisions: [], outcomes: [], contradictions: [] }
const cardStyle: CSSProperties = {
  border: '1px solid var(--border)', borderRadius: 10, padding: 14,
  background: 'var(--surface)', marginTop: 12,
}
const fieldStyle: React.CSSProperties = {
  boxSizing: 'border-box', width: '100%', padding: '9px 10px', borderRadius: 7,
  border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)',
}
const buttonStyle: React.CSSProperties = {
  border: '1px solid var(--border)', borderRadius: 7, padding: '7px 10px',
  background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer',
}

export default function CareContinuityIntegrityPanel({
  personId,
}: {
  personId: string
}) {
  const [data, setData] = useState<PanelData>(emptyData)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({})
  const [reviewWindows, setReviewWindows] = useState<Record<string, string>>({})
  const [corrections, setCorrections] = useState<Record<string, string>>({})
  const [resolutionHistoryById, setResolutionHistoryById] = useState<Record<string, Array<{ id: string; previous_status: string; new_status: string; rationale: string; evidence_ids: string[]; actor_caregiver_id?: string | null; created_at: string }>>>({})
  const [resolutionHistoryLoadingId, setResolutionHistoryLoadingId] = useState<string | null>(null)
  const [resolutionHistoryErrors, setResolutionHistoryErrors] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    if (!personId) {
      setData(emptyData)
      setError('No authorized care record is selected.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const [assertions, freshness, revisions, outcomes, questions, contradictions] = await Promise.all([
        getJSON(`/care-continuity/assertions/${encodeURIComponent(personId)}`),
        getJSON(`/care-continuity/freshness/${encodeURIComponent(personId)}`),
        getJSON(`/care-continuity/revisions/${encodeURIComponent(personId)}`),
        getJSON(`/care-continuity/outcomes/${encodeURIComponent(personId)}`),
        postJSON(`/care-continuity/next-questions/${encodeURIComponent(personId)}`, {}),
        getJSON(`/care-continuity/contradictions/${encodeURIComponent(personId)}`),
      ])
      if (![assertions, freshness, revisions, outcomes, questions, contradictions].every(Array.isArray)) {
        throw new Error('The care-continuity API returned an incomplete response.')
      }
      setData({ assertions, freshness, revisions, outcomes, questions, contradictions })
    } catch (reason) {
      setError('We couldn’t load the care history. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }, [personId])

  useEffect(() => {
    void load();
    const refreshAfterCareRecordWrite = () => { void load(); };
    window.addEventListener("careRecordUpdated", refreshAfterCareRecordWrite);
    return () => window.removeEventListener("careRecordUpdated", refreshAfterCareRecordWrite);
  }, [load, personId])

  const freshnessById = useMemo(
    () => new Map(data.freshness.map((item) => [item.assertion_id, item])),
    [data.freshness],
  )

  async function resolveContradiction(item: Contradiction, status: 'resolved' | 'partially_resolved' | 'superseded' | 'reopened') {
    const notes = (resolutionNotes[item.id] || '').trim()
    if (notes.length < 3) {
      setError('Add a short note explaining how this conflict was reviewed before resolving it.')
      return
    }
    setError('')
    setNotice('')
    try {
      await patchJSON(`/uncertainty/contradictions/${encodeURIComponent(item.id)}`, {
        resolution_status: status,
        resolution_notes: notes,
      })
      setNotice('Contradiction review saved. The original reports remain preserved.')
      await load()
    } catch (reason) {
      setError('We couldn’t save this review. Please try again.')
    }
  }

  async function markReviewed(assertion: Assertion) {
    const reviewWindow = (reviewWindows[assertion.id] ?? String(assertion.review_after_days ?? '')).trim()
    if (assertion.assertion_kind === 'current_state' && (!reviewWindow || !Number.isInteger(Number(reviewWindow)) || Number(reviewWindow) < 1 || Number(reviewWindow) > 3650)) {
      setError('Set a review window from 1 to 3650 days before accepting a current-state report.')
      return
    }
    setError('')
    setNotice('')
    try {
      await patchJSON(`/care-continuity/assertions/${encodeURIComponent(assertion.id)}/status`, {
        person_id: personId,
        assertion_status: 'accepted',
        updated_by_caregiver_id: getCaregiverId() || undefined,
        review_after_days: reviewWindow ? Number(reviewWindow) : undefined,
      })
      setNotice('Marked as caregiver-reviewed. This is not independent clinical verification.')
      await load()
    } catch (reason) {
      setError('We couldn’t update this review. Please try again.')
    }
  }

  async function recordOutcome(question: Question, status: 'useful' | 'completed' | 'unresolved' | 'not_useful' | 'corrected') {
    const actionId = question.persisted_question_id || question.source_id
    const correction = (corrections[actionId] || '').trim()
    if (status === 'corrected' && !correction) {
      setError('Enter the correction before recording a corrected result.')
      return
    }
    setError('')
    setNotice('')
    try {
      await postJSON('/care-continuity/outcomes', {
        person_id: personId,
        action_id: actionId,
        action_type: 'next_best_question',
        outcome_status: status,
        notes: status === 'unresolved' ? 'Question remains unresolved.' : undefined,
        correction_text: status === 'corrected' ? correction : undefined,
        evidence_ids: question.evidence_ids || [],
        created_by_caregiver_id: getCaregiverId() || undefined,
      })
      setNotice('Outcome recorded. SolenOS has not inferred that the underlying care issue is resolved.')
      await load()
    } catch (reason) {
      setError('We couldn’t save the outcome. Please try again.')
    }
  }

  if (!personId) return <section style={cardStyle}><h2>Care continuity</h2><p>Select an authorized care record to view continuity details.</p></section>

  return (
    <section aria-label="Care continuity integrity" style={{ marginTop: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: 19, margin: 0 }}>Record details</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 5 }}>
            Review reported information, unresolved questions, changes and recorded outcomes. A report is not automatically a confirmed fact.
          </p>
        </div>
        <button type="button" style={buttonStyle} onClick={() => void load()} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error && <p role="status" aria-live="polite" style={{ color: 'var(--error)', fontSize: 13, marginTop: 10 }}>{error}</p>}
      {notice && <p role="status" style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 10 }}>{notice}</p>}

      <div style={cardStyle}>
        <h3 style={{ fontSize: 15, marginTop: 0 }}>Reported care information</h3>
        {data.assertions.length === 0 ? <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No reported care details are available in this record yet.</p> : data.assertions.map((item) => {
          const fresh = freshnessById.get(item.id)
          return <article key={item.id} style={{ borderTop: '1px solid var(--border)', padding: '10px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <strong>{item.field}: {item.asserted_value}</strong>
              <span style={{ fontSize: 12 }}>{fresh?.status?.replace(/_/g, ' ') || 'freshness unknown'}</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '5px 0' }}>
              Source: {item.source_label} · {item.assertion_kind.replace(/_/g, ' ')} · status: {item.assertion_status} · event: {item.source_event_id || 'manual report'}
            </p>
            {fresh && <p style={{ fontSize: 12, margin: '5px 0' }}>{fresh.explanation}</p>}
            <label style={{ display: 'block', fontSize: 12, margin: '7px 0' }}>
              Review window in days {item.assertion_kind === 'current_state' ? '(required before acceptance)' : '(optional for observations)'}
              <input
                style={{ ...fieldStyle, maxWidth: 220 }}
                type="number" min={1} max={3650}
                value={reviewWindows[item.id] ?? String(item.review_after_days ?? '')}
                onChange={(e) => setReviewWindows((current) => ({ ...current, [item.id]: e.target.value }))}
              />
            </label>
            {item.source_text && <blockquote style={{ margin: '7px 0', paddingLeft: 10, borderLeft: '2px solid var(--border)', fontSize: 12 }}>{item.source_text}</blockquote>}
            {item.assertion_status !== 'accepted' && item.assertion_status !== 'rejected' && item.assertion_status !== 'superseded' &&
              <button type="button" style={buttonStyle} onClick={() => void markReviewed(item)}>Mark as caregiver-reviewed</button>}
          </article>
        })}
      </div>


      <div style={cardStyle}>
        <h3 style={{ fontSize: 15, marginTop: 0 }}>Competing reports</h3>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>SolenOS preserves competing reports and does not pick a winner. Resolution requires a human explanation; resolving the conflict does not delete the source reports.</p>
        {data.contradictions.length === 0 ? <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>There are no conflicting reports available in this record yet.</p> : data.contradictions.map((item) =>
          <article key={item.id} style={{ borderTop: '1px solid var(--border)', padding: '10px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <strong>{item.field}</strong><span style={{ fontSize: 12 }}>{item.resolution_status.replace(/_/g, ' ')}</span>
            </div>
            <p style={{ fontSize: 13 }}>{item.description}</p>
            {(item.event_id || item.context_key || item.effective_from || item.effective_to) && <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              Match scope: event {item.event_id || 'not specified'} · context {item.context_key || 'not specified'} · effective {item.effective_from || 'start unknown'} to {item.effective_to || 'end unknown'}
            </p>}
            <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              Source assertion IDs: {(item.source_assertion_ids || []).join(', ') || 'Not linked'} · Evidence IDs: {(item.evidence_ids || []).join(', ') || 'None attached'}
            </p>
            {(item.matching_candidate_ids || []).length > 0 && <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Potential related conflicts: {(item.matching_candidate_ids || []).join(', ')}. These are match candidates only; records remain separate until reviewed.</p>}
            {item.resolution_notes && <p style={{ fontSize: 12 }}>Latest review note: {item.resolution_notes}</p>}
            <button type="button" style={buttonStyle} onClick={() => void loadResolutionHistory(item)} disabled={resolutionHistoryLoadingId === item.id}>
              {resolutionHistoryLoadingId === item.id ? 'Loading resolution history…' : 'View resolution history'}
            </button>
            {resolutionHistoryErrors[item.id] && <p role="alert" style={{ fontSize: 12 }}>{resolutionHistoryErrors[item.id]}</p>}
            {resolutionHistoryById[item.id] && (
              <ol style={{ paddingLeft: 20 }}>
                {resolutionHistoryById[item.id].map(event => <li key={event.id} style={{ fontSize: 12, marginTop: 6 }}>
                  {event.previous_status.replace(/_/g, ' ')} → {event.new_status.replace(/_/g, ' ')} · {event.created_at ? new Date(event.created_at).toLocaleString() : 'Time not recorded'}
                  <p>{event.rationale}</p>
                  <small>Evidence IDs: {event.evidence_ids.length ? event.evidence_ids.join(', ') : 'None attached'} · Reviewer: {event.actor_caregiver_id || 'Not recorded'}</small>
                </li>)}
              </ol>
            )}
            <label style={{ display: 'block', fontSize: 12 }}>Review rationale
              <textarea style={{ ...fieldStyle, minHeight: 54 }} value={resolutionNotes[item.id] || ''} onChange={(e) => setResolutionNotes((current) => ({ ...current, [item.id]: e.target.value }))} />
            </label>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 8 }}>
              {item.resolution_status === 'unresolved' || item.resolution_status === 'reopened' ? <>
                <button type="button" style={buttonStyle} onClick={() => void resolveContradiction(item, 'resolved')}>Resolve with rationale</button>
                <button type="button" style={buttonStyle} onClick={() => void resolveContradiction(item, 'partially_resolved')}>Partially resolve / retain uncertainty</button>
                <button type="button" style={buttonStyle} onClick={() => void resolveContradiction(item, 'superseded')}>Superseded by new evidence</button>
              </> : <button type="button" style={buttonStyle} onClick={() => void resolveContradiction(item, 'reopened')}>Reopen conflict</button>}
            </div>
          </article>
        )}
      </div>

      <div style={cardStyle}>
        <h3 style={{ fontSize: 15, marginTop: 0 }}>Next questions</h3>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Questions are linked to recorded uncertainty, unresolved reports, or missing information. They do not diagnose or resolve a conflict.</p>
        {data.questions.length === 0 ? <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>There are no recorded questions to review yet.</p> : data.questions.map((item, index) => {
          const actionId = item.persisted_question_id || item.source_id
          return <article key={item.persisted_question_id || item.source_id || index} style={{ borderTop: '1px solid var(--border)', padding: '10px 0' }}>
            <strong style={{ fontSize: 14 }}>{item.question}</strong>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Priority: {item.priority} · Trigger: {item.source_kind} · Evidence: {item.evidence_ids.length ? item.evidence_ids.join(', ') : 'No evidence IDs attached'} · linked records: {item.source_ids?.join(', ') || item.source_id}</p>
            <p style={{ fontSize: 12 }}>{item.reason}</p>
            <label style={{ display: 'block', fontSize: 12 }}>Correction (required only if recording “Corrected”)
              <textarea style={{ ...fieldStyle, minHeight: 50 }} value={corrections[actionId] || ''} onChange={(e) => setCorrections((current) => ({ ...current, [actionId]: e.target.value }))} />
            </label>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 8 }}>
              <button type="button" style={buttonStyle} onClick={() => void recordOutcome(item, 'useful')}>Useful</button>
              <button type="button" style={buttonStyle} onClick={() => void recordOutcome(item, 'completed')}>Completed</button>
              <button type="button" style={buttonStyle} onClick={() => void recordOutcome(item, 'unresolved')}>Still unresolved</button>
              <button type="button" style={buttonStyle} onClick={() => void recordOutcome(item, 'not_useful')}>Not useful</button>
              <button type="button" style={buttonStyle} onClick={() => void recordOutcome(item, 'corrected')}>Record correction</button>
            </div>
          </article>
        })}
      </div>

      <div style={cardStyle}>
        <h3 style={{ fontSize: 15, marginTop: 0 }}>Record history</h3>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>A history of how recorded care information has changed over time.</p>
        {data.revisions.length === 0 ? <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No changes to the saved care information are available yet.</p> : data.revisions.slice(0, 20).map((item) =>
          <details key={item.id} style={{ borderTop: '1px solid var(--border)', padding: '9px 0' }}>
            <summary style={{ cursor: 'pointer', fontSize: 13 }}>
              {item.target_type.replace(/_/g, ' ')} · version {item.revision_number} · {item.change_kind.replace(/_/g, ' ')} · {new Date(item.changed_at).toLocaleString()}
            </summary>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8, marginTop: 8 }}>
              <div><strong style={{ fontSize: 12 }}>Before</strong><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 11 }}>{JSON.stringify(item.before_state, null, 2) || 'No prior state (creation)'}</pre></div>
              <div><strong style={{ fontSize: 12 }}>After</strong><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 11 }}>{JSON.stringify(item.after_state, null, 2) || 'No current state (deletion)'}</pre></div>
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Evidence IDs: {item.evidence_ids.length ? item.evidence_ids.join(', ') : 'None attached to this state record'}</p>
          </details>
        )}
      </div>

      <div style={cardStyle}>
        <h3 style={{ fontSize: 15, marginTop: 0 }}>Recorded outcomes and corrections</h3>
        {data.outcomes.length === 0 ? <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No recorded outcomes are available yet.</p> : data.outcomes.slice(0, 20).map((item) =>
          <div key={item.id} style={{ borderTop: '1px solid var(--border)', padding: '8px 0', fontSize: 12 }}>
            <strong>{item.outcome_status.replace(/_/g, ' ')}</strong> · {item.action_id} · {new Date(item.created_at).toLocaleString()}
            {item.notes && <p>{item.notes}</p>}{item.correction_text && <p><strong>Recorded correction:</strong> {item.correction_text}</p>}
          </div>
        )}
      </div>
    </section>
  )
}
