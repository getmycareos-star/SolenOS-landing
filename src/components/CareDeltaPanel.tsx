import { useEffect, useRef, useState } from 'react'
import { getPersonId, getJSON, postJSON } from '../api/client'

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
          <strong style={{ fontSize: 12 }}>{row.name || row.action || row.topic || row.gap || row.field || title}</strong>
          <p style={{ fontSize: 12, margin: '4px 0' }}>
            {row.change_type ? `Change: ${String(row.change_type).replace(/_/g, ' ')} · ` : ''}
            {row.previous != null ? `Previous: ${row.previous} · ` : ''}
            {row.current != null ? `Reported now: ${row.current} · ` : ''}
            {row.status ? `Status: ${row.status} · ` : ''}
            {row.certainty ? `Certainty: ${row.certainty} · ` : ''}
            {row.result_present === false ? 'Result not present in supplied record. ' : ''}
            {row.next_question || row.why_conflicting || row.why_it_matters || ''}
          </p>
          {row.evidence_excerpt && <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0 }}>Source: “{row.evidence_excerpt}”</p>}
          {row.claim_supported === false && <p role="note" style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '5px 0 0' }}>The value could not be matched to the supplied event or current-state evidence. It was kept uncertain and was not saved as a supported current-state assertion.</p>}
          {row.historical_only && <p role="note" style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '5px 0 0' }}>Historical report only — not promoted to current state.</p>}
          {row.promotion_warning && <p role="note" style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '5px 0 0' }}>{row.promotion_warning}</p>}
          {row.provenance_warning && <p role="note" style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '5px 0 0' }}>{row.provenance_warning}</p>}
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
          <strong style={{ fontSize: 12 }}>{entry.source}</strong>
          <span style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>{new Date(entry.event_date).toLocaleDateString()} · saved {new Date(entry.created_at).toLocaleString()}</span>
          <span style={{ display: 'block', fontSize: 11, marginTop: 3 }}>{entry.delta?.event_summary || 'Saved reconciliation record'}</span>
        </button>)}
      </div>
    </section>}
    {result && <div aria-live="polite" style={{ marginTop: 14 }}>
      <h3 style={{ fontSize: 15, margin: 0 }}>Delta result</h3>
      <p style={{ fontSize: 12, lineHeight: 1.5 }}>{result.caregiver_summary || result.event_summary}</p>
      {result.computed_changes?.length ? <section style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
        <h4 style={{ fontSize: 13, margin: '0 0 7px' }}>Compared state</h4>
        {result.computed_changes.map((item, index) => <p key={index} style={{ fontSize: 12, margin: '5px 0' }}>
          <strong>{item.name}</strong> · {String(item.change_type || 'uncertain').replace(/_/g, ' ')} · {item.previous ?? 'No prior value'} → {item.current ?? 'No current value'} · {item.certainty}
        </p>)}
      </section> : null}
      {renderRows('Medication reconciliation', result.medications)}
      {renderRows('Conditions and status changes', result.conditions)}
      {renderRows('Symptoms and trends', result.symptoms)}
      {renderRows('Ordered tests and results', result.tests)}
      {renderRows('Pending follow-ups', result.follow_ups)}
      {renderRows('Conflicting reports', result.contradictions)}
      {renderRows('Missing information and next questions', result.clinical_gaps)}
      {result.clinician_summary && <details style={{ marginTop: 10 }}><summary style={{ cursor: 'pointer', fontSize: 12 }}>Clinician-oriented summary</summary><p style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>{result.clinician_summary}</p></details>}
      <p style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 10 }}>
        Persistence: {result.provenance?.persisted ? 'source-attributed assertions saved' : 'not saved'} · Provider: {result.provenance?.model_provider || 'unknown'} · Model: {result.provenance?.model || 'unknown'}. Review conflicts and uncertain items before treating them as current.
      </p>
    </div>}
  </section>
}
