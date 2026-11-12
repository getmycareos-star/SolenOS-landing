import { useEffect, useRef, useState } from 'react'
import { getPersonId, getJSON, postJSON } from '../api/client'
import { caregiverSafeAssistantText, caregiverStatusLabel } from '../lib/caregiver-language'

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

type DeltaInput = { personId: string; content: string; source: string; eventDate: string; token: number; evidenceIds?: string[]; sourceEventId?: string }

const panelStyle: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
  padding: 14, marginTop: 20
}
const fieldStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', border: '1px solid var(--border)',
  borderRadius: 8, padding: 9, background: 'var(--bg)', color: 'var(--text)', fontSize: 13
}

export default function CareDeltaPanel({ personId, autoInput, showPanel = true }: { personId: string; autoInput?: DeltaInput | null; showPanel?: boolean }) {
  const [source, setSource] = useState('Caregiver report')
  const [eventDate, setEventDate] = useState(new Date().toISOString().slice(0, 10))
  const [content, setContent] = useState('')
  const [result, setResult] = useState<DeltaResult | null>(null)
  const [history, setHistory] = useState<DeltaHistoryEntry[]>([])
  const [historyError, setHistoryError] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const lastToken = useRef<number | null>(null)

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
      setResult(response)
      try {
        const rows = await getJSON(`/care-delta/runs/${encodeURIComponent(scopedPersonId)}`)
        if (Array.isArray(rows)) setHistory(rows as DeltaHistoryEntry[])
      } catch {
        setHistoryError('The comparison finished, but earlier comparisons could not be refreshed.')
      }
    } catch (reason) {
      setError('We couldn’t compare this care update right now. Your existing care record has not been changed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    setResult(null)
    setHistory([])
    setError('')
    setHistoryError('')
    setContent('')
    setSource('Caregiver report')
    setEventDate(new Date().toISOString().slice(0, 10))
    lastToken.current = null
    if (!personId || !showPanel) {
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
        if (!cancelled) setHistoryError("We couldn't load earlier care-change comparisons. You can still add a new note; try again to view saved comparisons.")
      })
    return () => { cancelled = true }
  }, [personId, showPanel])

  useEffect(() => {
    if (!autoInput || autoInput.personId !== personId || lastToken.current === autoInput.token) return
    lastToken.current = autoInput.token
    setSource(autoInput.source)
    setEventDate(autoInput.eventDate.slice(0, 10))
    setContent(autoInput.content)
    void reconcile(autoInput)
    // autoInput token intentionally controls this one-shot capture trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoInput?.token, autoInput?.personId, personId])

  function renderRows(title: string, rows?: Array<Record<string, any>>) {
    if (!rows?.length) return null
    return <section style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 10 }}>
      <h4 style={{ fontSize: 13, margin: '0 0 7px' }}>{title}</h4>
      <div style={{ display: 'grid', gap: 8 }}>
        {rows.map((row, index) => <article key={index} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 9 }}>
          <strong style={{ fontSize: 12 }}>{caregiverSafeAssistantText(String(row.name || row.action || row.topic || row.gap || row.field || title)) || 'Care information'}</strong>
          <p style={{ fontSize: 12, margin: '4px 0' }}>
            {row.change_type ? `Change: ${caregiverStatusLabel(String(row.change_type)) || 'Changed'} · ` : ''}
            {row.previous != null ? `Previous: ${caregiverSafeAssistantText(String(row.previous)) || 'Not available'} · ` : ''}
            {row.current != null ? `Reported now: ${caregiverSafeAssistantText(String(row.current)) || 'Not available'} · ` : ''}
            {row.status ? `Status: ${caregiverStatusLabel(String(row.status)) || 'Not available'} · ` : ''}
            {row.certainty ? `Information: ${caregiverStatusLabel(String(row.certainty)) || 'Not confirmed'} · ` : ''}
            {row.result_present === false ? 'Result not present in supplied record. ' : ''}
            {caregiverSafeAssistantText(String(row.next_question || row.why_conflicting || row.why_it_matters || '')) || ''}
          </p>
          {row.evidence_excerpt && <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0 }}>Source wording: “{row.evidence_excerpt}”</p>}
          {row.source_reference_status === 'not_matched' && <p role="note" style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '5px 0 0' }}>We could not link this finding to a saved source. It should not be treated as supported.</p>}
          {Array.isArray(row.source_record_refs) && row.source_record_refs.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border)', marginTop: 7, paddingTop: 7 }}>
              <strong style={{ fontSize: 11 }}>Saved information behind this finding</strong>
              {row.source_record_refs.map((reference: Record<string, any>, referenceIndex: number) => (
                <div key={(reference.record_type || 'source') + '-' + referenceIndex} style={{ marginTop: 6 }}>
                  <p style={{ fontSize: 11, margin: 0, fontWeight: 600 }}>{reference.label || (reference.record_type === 'care_event' ? 'Care update' : reference.record_type === 'evidence' ? 'Original note or document' : 'Care record detail')}</p>
                  {reference.occurred_at && <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '3px 0 0' }}>When it happened: {new Date(reference.occurred_at).toLocaleString()}</p>}
                  {reference.recorded_at && <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '3px 0 0' }}>When it was recorded: {new Date(reference.recorded_at).toLocaleString()}</p>}
                  {reference.reported_by && <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '3px 0 0' }}>Reported by: {caregiverSafeAssistantText(String(reference.reported_by)) || 'Not recorded'}</p>}
                  {reference.entered_by && <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '3px 0 0' }}>Recorded by: {caregiverSafeAssistantText(String(reference.entered_by)) || 'Not recorded'}</p>}
                  {reference.source_excerpt && <blockquote style={{ fontSize: 11, lineHeight: 1.5, margin: '5px 0 0', paddingLeft: 8, borderLeft: '2px solid var(--border)' }} >{caregiverSafeAssistantText(String(reference.source_excerpt)) || 'Source wording not available'}</blockquote>}
                </div>
              ))}
            </div>
          )}
          {row.claim_supported === false && <p role="note" style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '5px 0 0' }}>The value could not be matched to the supplied event or current-state evidence. It was kept uncertain and was not saved as a supported current-state assertion.</p>}
          {row.historical_only && <p role="note" style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '5px 0 0' }}>Historical report only — not promoted to current state.</p>}
          {row.promotion_warning && <p role="note" style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '5px 0 0' }}>{caregiverSafeAssistantText(String(row.promotion_warning)) || 'This item needs review before it is used.'}</p>}
          {row.provenance_warning && <p role="note" style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '5px 0 0' }}>{caregiverSafeAssistantText(String(row.provenance_warning)) || 'The source for this item needs review.'}</p>}
          {Array.isArray(row.reports) && <ul style={{ fontSize: 12, margin: '4px 0', paddingLeft: 18 }}>{row.reports.map((report: string, i: number) => <li key={i}>{report}</li>)}</ul>}
        </article>)}
      </div>
    </section>
  }

  // Background reconciliation remains active when the caregiver-facing controls are hidden.
  // The internal comparison panel exposes engine terms and is not part of the caregiver chat UI.
  if (!showPanel) return null;

  return <section aria-label="SolenOS Delta Engine" style={panelStyle}>
    <div>
      <h2 style={{ fontSize: 18, margin: 0 }}>Care changes over time</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.5, marginTop: 5 }}>
        Compare a new note or document with existing source-attributed care reports. Results are review candidates—not diagnoses or verified clinical facts.
      </p>
    </div>
    <form onSubmit={(event) => { event.preventDefault(); void reconcile({ content, source, eventDate }) }} style={{ display: 'grid', gap: 9, marginTop: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 9 }}>
        <label style={{ fontSize: 12 }}>Source
          <input style={fieldStyle} value={source} onChange={(e) => setSource(e.target.value)} required maxLength={240} />
        </label>
        <label style={{ fontSize: 12 }}>Event date
          <input style={fieldStyle} type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} required />
        </label>
      </div>
      <label style={{ fontSize: 12 }}>New care event or note
        <textarea style={{ ...fieldStyle, minHeight: 110, resize: 'vertical' }} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Paste the new event or use a text document above. Include source wording; avoid adding AI-generated conclusions as evidence." maxLength={100000} required />
      </label>
      <div><button type="submit" disabled={busy || !personId || !content.trim()} style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, background: busy ? 'var(--bg)' : 'var(--accent)', color: busy ? 'var(--text-secondary)' : 'white', fontSize: 12 }}>
        {busy ? 'Comparing with existing care state…' : 'Reconcile against existing care record'}
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
            else setHistoryError("Earlier care-change comparisons are still unavailable. Please try again shortly.");
          })
          .catch(() => setHistoryError("Your saved care-change history is still unavailable. Try again shortly."));
      }} style={{ padding: "8px 12px", minHeight: 40, borderRadius: 8, border: "2px solid var(--solenos-slate, #173f4b)", background: "var(--solenos-slate, #173f4b)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Try again</button>
    </div>}
    {history.length > 0 && <section style={{ borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 10 }}>
      <h3 style={{ fontSize: 13, margin: '0 0 7px' }}>Previous reconciliations</h3>
      <div style={{ display: 'grid', gap: 6 }}>
        {history.slice(0, 10).map((entry) => <button key={entry.id} type="button" onClick={() => entry.delta && setResult(entry.delta)} style={{ textAlign: 'left', border: '1px solid var(--border)', borderRadius: 7, padding: 8, background: 'var(--bg)', color: 'var(--text)', cursor: entry.delta ? 'pointer' : 'default' }}>
          <strong style={{ fontSize: 12 }}>{caregiverSafeAssistantText(entry.source) || 'Care update'}</strong>
          <span style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>{new Date(entry.event_date).toLocaleDateString()} · saved {new Date(entry.created_at).toLocaleString()}</span>
          <span style={{ display: 'block', fontSize: 11, marginTop: 3 }}>{caregiverSafeAssistantText(entry.delta?.event_summary) || 'Saved care update'}</span>
        </button>)}
      </div>
    </section>}
    {result && <div aria-live="polite" style={{ marginTop: 14 }}>
      <h3 style={{ fontSize: 15, margin: 0 }}>Delta result</h3>
      <p style={{ fontSize: 12, lineHeight: 1.5 }}>{caregiverSafeAssistantText(result.caregiver_summary || result.event_summary) || 'The comparison is ready, but its summary is not available to display.'}</p>
      {result.claim_provenance?.coverage === 'some_findings_unmatched' && <p role="note" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Some findings could not be linked to their own saved source. Review those items before relying on them.</p>}
      {result.claim_provenance?.coverage === 'all_findings_linked' && <p role="status" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Each listed finding is linked to the source wording used for its review. This does not establish clinical truth or independent corroboration.</p>}
      {result.claim_provenance?.claims?.some((claim) => claim.claim_type === 'summary') && (
        <section style={{ borderTop: '1px solid var(--border)', paddingTop: 9, marginTop: 9 }}>
          <h4 style={{ fontSize: 13, margin: '0 0 7px' }}>Summary source check</h4>
          {result.claim_provenance?.claims?.filter((claim) => claim.claim_type === 'summary').map((claim) => (
            <article key={claim.claim_id} style={{ marginBottom: 8 }}>
              <p style={{ fontSize: 12, margin: '0 0 4px' }}>{caregiverSafeAssistantText(claim.text) || 'Summary wording is not available.'}</p>
              {claim.support_status === 'matched_exact_source_wording' && <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0 }}>This wording appears in a saved source.</p>}
              {claim.support_status === 'historical_only' && <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0 }}>This wording appears only in earlier information.</p>}
              {claim.support_status === 'not_matched_to_source' && <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0 }}>We could not match this summary statement to the wording in a saved source. Check it before relying on it.</p>}
              {claim.source_references.map((reference, index) => <p key={reference.record_type + '-' + index} style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '3px 0 0' }}>{reference.label || 'Saved care information'}{reference.occurred_at ? ' · ' + new Date(reference.occurred_at).toLocaleString() : ''}</p>)}
            </article>
          ))}
        </section>
      )}
      {result.computed_changes?.length ? <section style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
        <h4 style={{ fontSize: 13, margin: '0 0 7px' }}>Compared state</h4>
        {result.computed_changes.map((item, index) => <p key={index} style={{ fontSize: 12, margin: '5px 0' }}>
          <strong>{caregiverSafeAssistantText(String(item.name || 'Care information')) || 'Care information'}</strong> · {caregiverStatusLabel(String(item.change_type || 'uncertain')) || 'Not confirmed'} · {caregiverSafeAssistantText(String(item.previous ?? 'No prior value')) || 'Not available'} → {caregiverSafeAssistantText(String(item.current ?? 'No current value')) || 'Not available'} · {caregiverStatusLabel(String(item.certainty || 'uncertain')) || 'Not confirmed'}
        </p>)}
      </section> : null}
      {renderRows('Medication reconciliation', result.medications)}
      {renderRows('Conditions and status changes', result.conditions)}
      {renderRows('Symptoms and trends', result.symptoms)}
      {renderRows('Ordered tests and results', result.tests)}
      {renderRows('Pending follow-ups', result.follow_ups)}
      {renderRows('Conflicting reports', result.contradictions)}
      {renderRows('Missing information and next questions', result.clinical_gaps)}
      {result.clinician_summary && <details style={{ marginTop: 10 }}><summary style={{ cursor: 'pointer', fontSize: 12 }}>Clinician-oriented summary</summary><p style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>{caregiverSafeAssistantText(result.clinician_summary) || 'This summary is not available to display.'}</p></details>}
      <p style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 10 }}>
        {result.provenance?.persisted ? 'This comparison was saved with its supporting care information.' : 'This comparison was not saved.'} Review conflicting or uncertain information before treating it as current.
      </p>
    </div>}
  </section>
}
