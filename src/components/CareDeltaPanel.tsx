import { useEffect, useRef, useState } from 'react'
import { getPersonId, getJSON, postJSON } from '../api/client'
import { caregiverSourceText, caregiverSafeAssistantText, caregiverSafeGeneratedText, caregiverStatusLabel } from '../lib/caregiver-language'

type DeltaHistoryEntry = { id: string; source: string; event_date: string; created_at: string; delta?: DeltaResult | null }

type DeltaResult = {
  event_summary?: string
  medications?: Array<Record<string, any>>
  conditions?: Array<Record<string, any>>
  symptoms?: Array<Record<string, any>>
  tests?: Array<Record<string, any>>
  follow_ups?: Array<Record<string, any>>
  contradictions?: Array<Record<string, any>>
  clinical_gaps?: Array<Record<string, any>>
  caregiver_summary?: string
  clinician_summary?: string
  computed_changes?: Array<Record<string, any>>
  interpretation_evaluation?: {
    overall_status?: string
    caregiver_visible?: boolean
    counts?: Record<string, number>
    evaluations?: Array<Record<string, any>>
  }
  provenance?: Record<string, any>
  claim_provenance?: {
    coverage?: string
    claims?: Array<{
      claim_id: string
      claim_type: string
      text: string
      support_status: string
      source_references: Array<Record<string, any>>
    }>
    interpretation_limit?: string
  }
}


const panelStyle: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
  padding: 14, marginTop: 20
}
const fieldStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', border: '1px solid var(--border)',
  borderRadius: 8, padding: 9, background: 'var(--bg)', color: 'var(--text)', fontSize: 13
}

export default function CareDeltaPanel({ personId }: { personId: string }) {
  const [source, setSource] = useState('Caregiver report')
  const [eventDate, setEventDate] = useState(new Date().toISOString().slice(0, 10))
  const [content, setContent] = useState('')
  const [result, setResult] = useState<DeltaResult | null>(null)
  const [history, setHistory] = useState<DeltaHistoryEntry[]>([])
  const [historyError, setHistoryError] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const requestSequence = useRef(0)

  async function reconcile(input: { content: string; source: string; eventDate: string; evidenceIds?: string[]; sourceEventId?: string }) {
    const scopedPersonId = getPersonId()
    if (!scopedPersonId || scopedPersonId !== personId) {
      setError('Open the care record you want to update, then try again.')
      return
    }
    if (!input.content.trim()) {
      setError('Add a care update before comparing changes.')
      return
    }
    const requestId = ++requestSequence.current
    setBusy(true)
    setError('')
    try {
      const response = await postJSON('/care-delta/reconcile', {
        person_id: scopedPersonId,
        event_date: new Date(input.eventDate).toISOString(),
        source: input.source.trim() || 'Caregiver report',
        content: input.content,
        evidence_ids: input.evidenceIds || [],
        source_event_id: input.sourceEventId,
        persist: true,
      }) as DeltaResult
      if (requestId !== requestSequence.current) return
      setResult(response)
      try {
        const rows = await getJSON(`/care-delta/runs/${encodeURIComponent(scopedPersonId)}`)
        if (requestId === requestSequence.current && Array.isArray(rows)) setHistory(rows as DeltaHistoryEntry[])
      } catch {
        if (requestId === requestSequence.current) setHistoryError('The comparison finished, but earlier comparisons could not be refreshed.')
      }
    } catch {
      if (requestId === requestSequence.current) {
        setError('We couldn’t compare this care update right now. Your existing care record has not been changed. Please try again.')
      }
    } finally {
      if (requestId === requestSequence.current) setBusy(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    requestSequence.current += 1
    setBusy(false)
    setResult(null)
    setHistory([])
    setError('')
    setHistoryError('')
    setContent('')
    setSource('Caregiver report')
    setEventDate(new Date().toISOString().slice(0, 10))
    if (!personId) {
      return () => { cancelled = true }
    }
    getJSON(`/care-delta/runs/${encodeURIComponent(personId)}`)
      .then((rows) => {
        if (!cancelled && Array.isArray(rows)) {
          setHistory(rows as DeltaHistoryEntry[])
          setHistoryError('')
        }
      })
      .catch(() => {
        if (!cancelled) setHistoryError("We couldn't load earlier comparisons. You can still add a new note; try again to view them.")
      })
    return () => { cancelled = true }
  }, [personId])

  function renderRows(title: string, rows?: Array<Record<string, any>>) {
    if (!rows?.length || !result?.interpretation_evaluation) return null
    // These model-generated sections are not individually graded by the
    // longitudinal evaluator. Fail closed: absent flags are not evidence.
    const visibleRows = rows.filter((row) =>
      row.claim_supported === true &&
      row.evidence_supported === true &&
      row.historical_only !== true &&
      row.source_reference_status === 'matched' &&
      Array.isArray(row.source_record_refs) &&
      row.source_record_refs.length > 0
    )
    const withheldCount = rows.length - visibleRows.length
    return <section style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 10 }}>
      <h4 style={{ fontSize: 13, margin: '0 0 7px' }}>{title}</h4>
      {withheldCount > 0 && <p role="note" style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '0 0 8px' }}>
        {withheldCount} item{withheldCount === 1 ? ' was' : 's were'} left out because the saved information did not support a current conclusion. Review the original records if clarification is needed.
      </p>}
      {visibleRows.length > 0 && <div style={{ display: 'grid', gap: 8 }}>
        {visibleRows.map((row, index) => <article key={index} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 9 }}>
          <strong style={{ fontSize: 12 }}>{caregiverSafeGeneratedText(String(row.name || row.action || row.topic || row.gap || row.field || title)) || 'Care information'}</strong>
          <p style={{ fontSize: 12, margin: '4px 0' }}>
            {row.change_type ? `Change: ${caregiverStatusLabel(String(row.change_type)) || 'Changed'} · ` : ''}
            {row.previous != null ? `Previous: ${caregiverSourceText(String(row.previous)) || 'Not available'} · ` : ''}
            {row.current != null ? `Reported now: ${caregiverSourceText(String(row.current)) || 'Not available'} · ` : ''}
            {row.status ? `Status: ${caregiverStatusLabel(String(row.status)) || 'Not available'} · ` : ''}
            {row.certainty ? `Information: ${caregiverStatusLabel(String(row.certainty)) || 'Not confirmed'} · ` : ''}
            {row.result_present === false ? 'This result was not found in the information provided. ' : ''}
            {caregiverSafeGeneratedText(String(row.next_question || row.why_conflicting || row.why_it_matters || '')) || 'More information may be needed.'}
          </p>
          {row.evidence_excerpt && <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0 }}>Original wording: “{row.evidence_excerpt}”</p>}
          {row.source_reference_status === 'not_matched' && <p role="note" style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '5px 0 0' }}>We could not find the note or document behind this finding. Do not rely on it yet.</p>}
          {Array.isArray(row.source_record_refs) && row.source_record_refs.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border)', marginTop: 7, paddingTop: 7 }}>
              <strong style={{ fontSize: 11 }}>Saved information behind this finding</strong>
              {row.source_record_refs.map((reference: Record<string, any>, referenceIndex: number) => (
                <div key={(reference.record_type || 'source') + '-' + referenceIndex} style={{ marginTop: 6 }}>
                  <p style={{ fontSize: 11, margin: 0, fontWeight: 600 }}>{caregiverSafeGeneratedText(String(reference.label || '')) || (reference.record_type === 'care_event' ? 'Care update' : reference.record_type === 'evidence' ? 'Original note or document' : 'Care record detail')}</p>
                  {reference.occurred_at && <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '3px 0 0' }}>When it happened: {new Date(reference.occurred_at).toLocaleString()}</p>}
                  {reference.recorded_at && <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '3px 0 0' }}>When it was recorded: {new Date(reference.recorded_at).toLocaleString()}</p>}
                  {reference.reported_by && <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '3px 0 0' }}>Reported by: {caregiverSourceText(String(reference.reported_by)) || 'Not recorded'}</p>}
                  {reference.entered_by && <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '3px 0 0' }}>Recorded by: {caregiverSourceText(String(reference.entered_by)) || 'Not recorded'}</p>}
                  {reference.source_excerpt && <blockquote style={{ fontSize: 11, lineHeight: 1.5, margin: '5px 0 0', paddingLeft: 8, borderLeft: '2px solid var(--border)' }} >{caregiverSourceText(String(reference.source_excerpt)) || 'Original wording not available'}</blockquote>}
                </div>
              ))}
            </div>
          )}
          {row.claim_supported === false && <p role="note" style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '5px 0 0' }}>We could not match this detail to the care update or current information. It has not been confirmed or saved as current information.</p>}
          {row.historical_only && <p role="note" style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '5px 0 0' }}>This was reported earlier. It has not been treated as current information.</p>}
          {row.promotion_warning && <p role="note" style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '5px 0 0' }}>{caregiverSafeGeneratedText(String(row.promotion_warning)) || 'This item needs review before it is used.'}</p>}
          {row.provenance_warning && <p role="note" style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '5px 0 0' }}>{caregiverSafeGeneratedText(String(row.provenance_warning)) || 'Where this information came from needs checking.'}</p>}
          {Array.isArray(row.reports) && <ul style={{ fontSize: 12, margin: '4px 0', paddingLeft: 18 }}>{row.reports.map((report: string, i: number) => <li key={i}>{report}</li>)}</ul>}
        </article>)}
      </div>}
    </section>
  }

  return <section aria-label="Care changes over time" style={panelStyle}>
    <div>
      <h2 style={{ fontSize: 18, margin: 0 }}>Care changes over time</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.5, marginTop: 5 }}>
        Compare a new note or document with earlier care updates. These are possible changes to review, not a diagnosis or confirmed medical fact.
      </p>
    </div>
    <form onSubmit={(event) => { event.preventDefault(); void reconcile({ content, source, eventDate }) }} style={{ display: 'grid', gap: 9, marginTop: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 9 }}>
        <label style={{ fontSize: 12 }}>Who shared this update?
          <input style={fieldStyle} value={source} onChange={(e) => setSource(e.target.value)} required maxLength={240} />
        </label>
        <label style={{ fontSize: 12 }}>Event date
          <input style={fieldStyle} type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} required />
        </label>
      </div>
      <label style={{ fontSize: 12 }}>New care update or note
        <textarea style={{ ...fieldStyle, minHeight: 110, resize: 'vertical' }} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Add the new care update or paste the original words from a note. Do not present a suggestion as something someone actually said." maxLength={100000} required />
      </label>
      <div><button type="submit" disabled={busy || !personId || !content.trim()} style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, background: busy ? 'var(--bg)' : 'var(--accent)', color: busy ? 'var(--text-secondary)' : 'white', fontSize: 12 }}>
        {busy ? 'Comparing with saved care information…' : 'Compare with saved care information'}
      </button></div>
    </form>
    {error && <p role="alert" style={{ color: 'var(--error)', fontSize: 12, marginTop: 8 }}>{error}</p>}
    {historyError && <div role="status" style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 6 }}>
      <p style={{ margin: "0 0 6px" }}>{historyError}</p>
      <button type="button" onClick={() => {
        setHistoryError("");
        getJSON(`/care-delta/runs/${encodeURIComponent(personId)}`)
          .then((rows) => {
            if (Array.isArray(rows)) setHistory(rows as DeltaHistoryEntry[]);
            else setHistoryError("Earlier comparisons are still unavailable. Please try again shortly.");
          })
          .catch(() => setHistoryError("Your saved comparison history is still unavailable. Try again shortly."));
      }} style={{ padding: "8px 12px", minHeight: 40, borderRadius: 8, border: "2px solid var(--solenos-slate, #173f4b)", background: "var(--solenos-slate, #173f4b)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Try again</button>
    </div>}
    {history.length > 0 && <section style={{ borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 10 }}>
      <h3 style={{ fontSize: 13, margin: '0 0 7px' }}>Earlier comparisons</h3>
      <div style={{ display: 'grid', gap: 6 }}>
        {history.slice(0, 10).map((entry) => <button key={entry.id} type="button" onClick={() => entry.delta && setResult(entry.delta)} style={{ textAlign: 'left', border: '1px solid var(--border)', borderRadius: 7, padding: 8, background: 'var(--bg)', color: 'var(--text)', cursor: entry.delta ? 'pointer' : 'default' }}>
          <strong style={{ fontSize: 12 }}>{caregiverSafeAssistantText(entry.source) || 'Care update'}</strong>
          <span style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>{new Date(entry.event_date).toLocaleDateString()} · saved {new Date(entry.created_at).toLocaleString()}</span>
          <span style={{ display: 'block', fontSize: 11, marginTop: 3 }}>{caregiverSafeGeneratedText(entry.delta?.event_summary) || 'Saved care update'}</span>
        </button>)}
      </div>
    </section>}
    {result && <div aria-live="polite" style={{ marginTop: 14 }}>
      <h3 style={{ fontSize: 15, margin: 0 }}>What may have changed</h3>
      <p style={{ fontSize: 12, lineHeight: 1.5 }}>
        {!result.interpretation_evaluation
          ? 'This earlier comparison has not passed the current reliability check. Its interpretation is withheld; review the original care records instead.'
          : result.interpretation_evaluation.overall_status !== 'supported'
          ? result.interpretation_evaluation.overall_status === 'conflicting'
            ? 'The saved reports disagree. The original accounts are kept separate and no single account is treated as correct.'
            : result.interpretation_evaluation.overall_status === 'stale_evidence'
              ? 'The information behind this comparison may be out of date. It is not presented as the current care situation.'
              : result.interpretation_evaluation.overall_status === 'partially_supported'
                ? 'Some saved information supports this comparison, but parts remain uncertain and need review.'
                : result.interpretation_evaluation.overall_status === 'no_change_detected'
                  ? 'The available records did not establish a meaningful change for this update.'
                  : 'There is not enough verified information to establish a care change.'
          : 'The linked records and comparison checks support the possible changes listed below. This is not a medical conclusion.'}
      </p>
      {result.interpretation_evaluation && <p role="status" style={{ fontSize: 11, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
        {result.interpretation_evaluation.overall_status === 'supported'
          ? 'The linked records and comparison checks support these possible changes. This is not a medical conclusion.'
          : result.interpretation_evaluation.overall_status === 'conflicting'
            ? 'The saved reports disagree. Both accounts are kept separate; SolenOS does not choose which one is correct.'
            : result.interpretation_evaluation.overall_status === 'stale_evidence'
              ? 'The information behind this comparison may be out of date, so it is not presented as current.'
              : result.interpretation_evaluation.overall_status === 'partially_supported'
                ? 'Some information supports this comparison, but parts remain uncertain. Review the linked records before relying on it.'
                : result.interpretation_evaluation.overall_status === 'no_change_detected'
                  ? 'The available records did not establish a meaningful change for this update.'
                  : 'There is not enough verified information to present a care change as established.'}
      </p>}
      {result.claim_provenance?.coverage === 'some_findings_unmatched' && <p role="note" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>We could not find the notes or documents behind some of these possible changes. Check them before relying on them.</p>}
      {result.claim_provenance?.coverage === 'all_findings_linked' && <p role="status" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Each finding is linked to the words in a saved note or document. This does not prove the information is medically correct or came from a different report.</p>}
      {!result.interpretation_evaluation && <p role="note" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>This saved comparison predates the current reliability check. Its generated findings are not shown as current care information.</p>}
      {result.claim_provenance?.claims?.some((claim) => claim.claim_type === 'summary' && claim.support_status === 'matched_exact_source_wording') && (
        <section style={{ borderTop: '1px solid var(--border)', paddingTop: 9, marginTop: 9 }}>
          <h4 style={{ fontSize: 13, margin: '0 0 7px' }}>Check the summary against saved information</h4>
          {result.claim_provenance?.claims?.filter((claim) => claim.claim_type === 'summary' && claim.support_status === 'matched_exact_source_wording').map((claim) => (
            <article key={claim.claim_id} style={{ marginBottom: 8 }}>
              <p style={{ fontSize: 12, margin: '0 0 4px' }}>{caregiverSafeGeneratedText(claim.text) || 'Summary wording is not available.'}</p>
              {claim.support_status === 'matched_exact_source_wording' && <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0 }}>This wording appears in a saved note or document.</p>}
              {claim.support_status === 'historical_only' && <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0 }}>This wording appears only in earlier information.</p>}
              {claim.support_status === 'not_matched_to_source' && <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0 }}>We could not match this summary to the words in a saved note or document. Check it before relying on it.</p>}
              {claim.source_references.map((reference, index) => <p key={reference.record_type + '-' + index} style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '3px 0 0' }}>{reference.label || 'Saved care information'}{reference.occurred_at ? ' · ' + new Date(reference.occurred_at).toLocaleString() : ''}</p>)}
            </article>
          ))}
        </section>
      )}
      {result.computed_changes?.length ? <section style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
        <h4 style={{ fontSize: 13, margin: '0 0 7px' }}>Changes to review</h4>
        {result.computed_changes.filter((item) => item.interpretation_caregiver_visible === true).map((item, index) => <article key={index} style={{ fontSize: 12, margin: '5px 0' }}>
          <p style={{ margin: 0 }}>
            <strong>{caregiverSafeAssistantText(String(item.name || 'Care information')) || 'Care information'}</strong> · {caregiverStatusLabel(String(item.change_type || 'uncertain')) || 'Not confirmed'} · {caregiverSourceText(String(item.previous ?? 'No prior value')) || 'Not available'} → {caregiverSourceText(String(item.current ?? 'Not available')) || 'Not available'} · {caregiverStatusLabel(String(item.interpretation_status || item.certainty || 'uncertain')) || 'Not confirmed'}
          </p>
          {item.interpretation_uncertainty_justification && item.interpretation_status !== 'supported' && <p role="note" style={{ color: 'var(--text-secondary)', margin: '3px 0 0' }}>{caregiverSafeGeneratedText(String(item.interpretation_uncertainty_justification)) || 'This comparison needs review.'}</p>}
        </article>)}
        {result.computed_changes.some((item) => item.interpretation_caregiver_visible === false) && <p role="note" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Some possible changes were withheld because the evidence was missing, unsupported or out of date.</p>}
      </section> : null}
      {renderRows('Medicine changes to review', result.medications)}
      {renderRows('Conditions and status changes', result.conditions)}
      {renderRows('Symptoms and trends', result.symptoms)}
      {renderRows('Ordered tests and results', result.tests)}
      {renderRows('Pending follow-ups', result.follow_ups)}
      {renderRows('Conflicting reports', result.contradictions)}
      {renderRows('Missing information and next questions', result.clinical_gaps)}
      {/* Model-generated clinician summaries are withheld until they have their own evidence evaluation. */}
      <p style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 10 }}>
        {result.provenance?.persisted ? 'This comparison was saved with its supporting care information.' : 'This comparison was not saved.'} Review conflicting or uncertain information before treating it as current.
      </p>
    </div>}
  </section>
}
