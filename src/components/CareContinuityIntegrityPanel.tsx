import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { getJSON, patchJSON, getCaregiverId } from '../api/client'

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
function simpleRecordLabel(value?: string | null): string {
  if (!value) return "Not recorded";
  return ({
    current: "Still current",
    stale: "May be out of date",
    historical: "Older information",
    undetermined: "Not sure",
    unknown: "Not yet known",
    not_assessed: "Not checked",
    accepted: "Accepted",
    rejected: "Not accepted",
    superseded: "Replaced by newer information",
    created: "Added",
    updated: "Updated",
    corrected: "Corrected",
    deleted: "Removed",
    restored: "Restored",
    current_state: "Current care information",
    historical_observation: "Earlier observation",
  } as Record<string, string>)[value] ?? value.replace(/_/g, " ");
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
      setNotice('Marked as caregiver-reviewed. This is not independent clinical verification.')
      await load()
    } catch (reason) {
      setError('We couldn’t update this review. Please try again.')
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
          {loading ? 'Refreshing…' : 'Refresh record details'}
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
              <span style={{ fontSize: 12 }}>{fresh ? simpleRecordLabel(fresh.status) : 'Not checked'}</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '5px 0' }}>
              Reported by: {item.source_label} · {simpleRecordLabel(item.assertion_kind)} · Review: {simpleRecordLabel(item.assertion_status)} · {item.source_event_id ? 'linked care event' : 'caregiver report'}
            </p>
            {fresh && <p style={{ fontSize: 12, margin: '5px 0' }}>{fresh.explanation}</p>}
            {item.source_text && <blockquote style={{ margin: '7px 0', paddingLeft: 10, borderLeft: '2px solid var(--border)', fontSize: 12 }}>{item.source_text}</blockquote>}
            {item.assertion_status !== 'accepted' && item.assertion_status !== 'rejected' && item.assertion_status !== 'superseded' && (
              item.assertion_kind !== 'current_state' || item.review_after_days != null
                ? <button type="button" style={buttonStyle} onClick={() => void markReviewed(item)}>Mark as checked by a caregiver</button>
                : <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>No review schedule is saved, so this report cannot be marked as current here.</p>
            )}
          </article>
        })}
      </div>


      <div style={cardStyle}>
        <h3 style={{ fontSize: 15, marginTop: 0 }}>Record history</h3>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>A history of how recorded care information has changed over time.</p>
        {data.revisions.length === 0 ? <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No changes to the saved care information are available yet.</p> : data.revisions.slice(0, 20).map((item) =>
          <article key={item.id} style={{ borderTop: '1px solid var(--border)', padding: '9px 0' }}>
            <strong>{item.target_type === 'person' || item.target_type === 'persons' ? 'Care recipient information' : item.target_type === 'caregiver' || item.target_type === 'caregivers' ? 'Caregiver information' : 'Care record information'}</strong>
            <p style={{ fontSize: 12, margin: '5px 0' }}>Version {item.revision_number} · {simpleRecordLabel(item.change_kind)} · {new Date(item.changed_at).toLocaleString()}</p>
            <small>Previous and updated details remain preserved in the record history. Sources: {item.evidence_ids.length} saved item(s).</small>
          </article>
        )}
      </div>

      <div style={cardStyle}>
        <h3 style={{ fontSize: 15, marginTop: 0 }}>Recorded outcomes and corrections</h3>
        {data.outcomes.length === 0 ? <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No recorded outcomes are available yet.</p> : data.outcomes.slice(0, 20).map((item) =>
          <div key={item.id} style={{ borderTop: '1px solid var(--border)', padding: '8px 0', fontSize: 12 }}>
            <strong>{simpleRecordLabel(item.outcome_status)}</strong> · {new Date(item.created_at).toLocaleString()}
            {item.notes && <p>{item.notes}</p>}{item.correction_text && <p><strong>Recorded correction:</strong> {item.correction_text}</p>}
          </div>
        )}
      </div>
    </section>
  )
}
