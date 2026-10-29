import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { ensureAnonymousSession, getJSON, postJSON } from '../api/client'

type EvidenceItem = {
  id: string
  type: string
  evidence_kind?: string | null
  epistemic_status?: string | null
  source_text: string
  uploaded_at: string
  uploaded_by_caregiver_id?: string | null
  original_author?: string | null
  reported_by_label?: string | null
  reported_by_caregiver_id?: string | null
  collected_by_caregiver_id?: string | null
  collected_at?: string | null
  occurred_at?: string | null
  occurred_at_timezone?: string | null
  origin_channel?: string | null
  original_source_reference?: string | null
  parent_evidence_id?: string | null
  source_text_sha256?: string | null
  ingested_at?: string | null
}
type ReviewType = 'quality' | 'reliability' | 'source_confidence' | 'freshness' | 'completeness'
type SourceIntegrity = {
  evidence_id: string
  person_id: string
  source_text_integrity_status: 'match' | 'mismatch' | 'unavailable'
  stored_source_text_sha256: string | null
  recomputed_source_text_sha256: string | null
  hash_scope: string
  original_file_authenticity_verified: false
}
type Observation = {
  id: string
  evidence_id: string
  supersedes_observation_id?: string | null
  correction_rationale?: string | null
  observation_kind: string
  epistemic_status: string
  subject_label: string
  attribute: string
  value_text?: string | null
  units?: string | null
  source_passage: string
  source_span_start: number
  source_span_end: number
  negated?: boolean | null
  hedge_marker?: string | null
  ambiguity_note?: string | null
  observer_label?: string | null
  observation_method?: string | null
  recorded_at: string
}
type SourceRelationship = {
  id: string
  source_evidence_id: string
  related_evidence_id: string
  relationship_type: string
  source_independence_status: string
  origin_group_key?: string | null
  rationale: string
  reviewed_by_caregiver_id?: string | null
  created_at: string
}
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
  const [sourceIntegrity, setSourceIntegrity] = useState<SourceIntegrity | null>(null)
  const [sourceIntegrityError, setSourceIntegrityError] = useState('')
  const [sourceIntegrityLoading, setSourceIntegrityLoading] = useState(false)
  const [relationships, setRelationships] = useState<SourceRelationship[]>([])
  const [relationshipsLoading, setRelationshipsLoading] = useState(false)
  const [relationshipsError, setRelationshipsError] = useState('')
  const [relatedEvidenceId, setRelatedEvidenceId] = useState('')
  const [relationshipType, setRelationshipType] = useState('forwarded_from')
  const [independenceStatus, setIndependenceStatus] = useState('shared_origin')
  const [originGroupKey, setOriginGroupKey] = useState('')
  const [relationshipRationale, setRelationshipRationale] = useState('')
  const [relationshipSaving, setRelationshipSaving] = useState(false)
  const [observations, setObservations] = useState<Observation[]>([])
  const [observationsLoading, setObservationsLoading] = useState(false)
  const [observationsError, setObservationsError] = useState('')
  const [observationKind, setObservationKind] = useState('caregiver_report')
  const [observationStatus, setObservationStatus] = useState('reported')
  const [observationSubject, setObservationSubject] = useState('')
  const [observationAttribute, setObservationAttribute] = useState('')
  const [observationValue, setObservationValue] = useState('')
  const [observationPassage, setObservationPassage] = useState('')
  const [observationUnits, setObservationUnits] = useState('')
  const [observationNegated, setObservationNegated] = useState('unknown')
  const [observationHedge, setObservationHedge] = useState('')
  const [observationAmbiguity, setObservationAmbiguity] = useState('')
  const [observationObserver, setObservationObserver] = useState('')
  const [observationMethod, setObservationMethod] = useState('')
  const [observationSaving, setObservationSaving] = useState(false)
  const [observationSupersedesId, setObservationSupersedesId] = useState('')
  const [observationCorrectionRationale, setObservationCorrectionRationale] = useState('')

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
  const [historyUnavailable, setHistoryUnavailable] = useState(false)
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
    setHistoryUnavailable(false)
    try {
      const result = await getJSON(`/care-continuity/evidence/${encodeURIComponent(selectedId)}/reviews`)
      if (!Array.isArray(result)) throw new Error('Invalid review response')
      setReviews(result as Review[])
    } catch {
      setReviews([])
      setHistoryUnavailable(true)
      setError('Saved evidence reviews could not be loaded. Check the connection and retry; no review history is assumed.')
    } finally {
      setLoading(false)
    }
  }, [personId, selectedId])

  useEffect(() => { void loadReviews() }, [loadReviews])

  const loadSourceIntegrity = useCallback(async () => {
    if (!selectedId || !personId) {
      setSourceIntegrity(null)
      setSourceIntegrityError('')
      return
    }
    setSourceIntegrityLoading(true)
    setSourceIntegrityError('')
    try {
      const result = await getJSON(`/care-continuity/evidence/${encodeURIComponent(selectedId)}/integrity`)
      if (!result || result.evidence_id !== selectedId || result.person_id !== personId ||
          !['match', 'mismatch', 'unavailable'].includes(result.source_text_integrity_status) ||
          typeof result.hash_scope !== 'string' || result.original_file_authenticity_verified !== false) {
        throw new Error('Invalid source-integrity response')
      }
      setSourceIntegrity(result as SourceIntegrity)
    } catch {
      setSourceIntegrity(null)
      setSourceIntegrityError('Source-text integrity could not be checked. This is not evidence of a match; retry when connected.')
    } finally {
      setSourceIntegrityLoading(false)
    }
  }, [personId, selectedId])

  useEffect(() => { void loadSourceIntegrity() }, [loadSourceIntegrity])

  const loadRelationships = useCallback(async () => {
    if (!selectedId || !personId) {
      setRelationships([])
      setRelationshipsError('')
      return
    }
    setRelationshipsLoading(true)
    setRelationshipsError('')
    try {
      const result = await getJSON(`/care-continuity/evidence/${encodeURIComponent(selectedId)}/relationships`)
      if (!Array.isArray(result) || result.some((item) =>
        item?.person_id !== personId || typeof item?.id !== 'string' ||
        ![selectedId].includes(item?.source_evidence_id) && ![selectedId].includes(item?.related_evidence_id))) {
        throw new Error('Invalid evidence relationship response')
      }
      setRelationships(result as SourceRelationship[])
    } catch {
      setRelationships([])
      setRelationshipsError('Source lineage could not be loaded. No relationship list is assumed; retry when connected.')
    } finally {
      setRelationshipsLoading(false)
    }
  }, [personId, selectedId])

  useEffect(() => { void loadRelationships() }, [loadRelationships])

  const loadObservations = useCallback(async () => {
    if (!selectedId || !personId) {
      setObservations([])
      setObservationsError('')
      return
    }
    setObservationsLoading(true)
    setObservationsError('')
    try {
      const result = await getJSON(`/care-continuity/evidence/${encodeURIComponent(selectedId)}/observations`)
      if (!Array.isArray(result) || result.some(item =>
        item?.person_id !== personId || item?.evidence_id !== selectedId ||
        typeof item?.source_passage !== 'string' || typeof item?.source_span_start !== 'number' ||
        typeof item?.source_span_end !== 'number')) throw new Error('Invalid observation response')
      setObservations(result as Observation[])
    } catch {
      setObservations([])
      setObservationsError('Structured observations could not be loaded. No observation list is assumed; retry when connected.')
    } finally {
      setObservationsLoading(false)
    }
  }, [personId, selectedId])

  useEffect(() => { void loadObservations() }, [loadObservations])

  async function submitObservation() {
    if (!selected || !observationSubject.trim() || !observationAttribute.trim() || !observationPassage) {
      setObservationsError('Provide a subject, attribute, and exact passage copied from the original evidence.')
      return
    }
    if (observationSupersedesId && observationCorrectionRationale.trim().length < 3) {
      setObservationsError('A correction must state why the earlier observation is being superseded.')
      return
    }
    if (!['unknown', 'missing'].includes(observationStatus) && !observationValue.trim()) {
      setObservationsError('Provide a recorded value, or explicitly choose unknown/missing.')
      return
    }
    setObservationSaving(true)
    setObservationsError('')
    try {
      await postJSON(`/care-continuity/evidence/${encodeURIComponent(selected.id)}/observations`, {
        observation_kind: observationKind,
        epistemic_status: observationStatus,
        subject_label: observationSubject.trim(),
        attribute: observationAttribute.trim(),
        value_text: ['unknown', 'missing'].includes(observationStatus) ? null : observationValue.trim(),
        source_passage: observationPassage,
        units: observationUnits.trim() || null,
        negated: observationNegated === 'unknown' ? null : observationNegated === 'yes',
        hedge_marker: observationHedge.trim() || null,
        ambiguity_note: observationAmbiguity.trim() || null,
        observer_label: observationObserver.trim() || null,
        observation_method: observationMethod.trim() || null,
        extraction_method: 'human_entered',
        extraction_version: 'manual-v1',
        supersedes_observation_id: observationSupersedesId || null,
        correction_rationale: observationCorrectionRationale.trim() || null,
      })
      setObservationValue('')
      setObservationPassage('')
      setObservationAmbiguity('')
      setObservationSupersedesId('')
      setObservationCorrectionRationale('')
      await loadObservations()
    } catch {
      setObservationsError('The observation was not confirmed as saved. The API requires an exact source passage and valid epistemic classification.')
    } finally {
      setObservationSaving(false)
    }
  }

  async function submitRelationship() {
    if (!selected || !relatedEvidenceId || relatedEvidenceId === selected.id || relationshipRationale.trim().length < 3) {
      setRelationshipsError('Choose a different evidence item and provide a relationship rationale.')
      return
    }
    setRelationshipSaving(true)
    setRelationshipsError('')
    try {
      await postJSON(`/care-continuity/evidence/${encodeURIComponent(selected.id)}/relationships`, {
        related_evidence_id: relatedEvidenceId,
        relationship_type: relationshipType,
        source_independence_status: independenceStatus,
        origin_group_key: originGroupKey.trim() || null,
        rationale: relationshipRationale.trim(),
      })
      setRelationshipRationale('')
      setRelationshipsError('')
      await loadRelationships()
    } catch {
      setRelationshipsError('The source relationship was not confirmed as saved. Check the connection and retry.')
    } finally {
      setRelationshipSaving(false)
    }
  }

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
      {selected && <>
        <blockquote style={{ margin: '8px 0 12px', paddingLeft: 10, borderLeft: '2px solid var(--border)', fontSize: 12, overflowWrap: 'anywhere' }}>{selected.source_text}</blockquote>
        <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, margin: '8px 0 12px', fontSize: 12 }}>
          <div><dt style={{ color: 'var(--text-secondary)' }}>Source category</dt><dd style={{ margin: 0 }}>{selected.type || 'Not recorded'}</dd></div>
          <div><dt style={{ color: 'var(--text-secondary)' }}>Evidence kind</dt><dd style={{ margin: 0 }}>{selected.evidence_kind?.replaceAll('_', ' ') || 'Not classified'}</dd></div>
          <div><dt style={{ color: 'var(--text-secondary)' }}>Epistemic status</dt><dd style={{ margin: 0 }}>{selected.epistemic_status?.replaceAll('_', ' ') || 'Not assessed'}</dd></div>
          <div><dt style={{ color: 'var(--text-secondary)' }}>Uploaded by</dt><dd style={{ margin: 0, overflowWrap: 'anywhere' }}>{selected.uploaded_by_caregiver_id || 'Not recorded'}</dd></div>
          <div><dt style={{ color: 'var(--text-secondary)' }}>Original author</dt><dd style={{ margin: 0, overflowWrap: 'anywhere' }}>{selected.original_author || 'Not recorded'}</dd></div>
          <div><dt style={{ color: 'var(--text-secondary)' }}>Reported by</dt><dd style={{ margin: 0, overflowWrap: 'anywhere' }}>{[selected.reported_by_label, selected.reported_by_caregiver_id].filter(Boolean).join(' · ') || 'Not recorded'}</dd></div>
          <div><dt style={{ color: 'var(--text-secondary)' }}>Collected by</dt><dd style={{ margin: 0, overflowWrap: 'anywhere' }}>{selected.collected_by_caregiver_id || 'Not recorded'}</dd></div>
          <div><dt style={{ color: 'var(--text-secondary)' }}>Event time</dt><dd style={{ margin: 0 }}>{selected.occurred_at ? new Date(selected.occurred_at).toLocaleString() : 'Not recorded'}{selected.occurred_at_timezone ? ` · ${selected.occurred_at_timezone}` : ''}</dd></div>
          <div><dt style={{ color: 'var(--text-secondary)' }}>Collected at</dt><dd style={{ margin: 0 }}>{selected.collected_at ? new Date(selected.collected_at).toLocaleString() : 'Not recorded'}</dd></div>
          <div><dt style={{ color: 'var(--text-secondary)' }}>Uploaded at</dt><dd style={{ margin: 0 }}>{selected.uploaded_at ? new Date(selected.uploaded_at).toLocaleString() : 'Not recorded'}</dd></div>
          <div><dt style={{ color: 'var(--text-secondary)' }}>Ingested at</dt><dd style={{ margin: 0 }}>{selected.ingested_at ? new Date(selected.ingested_at).toLocaleString() : 'Not recorded'}</dd></div>
          <div><dt style={{ color: 'var(--text-secondary)' }}>Origin channel</dt><dd style={{ margin: 0 }}>{selected.origin_channel || 'Not recorded'}</dd></div>
          <div><dt style={{ color: 'var(--text-secondary)' }}>Original source reference</dt><dd style={{ margin: 0, overflowWrap: 'anywhere' }}>{selected.original_source_reference || 'Not recorded'}</dd></div>
          <div><dt style={{ color: 'var(--text-secondary)' }}>Parent evidence</dt><dd style={{ margin: 0, overflowWrap: 'anywhere' }}>{selected.parent_evidence_id || 'None recorded'}</dd></div>
        </dl>
        <details style={{ fontSize: 12, marginBottom: 12 }}>
          <summary>Source lineage and corroboration relationships ({relationships.length})</summary>
          <p>Relationships are explicit, attributed assessments—not automatic proof that sources are independent or that a claim is true.</p>
          {relationshipsLoading && <p role="status">Loading source relationships…</p>}
          {relationshipsError && <p role="alert" style={{ color: 'var(--error)' }}>{relationshipsError} <button type="button" style={button} onClick={() => void loadRelationships()} disabled={relationshipsLoading}>Retry</button></p>}
          {!relationshipsLoading && !relationshipsError && relationships.length === 0 && <p>No source relationships were returned for this evidence item.</p>}
          {relationships.map(item => <article key={item.id} style={{ borderTop: '1px solid var(--border)', padding: '8px 0' }}>
            <strong>{item.relationship_type.replaceAll('_', ' ')}</strong>
            <div>Evidence {item.source_evidence_id} → related evidence {item.related_evidence_id}</div>
            <div>Independence: {item.source_independence_status.replaceAll('_', ' ')}{item.origin_group_key ? ` · origin group ${item.origin_group_key}` : ''}</div>
            <p>{item.rationale}</p>
            <small>Reviewed by {item.reviewed_by_caregiver_id || 'identity unavailable'} · {new Date(item.created_at).toLocaleString()}</small>
          </article>)}
          <label style={{ display: 'block', marginTop: 9 }}>Related evidence
            <select style={field} value={relatedEvidenceId} onChange={event => setRelatedEvidenceId(event.target.value)}>
              <option value="">Choose a separate evidence record</option>
              {evidenceItems.filter(item => item.id !== selected.id).map(item => <option key={item.id} value={item.id}>{item.type} · {item.id}</option>)}
            </select>
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, marginTop: 8 }}>
            <label>Relationship type
              <select style={field} value={relationshipType} onChange={event => {
                const next = event.target.value
                setRelationshipType(next)
                if (['copied_from', 'forwarded_from', 'derived_from', 'same_origin'].includes(next)) setIndependenceStatus('shared_origin')
              }}>
                <option value="same_origin">Same origin</option><option value="copied_from">Copied from</option>
                <option value="forwarded_from">Forwarded from</option><option value="derived_from">Derived from</option>
                <option value="corroborates">Corroborates</option><option value="contradicts">Contradicts</option>
                <option value="duplicates">Duplicate candidate</option><option value="related_to">Related to</option>
              </select>
            </label>
            <label>Source independence
              <select style={field} value={independenceStatus} onChange={event => setIndependenceStatus(event.target.value)}>
                <option value="shared_origin">Shared origin / dependent</option><option value="independent">Independent (reviewed)</option>
                <option value="unknown">Unknown</option><option value="not_assessed">Not assessed</option>
              </select>
            </label>
          </div>
          <label style={{ display: 'block', marginTop: 8 }}>Origin group key (optional)
            <input style={field} value={originGroupKey} onChange={event => setOriginGroupKey(event.target.value)} maxLength={128} placeholder="Identifier shared by copied or forwarded material" />
          </label>
          <label style={{ display: 'block', marginTop: 8 }}>Why these items are related
            <textarea style={{ ...field, minHeight: 58 }} value={relationshipRationale} onChange={event => setRelationshipRationale(event.target.value)} />
          </label>
          <button type="button" style={{ ...button, marginTop: 8 }} onClick={() => void submitRelationship()} disabled={relationshipSaving || relationshipsLoading || !selected || !relatedEvidenceId}>{relationshipSaving ? 'Saving…' : 'Save source relationship'}</button>
        </details>
        <details style={{ fontSize: 12, marginBottom: 12 }}>
          <summary>Structured source-grounded observations ({observations.length})</summary>
          <p>Each observation preserves an exact passage from the original source. A reported account remains reported; an inferred interpretation is not a directly observed fact.</p>
          {observationsLoading && <p role="status">Loading structured observations…</p>}
          {observationsError && <p role="alert" style={{ color: 'var(--error)' }}>{observationsError} <button type="button" style={button} onClick={() => void loadObservations()} disabled={observationsLoading}>Retry</button></p>}
          {!observationsLoading && !observationsError && observations.length === 0 && <p>No structured observations were returned for this evidence.</p>}
          {observations.map(item => <article key={item.id} style={{ borderTop: '1px solid var(--border)', padding: '8px 0' }}>
            <strong>{item.attribute.replaceAll('_', ' ')} · {item.epistemic_status.replaceAll('_', ' ')}</strong>
            <div>{item.observation_kind.replaceAll('_', ' ')} · {item.subject_label}</div>
            <blockquote style={{ margin: '6px 0', paddingLeft: 9, borderLeft: '2px solid var(--border)', overflowWrap: 'anywhere' }}>{item.source_passage}</blockquote>
            <div>Value: {item.value_text ?? 'Not established'}{item.units ? ` ${item.units}` : ''} · exact source offsets {item.source_span_start}–{item.source_span_end}</div>
            {item.supersedes_observation_id && <div>Corrects observation {item.supersedes_observation_id}: {item.correction_rationale || 'No correction rationale recorded'}</div>}
            {item.negated !== null && item.negated !== undefined && <div>Negation recorded: {item.negated ? 'yes' : 'no'}</div>}
            {item.hedge_marker && <div>Hedging: {item.hedge_marker}</div>}
            {item.ambiguity_note && <div>Ambiguity: {item.ambiguity_note}</div>}
            {item.observer_label && <div>Observer: {item.observer_label}{item.observation_method ? ` · ${item.observation_method}` : ''}</div>}
            <small>Recorded {new Date(item.recorded_at).toLocaleString()}</small>
          </article>)}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, marginTop: 10 }}>
            <label>Observation kind
              <select style={field} value={observationKind} onChange={event => setObservationKind(event.target.value)}>
                <option value="caregiver_report">Caregiver report</option><option value="direct_observation">Direct observation</option>
                <option value="professional_observation">Professional observation</option><option value="persons_own_report">Person's own report</option>
                <option value="documented_record">Documented record</option><option value="instrument_measurement">Instrument measurement</option>
                <option value="photo_video">Photo/video</option><option value="audio_transcript">Audio/transcript</option>
                <option value="imported_information">Imported information</option><option value="historical_recollection">Historical recollection</option>
                <option value="derived_observation">Derived observation</option><option value="inference">Inference</option><option value="hypothesis">Hypothesis</option>
              </select>
            </label>
            <label>Epistemic status
              <select style={field} value={observationStatus} onChange={event => setObservationStatus(event.target.value)}>
                <option value="reported">Reported</option><option value="observed">Observed</option><option value="inferred">Inferred</option>
                <option value="hypothesis">Hypothesis</option><option value="unknown">Unknown</option><option value="missing">Missing</option>
                <option value="disputed">Disputed</option><option value="unverified">Unverified</option><option value="superseded">Superseded</option>
              </select>
            </label>
            <label>Subject label
              <input style={field} value={observationSubject} onChange={event => setObservationSubject(event.target.value)} maxLength={160} placeholder="e.g. care recipient" />
            </label>
            <label>Attribute
              <input style={field} value={observationAttribute} onChange={event => setObservationAttribute(event.target.value)} maxLength={160} placeholder="e.g. sleep_awakenings" />
            </label>
            <label>Value (leave blank only for unknown/missing)
              <input style={field} value={observationValue} onChange={event => setObservationValue(event.target.value)} maxLength={8000} />
            </label>
            <label>Units (if applicable)
              <input style={field} value={observationUnits} onChange={event => setObservationUnits(event.target.value)} maxLength={80} />
            </label>
          </div>
          <label style={{ display: 'block', marginTop: 8 }}>Exact source passage
            <textarea style={{ ...field, minHeight: 64 }} value={observationPassage} onChange={event => setObservationPassage(event.target.value)} placeholder="Copy the exact wording from the original evidence above." />
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, marginTop: 8 }}>
            <label>Negation
              <select style={field} value={observationNegated} onChange={event => setObservationNegated(event.target.value)}>
                <option value="unknown">Not assessed</option><option value="yes">Negated</option><option value="no">Not negated</option>
              </select>
            </label>
            <label>Hedging / uncertainty wording
              <input style={field} value={observationHedge} onChange={event => setObservationHedge(event.target.value)} maxLength={120} placeholder="e.g. possibly, may have" />
            </label>
            <label>Observer (required for observed status)
              <input style={field} value={observationObserver} onChange={event => setObservationObserver(event.target.value)} placeholder="Named observer" />
            </label>
            <label>Observation method (required for observed status)
              <input style={field} value={observationMethod} onChange={event => setObservationMethod(event.target.value)} maxLength={120} placeholder="How it was observed/measured" />
            </label>
          </div>
          <label style={{ display: 'block', marginTop: 8 }}>Correct an earlier observation (optional)
            <select style={field} value={observationSupersedesId} onChange={event => setObservationSupersedesId(event.target.value)}>
              <option value="">Create a new observation, not a correction</option>
              {observations.map(item => <option key={item.id} value={item.id}>{item.attribute} · {item.epistemic_status} · {item.id}</option>)}
            </select>
          </label>
          {observationSupersedesId && <label style={{ display: 'block', marginTop: 8 }}>Correction rationale (required)
            <textarea style={{ ...field, minHeight: 52 }} value={observationCorrectionRationale} onChange={event => setObservationCorrectionRationale(event.target.value)} maxLength={4000} />
          </label>}
          <label style={{ display: 'block', marginTop: 8 }}>Ambiguity / extraction limitation
            <textarea style={{ ...field, minHeight: 52 }} value={observationAmbiguity} onChange={event => setObservationAmbiguity(event.target.value)} maxLength={4000} />
          </label>
          <button type="button" style={{ ...button, marginTop: 8 }} onClick={() => void submitObservation()} disabled={observationSaving || observationsLoading || !selected}>{observationSaving ? 'Saving…' : 'Save structured observation'}</button>
        </details>
        <details style={{ fontSize: 12, marginBottom: 12 }}>
          <summary>Stored source-text integrity check</summary>
          {sourceIntegrityLoading && <p role="status">Checking stored source text…</p>}
          {sourceIntegrityError && <p role="alert" style={{ color: 'var(--error)' }}>{sourceIntegrityError} <button type="button" style={button} onClick={() => void loadSourceIntegrity()} disabled={sourceIntegrityLoading}>Retry integrity check</button></p>}
          {!sourceIntegrityLoading && !sourceIntegrityError && sourceIntegrity && <>
            <p><strong>Stored text hash:</strong> {sourceIntegrity.source_text_integrity_status === 'match' ? 'MATCH — current stored text matches the stored fingerprint' : sourceIntegrity.source_text_integrity_status === 'mismatch' ? 'MISMATCH — stored text and fingerprint differ' : 'UNAVAILABLE — no fingerprint is stored'}</p>
            <p><strong>Hash scope:</strong> {sourceIntegrity.hash_scope}</p>
            <p style={{ overflowWrap: 'anywhere' }}><strong>Stored:</strong> {sourceIntegrity.stored_source_text_sha256 || 'Unavailable'}</p>
            <p style={{ overflowWrap: 'anywhere' }}><strong>Recomputed:</strong> {sourceIntegrity.recomputed_source_text_sha256 || 'Unavailable'}</p>
            <p><strong>Original file authenticity:</strong> Not verified by this hash check.</p>
          </>}
          {!sourceIntegrityLoading && !sourceIntegrityError && !sourceIntegrity && <p>Integrity has not been verified.</p>}
          <p style={{ overflowWrap: 'anywhere' }}>{selected.source_text_sha256 || 'Hash unavailable for this record'}</p>
          <small>The SHA-256 check covers only the stored UTF-8 text. It does not authenticate the original author or prove the authenticity of an uploaded binary.</small>
        </details>
      </>}
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
      {historyUnavailable ? <p role="status" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Review history is unavailable. An empty list cannot be inferred from a failed request.</p> : reviews.length === 0 ? <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>No saved review records were returned.</p> : reviews.map(review => <article key={review.id} style={{ borderTop: '1px solid var(--border)', padding: '9px 0', fontSize: 12 }}>
        <strong>{labels[review.review_type] || review.review_type}: {review.outcome.replace(/_/g, ' ')}</strong>
        <div>{new Date(review.created_at).toLocaleString()} · policy {review.policy_version}</div>
        <p>{review.rationale}</p>
        <ul>{review.criteria.map((criterion, index) => <li key={index}>{criterion.criterion}: {criterion.result.replace(/_/g, ' ')} — {criterion.rationale}</li>)}</ul>
        <details><summary>Source attribution snapshot</summary><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 11 }}>{JSON.stringify(review.source_attribution, null, 2)}</pre></details>
      </article>)}
    </> : null}
  </section>
}
