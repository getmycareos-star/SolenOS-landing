import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { getJSON, patchJSON, getCaregiverId } from '../api/client'
import { caregiverFieldLabel, caregiverInformationLabel, caregiverReadableCaptureText, caregiverSourceText, caregiverSafeGeneratedText } from '@/lib/caregiver-language'

type Assertion = {
  id: string
  field: string
  assertion_kind: 'current_state' | 'time_bound_observation'
  asserted_value: string
  source_event_id?: string | null
  source_label: string
  source_text?: string | null
  evidence_ids: string[]
  epistemic_state: string
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
  revisions: Revision[]
  outcomes: Outcome[]
}

const emptyData: PanelData = { assertions: [], freshness: [], revisions: [], outcomes: [] }
const INTERNAL_REVISION_TARGET_TYPES = new Set([
  "baselines",
  "changes",
  "uncertainty_assessments",
  "patterns",
  "significance_assessments",
  "change_confirmations",
  "care_attention_assessments",
  "situation_assessments",
])
function simpleRecordLabel(value?: string | null): string {
  if (!value) return "Not recorded";
  return ({
    current: "Still applies", 
    stale: "May be out of date",
    historical: "Older information",
    undetermined: "Not sure yet", 
    unknown: "Not sure yet", 
    not_assessed: "Not checked",
    reported: "Reported by caregiver",
    observed: "Seen by a caregiver", 
    verified: "Checked against another note or report", 
    inferred: "Possible explanation", 
    uncertain: "Not sure yet", 
    conflicting: "Reports do not match", 
    missing: "Not recorded", 
    accepted: "Reviewed",
    rejected: "Not accepted",
    withdrawn: "Withdrawn by caregiver",
    retracted: "Withdrawn from the current care picture",
    superseded: "Replaced by newer information",
    created: "Added",
    updated: "Updated",
    corrected: "Corrected",
    deleted: "Removed",
    restored: "Restored",
    current_state: "Current care information",
    time_bound_observation: "Information for a specific time",
    within_review_window: "Recently checked",
    needs_confirmation: "Needs a fresh check", 
    historical_observation: "Earlier observation",
  } as Record<string, string>)[value] ?? "Status not available";
}

const cardStyle: CSSProperties = {
  border: '1px solid var(--border)', borderRadius: 10, padding: 14,
  background: 'var(--surface)', marginTop: 12,
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
  const [withdrawalReasons, setWithdrawalReasons] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    if (!personId) {
      setData(emptyData)
      setError('No authorized care record is selected.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const [assertions, freshness, revisions, outcomes] = await Promise.all([
        getJSON(`/care-continuity/assertions/${encodeURIComponent(personId)}`),
        getJSON(`/care-continuity/freshness/${encodeURIComponent(personId)}`),
        getJSON(`/care-continuity/revisions/${encodeURIComponent(personId)}`),
        getJSON(`/care-continuity/outcomes/${encodeURIComponent(personId)}`),
      ])
      if (![assertions, freshness, revisions, outcomes].every(Array.isArray)) {
        throw new Error('The care-continuity API returned an incomplete response.')
      }
      setData({ assertions, freshness, revisions, outcomes })
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

  const caregiverVisibleRevisions = data.revisions.filter((item) =>
    !INTERNAL_REVISION_TARGET_TYPES.has(item.target_type.trim().toLowerCase())
  )

  async function markReviewed(assertion: Assertion) {
    setError('')
    setNotice('')
    try {
      await patchJSON(`/care-continuity/assertions/${encodeURIComponent(assertion.id)}/status`, {
        person_id: personId,
        assertion_status: 'accepted',
        updated_by_caregiver_id: getCaregiverId() || undefined,
        review_after_days: assertion.review_after_days ?? undefined,
      })
      setNotice('Marked as reviewed. This does not mean a healthcare professional has confirmed it.')
      await load()
    } catch (reason) {
      setError('We couldn’t update this review. Please try again.')
    }
  }

  async function withdrawAssertion(assertion: Assertion) {
    const reason = (withdrawalReasons[assertion.id] || '').trim()
    if (reason.length < 8 || reason.length > 1000) {
      setError('Add a reason between 8 and 1,000 characters before withdrawing this care detail.')
      return
    }
    setError('')
    setNotice('')
    try {
      await patchJSON(`/care-continuity/assertions/${encodeURIComponent(assertion.id)}/status`, {
        assertion_status: 'withdrawn',
        expected_assertion_status: assertion.assertion_status,
        reason,
      })
      setNotice('This care detail was withdrawn. Its earlier wording remains in the care history.')
      setWithdrawalReasons((current) => ({ ...current, [assertion.id]: '' }))
      window.dispatchEvent(new Event('careRecordUpdated'))
    } catch {
      setError('We couldn’t withdraw this care detail. It has not been marked as withdrawn. Refresh the care history and try again.')
    }
  }

  if (!personId) return <section style={cardStyle}><h2>Care information</h2><p>Your care information is not available right now.</p></section>

  return (
    <section aria-label="More about the care information saved here" style={{ marginTop: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: "calc(19px * var(--solenos-text-scale, 1))", margin: 0 }}>More about the care information saved here</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: "calc(13px * var(--solenos-text-scale, 1))", marginTop: 5 }}>
            See what has been shared, what still needs checking, what has changed and what happened next. A caregiver review does not mean a healthcare professional has confirmed the information.
          </p>
        </div>
        <button type="button" style={buttonStyle} onClick={() => void load()} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh care information'}
        </button>
      </div>

      {error && <p role="status" aria-live="polite" style={{ color: 'var(--error)', fontSize: "calc(13px * var(--solenos-text-scale, 1))", marginTop: 10 }}>{error}</p>}
      {notice && <p role="status" style={{ color: 'var(--text-secondary)', fontSize: "calc(13px * var(--solenos-text-scale, 1))", marginTop: 10 }}>{notice}</p>}

      <div style={cardStyle}>
        <h3 style={{ fontSize: "calc(15px * var(--solenos-text-scale, 1))", marginTop: 0 }}>Care information shared</h3>
        {data.assertions.length === 0 ? <p style={{ fontSize: "calc(13px * var(--solenos-text-scale, 1))", color: 'var(--text-secondary)' }}>No care information has been added yet.</p> : data.assertions.map((item) => {
          const fresh = freshnessById.get(item.id)
          return <article key={item.id} style={{ borderTop: '1px solid var(--border)', padding: '10px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <strong>{caregiverFieldLabel(item.field) || caregiverInformationLabel(item.field) || 'Care detail'}: {caregiverSourceText(item.asserted_value) || 'Saved care information'}</strong>
              <span style={{ fontSize: "calc(12px * var(--solenos-text-scale, 1))" }}>{fresh ? simpleRecordLabel(fresh.status) : 'Not checked'}</span>
            </div>
            <p style={{ fontSize: "calc(12px * var(--solenos-text-scale, 1))", color: 'var(--text-secondary)', margin: '5px 0' }}>
              Shared by: {caregiverSafeGeneratedText(item.source_label) || 'Not recorded'} · {simpleRecordLabel(item.assertion_kind)} · {caregiverInformationLabel(item.epistemic_state || 'reported') || 'Not yet confirmed'} · Has this been checked? {simpleRecordLabel(item.assertion_status)}
            </p>
            {fresh && <p style={{ fontSize: "calc(12px * var(--solenos-text-scale, 1))", margin: '5px 0' }}>{caregiverSafeGeneratedText(fresh.explanation) || 'No further explanation is available.'}</p>}
            {item.source_text && <><small>Original wording</small><blockquote style={{ margin: '7px 0', paddingLeft: 10, borderLeft: '2px solid var(--border)', fontSize: "calc(12px * var(--solenos-text-scale, 1))" }}>{caregiverReadableCaptureText(item.source_text) || 'The original wording is saved.'}</blockquote></>}
            {item.assertion_status !== 'accepted' && item.assertion_status !== 'caregiver_reviewed' && item.assertion_status !== 'rejected' && item.assertion_status !== 'superseded' && item.assertion_status !== 'retracted' && item.assertion_status !== 'withdrawn' && (
              item.assertion_kind !== 'current_state' || item.review_after_days != null
                ? <button type="button" style={buttonStyle} onClick={() => void markReviewed(item)}>Mark as reviewed</button>
                : <p style={{ fontSize: "calc(12px * var(--solenos-text-scale, 1))", color: 'var(--text-secondary)' }}>No date has been set for the next review.</p>
            )}
            {(item.assertion_status === 'accepted' || item.assertion_status === 'caregiver_reviewed') && (
              <div style={{ marginTop: 10, display: 'grid', gap: 7 }}>
                <label htmlFor={`withdraw-reason-${item.id}`} style={{ fontSize: "calc(12px * var(--solenos-text-scale, 1))", color: 'var(--text-secondary)' }}>Why should this care detail no longer be treated as current?</label>
                <textarea
                  id={`withdraw-reason-${item.id}`}
                  value={withdrawalReasons[item.id] || ''}
                  onChange={(event) => setWithdrawalReasons((current) => ({ ...current, [item.id]: event.target.value }))}
                  maxLength={1000}
                  rows={2}
                  placeholder="Explain what changed or why this report should be withdrawn."
                  style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 7, padding: 9, background: 'var(--surface)', color: 'var(--text)' }}
                />
                <div><button type="button" style={buttonStyle} onClick={() => void withdrawAssertion(item)}>Withdraw this care detail</button></div>
              </div>
            )}
          </article>
        })}
      </div>


      <div style={cardStyle}>
        <h3 style={{ fontSize: "calc(15px * var(--solenos-text-scale, 1))", marginTop: 0 }}>Changes to your Care Record</h3>
        <p style={{ fontSize: "calc(12px * var(--solenos-text-scale, 1))", color: 'var(--text-secondary)' }}>See when care information was added or updated.</p>
        {caregiverVisibleRevisions.length === 0 ? <p style={{ fontSize: "calc(13px * var(--solenos-text-scale, 1))", color: 'var(--text-secondary)' }}>No changes have been recorded yet.</p> : caregiverVisibleRevisions.slice(0, 20).map((item) =>
          <article key={item.id} style={{ borderTop: '1px solid var(--border)', padding: '9px 0' }}>
            <strong>{item.target_type === 'person' || item.target_type === 'persons' ? 'Information about the person receiving care' : item.target_type === 'caregiver' || item.target_type === 'caregivers' ? 'Caregiver information' : 'Care information'}</strong>
            <p style={{ fontSize: "calc(12px * var(--solenos-text-scale, 1))", margin: '5px 0' }}>Updated {new Date(item.changed_at).toLocaleString()} · {simpleRecordLabel(item.change_kind)}</p>
            <small>Earlier and updated information is kept here. Related notes or documents: {item.evidence_ids.length}.</small>
          </article>
        )}
      </div>

      <div style={cardStyle}>
        <h3 style={{ fontSize: "calc(15px * var(--solenos-text-scale, 1))", marginTop: 0 }}>What happened and what was corrected</h3>
        {data.outcomes.length === 0 ? <p style={{ fontSize: "calc(13px * var(--solenos-text-scale, 1))", color: 'var(--text-secondary)' }}>No outcomes have been recorded yet.</p> : data.outcomes.slice(0, 20).map((item) =>
          <div key={item.id} style={{ borderTop: '1px solid var(--border)', padding: '8px 0', fontSize: "calc(12px * var(--solenos-text-scale, 1))" }}>
            <strong>{simpleRecordLabel(item.outcome_status)}</strong> · {new Date(item.created_at).toLocaleString()}
            {item.notes && <p>{caregiverSourceText(item.notes) || 'No further details are available.'}</p>}{item.correction_text && <p><strong>Correction:</strong> {caregiverSourceText(item.correction_text) || 'A correction was recorded.'}</p>}
          </div>
        )}
      </div>
    </section>
  )
}
