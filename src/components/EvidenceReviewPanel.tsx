import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { ensureAnonymousSession, getJSON, postJSON } from '../api/client'

type EvidenceItem = { id: string; type: string; source_text: string; uploaded_at: string }
type ReviewType = 'quality' | 'reliability' | 'source_confidence' | 'freshness' | 'completeness'
type Review = {
  id: string
  evidence_id: string
  review_type: ReviewType
  outcome: string
  rationale: string
  criteria: Array<{ criterion: string; result: string; rationale: string }>
  policy_version: string
  source_attribution: Record<string, unknown>
  reviewed_by_caregiver_id?: string | null
  created_at: string
}

const outcomes: Record<ReviewType, string[]> = {
  quality: ['adequate', 'limited', 'insufficient', 'undetermined'],
  reliability: ['supported', 'contested', 'unverified', 'undetermined'],
  source_confidence: ['verified', 'partially_verified', 'unverified', 'unknown'],
  freshness: ['current', 'stale', 'historical', 'undetermined'],
  completeness: ['complete', 'partial', 'missing', 'undetermined'],
}
const labels: Record<ReviewType, string> = {
  quality: 'Evidence quality',
  reliability: 'Evidence reliability',
  source_confidence: 'Source verification',
  freshness: 'Freshness',
  completeness: 'Completeness',
}
const panel: CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, padding: 14, marginTop: 12, background: 'var(--surface)' }
const field: CSSProperties = { boxSizing: 'border-box', width: '100%', padding: '9px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }
const button: CSSProperties = { border: '1px solid var(--border)', borderRadius: 7, padding: '8px 11px', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer' }

export default function EvidenceReviewPanel(_props?: { personId?: string; evidenceItems?: EvidenceItem[] }) {
  const [personId, setPersonId] = useState('')
  const [evidenceItems, setEvidenceItems] = useState<EvidenceItem[]>([])
  const [evidenceLoading, setEvidenceLoading] = useState(true)
  const [evidenceError, setEvidenceError] = useState('')

  const loadEvidence = useCallback(async () => {
    setEvidenceLoading(true)
    setEvidenceError('')
    try {
      const session = await ensureAnonymousSession()
      if (!session.person?.id) throw new Error('Missing scoped person identity')
      const result = await getJSON('/care-continuity/evidence?limit=100')
      if (!Array.isArray(result) || result.some((item) => item?.person_id !== session.person.id || typeof item?.id !== 'string' || typeof item?.source_text !== 'string')) {
        throw new Error('Evidence response is not valid for this care record')
      }
      setPersonId(session.person.id)
      setEvidenceItems(result as EvidenceItem[])
    } catch {
      setPersonId('')
      setEvidenceItems([])
      setEvidenceError('Evidence records could not be loaded from the care record. No evidence list is assumed; retry when the connection is available.')
    } finally {
      setEvidenceLoading(false)
    }
  }, [])

  useEffect(() => { void loadEvidence() }, [loadEvidence])
  const [selectedId, setSelectedId] = useState('')
  const [reviewType, setReviewType] = useState<ReviewType>('reliability')
  const [outcome, setOutcome] = useState('unverified')
  const [rationale, setRationale] = useState('')
  const [sourceResult, setSourceResult] = useState('not_assessed')
  const [corroborationResult, setCorroborationResult] = useState('not_assessed')
  const [temporalResult, setTemporalResult] = useState('not_assessed')
  const [freshnessResult, setFreshnessResult] = useState('not_assessed')
  const [completenessResult, setCompletenessResult] = useState('not_assessed')
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const selected = useMemo(() => evidenceItems.find(item => item.id === selectedId), [evidenceItems, selectedId])

  useEffect(() => {
    if (!selectedId && evidenceItems.length) setSelectedId(evidenceItems[0].id)
    if (selectedId && !evidenceItems.some(item => item.id === selectedId)) setSelectedId(evidenceItems[0]?.id || '')
  }, [evidenceItems, selectedId])

  const loadReviews = useCallback(async () => {
    if (!selectedId || !personId) { setReviews([]); return }
    setLoading(true)
    setError('')
    try {
      const result = await getJSON(`/care-continuity/evidence/${encodeURIComponent(selectedId)}/reviews`)
      if (!Array.isArray(result)) throw new Error('Invalid review response')
      setReviews(result as Review[])
    } catch {
      setReviews([])
      setError('Saved evidence reviews could not be loaded. Check the connection and retry; no review history is assumed.')
    } finally {
      setLoading(false)
    }
  }, [personId, selectedId])

  useEffect(() => { void loadReviews() }, [loadReviews])

  function changeReviewType(next: ReviewType) {
    setReviewType(next)
    setOutcome(outcomes[next][0])
  }

  async function submit() {
    if (!selected || !rationale.trim()) {
      setError('Select evidence and provide a review rationale before saving.')
      return
    }
    setSaving(true)
    setError('')
    setNotice('')
    try {
      await postJSON(`/care-continuity/evidence/${encodeURIComponent(selected.id)}/reviews`, {
        review_type: reviewType,
        outcome,
        rationale: rationale.trim(),
        policy_version: 'evidence-review-v1',
        criteria: [
          { criterion: 'source attribution', result: sourceResult, rationale: 'Review of the persisted source identity and attribution fields.' },
          { criterion: 'independent corroboration', result: corroborationResult, rationale: 'Review of whether linked material represents an independent source.' },
          { criterion: 'temporal context', result: temporalResult, rationale: 'Review of whether the source timing and event timing are sufficiently specified.' },
          { criterion: 'evidence freshness', result: freshnessResult, rationale: 'Review of whether the evidence remains current for the relevant care question.' },
          { criterion: 'record completeness', result: completenessResult, rationale: 'Review of whether the source record contains the information needed for this assessment.' },
        ],
      })
      setRationale('')
      setNotice('Review saved to the care record. It does not overwrite the source evidence or automatically establish a clinical fact.')
      await loadReviews()
    } catch {
      setError('The review was not confirmed as saved. Check the connection and retry; the source evidence remains unchanged.')
    } finally {
      setSaving(false)
    }
  }

  if (!personId && !evidenceLoading && !evidenceError) return null
  return <section style={panel} aria-label="Persisted evidence assessments">
    <h3 style={{ fontSize: 15, marginTop: 0 }}>Evidence quality and source review</h3>
    {evidenceError && <p role="alert" style={{ color: 'var(--error)', fontSize: 12 }}>{evidenceError} <button type="button" style={button} onClick={() => void loadEvidence()} disabled={evidenceLoading}>Retry evidence load</button></p>}
    {evidenceLoading && <p role="status" style={{ fontSize: 12 }}>Loading persisted evidence…</p>}
    <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Assessments are versioned records with a rationale. They do not assign numeric confidence or turn a caregiver report into independently verified evidence.</p>
    {!evidenceLoading && !evidenceError && evidenceItems.length === 0 ? <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No evidence records were returned for this care record.</p> : evidenceItems.length > 0 ? <>
      <label style={{ display: 'block', fontSize: 12, marginBottom: 9 }}>Evidence record
        <select style={field} value={selectedId} onChange={event => setSelectedId(event.target.value)}>
          {evidenceItems.map(item => <option key={item.id} value={item.id}>{item.type} · {item.id}</option>)}
        </select>
      </label>
      {selected && <blockquote style={{ margin: '8px 0 12px', paddingLeft: 10, borderLeft: '2px solid var(--border)', fontSize: 12, overflowWrap: 'anywhere' }}>{selected.source_text}</blockquote>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 9 }}>
        <label style={{ fontSize: 12 }}>Review dimension
          <select style={field} value={reviewType} onChange={event => changeReviewType(event.target.value as ReviewType)}>
            {(Object.keys(labels) as ReviewType[]).map(key => <option key={key} value={key}>{labels[key]}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 12 }}>Outcome
          <select style={field} value={outcome} onChange={event => setOutcome(event.target.value)}>
            {outcomes[reviewType].map(value => <option key={value} value={value}>{value.replace(/_/g, ' ')}</option>)}
          </select>
        </label>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 9, marginTop: 9 }}>
        <label style={{ fontSize: 12 }}>Source attribution
          <select style={field} value={sourceResult} onChange={event => setSourceResult(event.target.value)}>
            <option value="not_assessed">Not assessed</option><option value="present">Present</option><option value="incomplete">Incomplete</option><option value="unverified">Unverified</option>
          </select>
        </label>
        <label style={{ fontSize: 12 }}>Independent corroboration
          <select style={field} value={corroborationResult} onChange={event => setCorroborationResult(event.target.value)}>
            <option value="not_assessed">Not assessed</option><option value="independent_source_linked">Independent source linked</option><option value="copied_or_same_origin">Copied / same origin</option><option value="none_linked">None linked</option>
          </select>
        </label>
        <label style={{ fontSize: 12 }}>Temporal context
          <select style={field} value={temporalResult} onChange={event => setTemporalResult(event.target.value)}>
            <option value="not_assessed">Not assessed</option><option value="specified">Specified</option><option value="partial">Partial</option><option value="missing">Missing</option><option value="conflicting">Conflicting</option>
          </select>
        </label>
        <label style={{ fontSize: 12 }}>Evidence freshness
          <select style={field} value={freshnessResult} onChange={event => setFreshnessResult(event.target.value)}>
            <option value="not_assessed">Not assessed</option><option value="current">Current</option><option value="stale">Stale</option><option value="historical">Historical</option><option value="undetermined">Undetermined</option>
          </select>
        </label>
        <label style={{ fontSize: 12 }}>Record completeness
          <select style={field} value={completenessResult} onChange={event => setCompletenessResult(event.target.value)}>
            <option value="not_assessed">Not assessed</option><option value="complete">Complete</option><option value="partial">Partial</option><option value="missing">Missing</option><option value="undetermined">Undetermined</option>
          </select>
        </label>
      </div>
      <label style={{ display: 'block', fontSize: 12, marginTop: 9 }}>Review rationale
        <textarea style={{ ...field, minHeight: 70 }} value={rationale} onChange={event => setRationale(event.target.value)} />
      </label>
      <button type="button" style={{ ...button, marginTop: 9 }} onClick={() => void submit()} disabled={saving || loading || !selected}>{saving ? 'Saving…' : 'Save evidence review'}</button>
      <button type="button" style={{ ...button, marginTop: 9, marginLeft: 8 }} onClick={() => void loadReviews()} disabled={loading}>{loading ? 'Loading…' : 'Refresh review history'}</button>
      {error && <p role="alert" style={{ color: 'var(--error)', fontSize: 12 }}>{error}</p>}
      {notice && <p role="status" style={{ fontSize: 12 }}>{notice}</p>}
      <h4 style={{ fontSize: 13, marginBottom: 5 }}>Persisted review history</h4>
      {reviews.length === 0 ? <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>No saved review records were returned.</p> : reviews.map(review => <article key={review.id} style={{ borderTop: '1px solid var(--border)', padding: '9px 0', fontSize: 12 }}>
        <strong>{labels[review.review_type] || review.review_type}: {review.outcome.replace(/_/g, ' ')}</strong>
        <div>{new Date(review.created_at).toLocaleString()} · policy {review.policy_version}</div>
        <p>{review.rationale}</p>
        <ul>{review.criteria.map((criterion, index) => <li key={index}>{criterion.criterion}: {criterion.result.replace(/_/g, ' ')} — {criterion.rationale}</li>)}</ul>
        <details><summary>Source attribution snapshot</summary><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 11 }}>{JSON.stringify(review.source_attribution, null, 2)}</pre></details>
      </article>)}
    </> : null}
  </section>
}
