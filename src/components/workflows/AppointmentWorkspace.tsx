'use client'

import { useEffect, useState } from 'react'
import { ensureAnonymousSession, getJSON, postJSON, patchJSON } from '@/api/client'
import { CalendarDays, ClipboardList, FileCheck2, ListChecks, ShieldCheck } from 'lucide-react'

type Stage = 'prepare' | 'during' | 'after'
type EvidenceSource = {
  evidence_id: string
  type: string
  evidence_kind?: string | null
  epistemic_status: string
  source_type?: string | null
  original_author?: string | null
  reported_by_label?: string | null
  occurred_at?: string | null
  original_source_reference?: string | null
  parent_evidence_id?: string | null
}
type LinkedSource = { evidence_ids?: string[]; evidence_sources?: EvidenceSource[]; evidence_reference_status?: string }
type PreparationBrief = {
  snapshot_at: string
  read_only: boolean
  facts: Array<{ source_id: string; fact_type: string; value: string | null; epistemic_status: string; effective_at?: string | null; recorded_at?: string | null; updated_at?: string | null } & LinkedSource>
  events: Array<{ source_id: string; title: string; description?: string | null; event_type: string; occurred_at?: string | null; status: string } & LinkedSource>
  appointments: Array<{ source_id: string; title: string; scheduled_at?: string | null; provider?: string | null; location?: string | null; status: string } & LinkedSource>
  source_coverage: Record<string, string>
  evidence_lineage?: {
    status: string
    evidence_ids_considered: string[]
    groups: Array<{ lineage_id: string; evidence_ids: string[]; origin_group_keys: string[]; source_independence_status: string; interpretation_limit: string; basis?: string }>
    interpretation_limit: string
    scope_truncated?: boolean
    lineage_nodes_examined?: number
    relationship_records_examined?: number
  }
  limitations: string[]
}
type FollowUp = { action: string; owner: string; due: string; status: 'Open' | 'In progress' | 'Done' | 'Needs clarification' }

const emptyFollowUp = (): FollowUp => ({ action: '', owner: '', due: '', status: 'Open' })

export default function AppointmentWorkspace() {
  const [open, setOpen] = useState(false)
  const [recordId, setRecordId] = useState<string | null>(null)
  const [recordVersion, setRecordVersion] = useState(0)
  const [loadingRecord, setLoadingRecord] = useState(false)
  const [savingRecord, setSavingRecord] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [saveError, setSaveError] = useState('')
  const [lcrBrief, setLcrBrief] = useState<PreparationBrief | null>(null)
  const [briefError, setBriefError] = useState('')
  const [stage, setStage] = useState<Stage>('prepare')
  const [visitPurpose, setVisitPurpose] = useState('')
  const [clinician, setClinician] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [visitDate, setVisitDate] = useState('')
  const [location, setLocation] = useState('')
  const [attendees, setAttendees] = useState('')
  const [topConcerns, setTopConcerns] = useState(['', '', ''])
  const [changes, setChanges] = useState('')
  const [symptoms, setSymptoms] = useState('')
  const [medicationQuestions, setMedicationQuestions] = useState('')
  const [historyQuestions, setHistoryQuestions] = useState('')
  const [practicalNotes, setPracticalNotes] = useState('')
  const [concernsDiscussed, setConcernsDiscussed] = useState('')
  const [caregiverReport, setCaregiverReport] = useState('')
  const [clinicianFindings, setClinicianFindings] = useState('')
  const [decisions, setDecisions] = useState('')
  const [instructions, setInstructions] = useState('')
  const [unanswered, setUnanswered] = useState('')
  const [medicationReconciliation, setMedicationReconciliation] = useState('')
  const [pendingResults, setPendingResults] = useState('')
  const [familySummary, setFamilySummary] = useState('')
  const [followUps, setFollowUps] = useState<FollowUp[]>([emptyFollowUp()])
  const [reviewStatus, setReviewStatus] = useState<'Awaiting documentation' | 'Follow-up pending' | 'Ready for review' | 'Closed with documented outstanding items'>('Awaiting documentation')

  const updateConcern = (index: number, value: string) => setTopConcerns(current => current.map((item, i) => i === index ? value : item))
  const updateFollowUp = (index: number, key: keyof FollowUp, value: string) =>
    setFollowUps(current => current.map((item, i) => i === index ? { ...item, [key]: value } as FollowUp : item))
  const addFollowUp = () => setFollowUps(current => [...current, emptyFollowUp()])


  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoadingRecord(true)
    setSaveError('')
    void (async () => {
      try {
        await ensureAnonymousSession()
        try {
          const brief = await getJSON('/appointment-workspaces/preparation-brief?window_days=90') as PreparationBrief
          if (!cancelled) setLcrBrief(brief)
          if (!cancelled) setBriefError('')
        } catch (error) {
          if (!cancelled) {
            setLcrBrief(null)
            setBriefError(error instanceof Error ? error.message : 'LCR preparation sources are unavailable.')
          }
        }
        const response = await getJSON('/appointment-workspaces') as { items?: Array<{ id: string }> }
        const first = response.items?.[0]
        if (!first || cancelled) return
        const record = await getJSON('/appointment-workspaces/' + encodeURIComponent(first.id)) as {
          id: string; version_number: number; status: string; payload: Record<string, unknown>
        }
        if (cancelled) return
        const p = record.payload || {}
        setRecordId(record.id)
        setRecordVersion(record.version_number)
        setVisitPurpose(String(p.visitPurpose || ''))
        setClinician(String(p.clinician || ''))
        setSpecialty(String(p.specialty || ''))
        setVisitDate(String(p.visitDate || ''))
        setLocation(String(p.location || ''))
        setAttendees(String(p.attendees || ''))
        setTopConcerns(Array.isArray(p.topConcerns) ? p.topConcerns.map(String).concat(['', '', '']).slice(0, 3) : ['', '', ''])
        setChanges(String(p.changes || ''))
        setSymptoms(String(p.symptoms || ''))
        setMedicationQuestions(String(p.medicationQuestions || ''))
        setHistoryQuestions(String(p.historyQuestions || ''))
        setPracticalNotes(String(p.practicalNotes || ''))
        setConcernsDiscussed(String(p.concernsDiscussed || ''))
        setCaregiverReport(String(p.caregiverReport || ''))
        setClinicianFindings(String(p.clinicianFindings || ''))
        setDecisions(String(p.decisions || ''))
        setInstructions(String(p.instructions || ''))
        setUnanswered(String(p.unanswered || ''))
        setMedicationReconciliation(String(p.medicationReconciliation || ''))
        setPendingResults(String(p.pendingResults || ''))
        setFamilySummary(String(p.familySummary || ''))
        setFollowUps(Array.isArray(p.followUps) && p.followUps.length ? p.followUps.map((item: unknown) => ({ ...emptyFollowUp(), ...(item as Partial<FollowUp>) })) : [emptyFollowUp()])
        const validStatuses = ['Awaiting documentation', 'Follow-up pending', 'Ready for review', 'Closed with documented outstanding items'] as const
        setReviewStatus(validStatuses.includes(p.reviewStatus as typeof validStatuses[number]) ? p.reviewStatus as typeof validStatuses[number] : 'Awaiting documentation')
        setSaveMessage('Loaded saved appointment workspace · version ' + record.version_number)
      } catch (error) {
        if (!cancelled) setSaveError(error instanceof Error ? error.message : 'Could not load saved appointment workspace.')
      } finally {
        if (!cancelled) setLoadingRecord(false)
      }
    })()
    return () => { cancelled = true }
  }, [open])

  const saveWorkspace = async () => {
    setSavingRecord(true)
    setSaveError('')
    setSaveMessage('')
    const payload = {
      visitPurpose, clinician, specialty, visitDate, location, attendees, topConcerns,
      changes, symptoms, medicationQuestions, historyQuestions, practicalNotes,
      concernsDiscussed, caregiverReport, clinicianFindings, decisions, instructions,
      unanswered, medicationReconciliation, pendingResults, familySummary, followUps, reviewStatus,
      epistemic_boundary: {
        caregiver_report: 'caregiver_reported',
        clinician_findings: 'caregiver_recorded_clinician_statement_not_independently_verified',
        ai_suggestions_written_as_clinical_facts: false,
        lcr_reconciliation: 'not_performed',
      },
    }
    try {
      await ensureAnonymousSession()
      if (recordId) {
        const updated = await patchJSON('/appointment-workspaces/' + encodeURIComponent(recordId), {
          expected_version: recordVersion,
          status: ({ 'Awaiting documentation': 'preparation', 'Follow-up pending': 'follow_up_pending', 'Ready for review': 'ready_for_review', 'Closed with documented outstanding items': 'closed_with_outstanding_items' } as const)[reviewStatus],
          payload, change_reason: 'Caregiver saved appointment workspace',
        }) as { version_number: number }
        setRecordVersion(updated.version_number)
        setSaveMessage('Saved securely · version ' + updated.version_number + '. Not yet reconciled into LCR facts.')
      } else {
        const created = await postJSON('/appointment-workspaces', {
          status: 'preparation', payload, change_reason: 'Initial caregiver appointment workspace save',
        }) as { id: string; version_number: number }
        setRecordId(created.id)
        setRecordVersion(created.version_number)
        setSaveMessage('Saved securely · version ' + created.version_number + '. Not yet reconciled into LCR facts.')
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Save failed. Your unsaved edits remain on this screen.')
    } finally {
      setSavingRecord(false)
    }
  }

  return (
    <section className="appointment-workspace" aria-labelledby="appointment-workspace-title">
      <div className="appointment-heading">
        <div className="appointment-heading-icon" aria-hidden="true"><CalendarDays size={21} /></div>
        <div className="appointment-heading-copy">
          <span className="appointment-kicker">APPOINTMENTS · BEFORE, DURING & AFTER</span>
          <h3 id="appointment-workspace-title">Prepare for a healthcare visit</h3>
          <p>Organise concerns before the visit, capture what was actually discussed, and keep follow-up work visible.</p>
        </div>
        <button type="button" className="appointment-primary" onClick={() => setOpen(value => !value)} aria-expanded={open}>
          {open ? 'Close appointment workspace' : 'Open appointment workspace'}
        </button>
      </div>

      {open && <>
        <div className="appointment-boundary"><ShieldCheck size={17} aria-hidden="true" /><span>This workspace saves separately from LCR facts. Caregiver reports, caregiver-recorded clinician statements, and AI suggestions remain distinct; saving does not verify clinical statements or silently change the LCR.</span></div>
        <nav className="appointment-stages" aria-label="Appointment stages">
          {([
            ['prepare', '1. Before the visit'],
            ['during', '2. During the visit'],
            ['after', '3. After the visit'],
          ] as const).map(([key, label]) => <button key={key} type="button" className={'appointment-stage' + (stage === key ? ' is-active' : '')} aria-pressed={stage === key} onClick={() => setStage(key)}>{label}</button>)}
        </nav>

        {stage === 'prepare' && <div className="appointment-stage-panel">
          <h4>Appointment preparation brief</h4>
          <p className="appointment-stage-intro">Put the most important concern first. Use only information you can support; unknown details can remain blank.</p>
          <section className="appointment-lcr-brief" aria-labelledby="appointment-lcr-brief-title">
            <div className="appointment-lcr-brief-heading">
              <div>
                <h5 id="appointment-lcr-brief-title">Relevant information from the Living Care Record</h5>
                <p>{lcrBrief ? 'Read-only source snapshot · ' + new Date(lcrBrief.snapshot_at).toLocaleString() : 'This section requires the authenticated appointment preparation API.'}</p>
              </div>
              <span className="appointment-source-pill">{lcrBrief ? 'Source-linked' : 'Not loaded'}</span>
            </div>
            {briefError && <p className="appointment-brief-warning" role="status">LCR sources could not be loaded: {briefError}. This is not evidence that no care history exists.</p>}
            {lcrBrief && <>
              <div className="appointment-brief-grid">
                <div><strong>Recorded facts ({lcrBrief.facts.length})</strong>
                  {lcrBrief.facts.length ? <ul>{lcrBrief.facts.slice(0, 10).map(item => <li key={item.source_id}><span>{item.value || 'No value recorded'}</span><small>{item.fact_type} · {item.epistemic_status} · Source {item.source_id}</small>{item.evidence_sources?.map(source => <small key={source.evidence_id}>Evidence {source.evidence_id} · {source.epistemic_status} · Author: {source.original_author || 'not recorded'} · Reporter: {source.reported_by_label || 'not recorded'} · {source.original_source_reference || 'original source reference not recorded'}</small>)}</li>)}</ul> : <p>No care facts were returned from this source. This does not mean the information does not exist elsewhere.</p>}
                </div>
                <div><strong>Recent care events ({lcrBrief.events.length})</strong>
                  {lcrBrief.events.length ? <ul>{lcrBrief.events.slice(0, 8).map(item => <li key={item.source_id}><span>{item.title}</span><small>{item.occurred_at || 'Time not recorded'} · {item.status} · Source {item.source_id}</small>{item.description && <p>{item.description}</p>}{item.evidence_sources?.map(source => <small key={source.evidence_id}>Evidence {source.evidence_id} · {source.epistemic_status} · Author: {source.original_author || 'not recorded'} · Reporter: {source.reported_by_label || 'not recorded'} · {source.original_source_reference || 'original source reference not recorded'}</small>)}</li>)}</ul> : <p>No events were returned for the selected time window.</p>}
                </div>
                <div><strong>Appointment history ({lcrBrief.appointments.length})</strong>
                  {lcrBrief.appointments.length ? <ul>{lcrBrief.appointments.slice(0, 6).map(item => <li key={item.source_id}><span>{item.title}</span><small>{item.scheduled_at || 'Date not recorded'} · {item.status} · Source {item.source_id}</small>{item.evidence_sources?.map(source => <small key={source.evidence_id}>Evidence {source.evidence_id} · {source.epistemic_status} · Author: {source.original_author || 'not recorded'} · Reporter: {source.reported_by_label || 'not recorded'} · {source.original_source_reference || 'original source reference not recorded'}</small>)}</li>)}</ul> : <p>No appointment records were returned.</p>}
                </div>
              </div>
              <div className="appointment-source-coverage"><strong>Source availability</strong><div>{Object.entries(lcrBrief.source_coverage).map(([source, status]) => <span key={source} className="appointment-coverage-item"><b>{source.replaceAll('_', ' ')}</b><small>{status.replaceAll('_', ' ')}</small></span>)}</div></div>
              {lcrBrief.evidence_lineage && <section className="appointment-source-coverage" aria-label="Evidence source lineage">
                <strong>Evidence source lineage · {lcrBrief.evidence_lineage.status.replaceAll('_', ' ')}</strong>
                {lcrBrief.evidence_lineage.scope_truncated && <p role="status">Lineage retrieval reached a safety bound. Unreturned source relationships are unknown, not absent; independent corroboration is not established.</p>}
                {lcrBrief.evidence_lineage.groups.length ? lcrBrief.evidence_lineage.groups.map(group => <div key={group.lineage_id} className="appointment-coverage-item">
                  <b>{group.source_independence_status.replaceAll('_', ' ')}</b>
                  <small>Evidence IDs: {group.evidence_ids.join(', ')}{group.origin_group_keys.length ? ' · Origin: ' + group.origin_group_keys.join(', ') : ''}</small>
                  <small>{group.interpretation_limit}</small>
                </div>) : <p>No explicit shared-source group was returned for the retrieved evidence. This does not establish that the sources are independent.</p>}
                <p className="appointment-brief-limitations">{lcrBrief.evidence_lineage.interpretation_limit}</p>
              </section>}
              <p className="appointment-brief-limitations">{lcrBrief.limitations.join(' ')}</p>
            </>}
          </section>
          <div className="appointment-fields appointment-fields-two">
            <label>Visit purpose<textarea value={visitPurpose} onChange={event => setVisitPurpose(event.target.value)} rows={2} placeholder="What does the family want help understanding?" /></label>
            <label>Clinician name<input value={clinician} onChange={event => setClinician(event.target.value)} placeholder="Name, if known" /></label>
            <label>Specialty<input value={specialty} onChange={event => setSpecialty(event.target.value)} placeholder="Specialty, if known" /></label>
            <label>Date and time<input type="datetime-local" value={visitDate} onChange={event => setVisitDate(event.target.value)} /></label>
            <label>Location<input value={location} onChange={event => setLocation(event.target.value)} placeholder="Clinic or appointment location" /></label>
            <label>Who is attending?<input value={attendees} onChange={event => setAttendees(event.target.value)} placeholder="Person receiving care and support people" /></label>
          </div>
          <h5>The three most important things to discuss</h5>
          <div className="appointment-fields">{topConcerns.map((value, index) => <label key={index}>Priority {index + 1}<input value={value} onChange={event => updateConcern(index, event.target.value)} placeholder={index === 0 ? 'Most important concern' : 'Additional concern'} /></label>)}</div>
          <div className="appointment-fields appointment-fields-two">
            <label>What has changed since the last visit?<textarea value={changes} onChange={event => setChanges(event.target.value)} rows={4} placeholder="What changed, when first noticed, frequency, context, daily-life impact, and who observed it." /></label>
            <label>Current concerns and symptoms<textarea value={symptoms} onChange={event => setSymptoms(event.target.value)} rows={4} placeholder="Reported onset, pattern, severity as reported, what helps or worsens it." /></label>
            <label>Medication and treatment questions<textarea value={medicationQuestions} onChange={event => setMedicationQuestions(event.target.value)} rows={3} placeholder="Questions, missed doses, side effects, or discrepancies to clarify. Do not invent a medication list." /></label>
            <label>Relevant history and open questions<textarea value={historyQuestions} onChange={event => setHistoryQuestions(event.target.value)} rows={3} placeholder="Relevant documented history, pending tests/results, prior visit outcomes, and questions." /></label>
            <label>Practical arrangements<textarea value={practicalNotes} onChange={event => setPracticalNotes(event.target.value)} rows={3} placeholder="Transport, mobility assistance, interpreter, documents to bring, and consent/attendees." /></label>
          </div>
          <div className="appointment-summary">
            <h5>Consultation opening summary</h5>
            <p><strong>Purpose:</strong> {visitPurpose.trim() || 'Not recorded'}</p>
            <ol>{topConcerns.filter(value => value.trim()).map((value, index) => <li key={index}>{value}</li>)}</ol>
            <p><strong>Changes:</strong> {changes.trim() || 'Not recorded'}</p>
            <p><strong>Medication questions:</strong> {medicationQuestions.trim() || 'Not recorded'}</p>
          </div>
        </div>}

        {stage === 'during' && <div className="appointment-stage-panel">
          <h4>Appointment notes</h4>
          <p className="appointment-stage-intro">Record statements as remembered or documented. Do not label caregiver recollection as a verified clinical finding.</p>
          <div className="appointment-fields appointment-fields-two">
            <label>Concerns discussed<textarea value={concernsDiscussed} onChange={event => setConcernsDiscussed(event.target.value)} rows={3} placeholder="Which concerns were raised, addressed, deferred, or referred?" /></label>
            <label>What the person or caregiver reported<textarea value={caregiverReport} onChange={event => setCaregiverReport(event.target.value)} rows={4} placeholder="Keep this separate from clinician findings." /></label>
            <label>Clinician findings (only as communicated/documented)<textarea value={clinicianFindings} onChange={event => setClinicianFindings(event.target.value)} rows={4} placeholder="Record exact communicated findings or state that none were provided." /></label>
            <label>Decisions and stated rationale<textarea value={decisions} onChange={event => setDecisions(event.target.value)} rows={4} placeholder="Decision, reason given, alternatives, preferences, and agreed/deferred/declined/clarification status." /></label>
            <label>Instructions and follow-up plan<textarea value={instructions} onChange={event => setInstructions(event.target.value)} rows={4} placeholder="Capture clinician-provided instructions accurately; do not infer a medication change." /></label>
            <label>Questions left unanswered<textarea value={unanswered} onChange={event => setUnanswered(event.target.value)} rows={3} placeholder="What remains uncertain or needs clarification?" /></label>
          </div>
        </div>}

        {stage === 'after' && <div className="appointment-stage-panel">
          <h4>Outcome and continuity</h4>
          <p className="appointment-stage-intro">A visit can be finished while clinical follow-up remains open. Mark work done only when completion is supported.</p>
          <div className="appointment-fields appointment-fields-two">
            <label>Medication reconciliation / discrepancies<textarea value={medicationReconciliation} onChange={event => setMedicationReconciliation(event.target.value)} rows={4} placeholder="Record the exact clinician instruction, source, effective date, verification status, and unresolved discrepancy. Never infer start/stop/change." /></label>
            <label>Pending tests, results, or referrals<textarea value={pendingResults} onChange={event => setPendingResults(event.target.value)} rows={4} placeholder="What was ordered/referred, expected timing if stated, who will obtain/review results, and documented escalation route." /></label>
            <label>What the family needs to know<textarea value={familySummary} onChange={event => setFamilySummary(event.target.value)} rows={4} placeholder="What changes in everyday care, what remains the same, what to monitor, when to contact whom, and what remains uncertain." /></label>
          </div>
          <div className="appointment-followups-heading"><h5>Follow-up actions</h5><button type="button" className="appointment-secondary" onClick={addFollowUp}><ListChecks size={15} /> Add action</button></div>
          {followUps.map((item, index) => <div className="appointment-followup" key={index}>
            <label>Action<input value={item.action} onChange={event => updateFollowUp(index, 'action', event.target.value)} placeholder="Book follow-up, complete test, obtain result…" /></label>
            <label>Owner<input value={item.owner} onChange={event => updateFollowUp(index, 'owner', event.target.value)} placeholder="Named person or service" /></label>
            <label>Due date<input type="date" value={item.due} onChange={event => updateFollowUp(index, 'due', event.target.value)} /></label>
            <label>Status<select value={item.status} onChange={event => updateFollowUp(index, 'status', event.target.value)}><option>Open</option><option>In progress</option><option>Done</option><option>Needs clarification</option></select></label>
          </div>)}
          <label className="appointment-review-status">Closure status<select value={reviewStatus} onChange={event => setReviewStatus(event.target.value as typeof reviewStatus)}><option>Awaiting documentation</option><option>Follow-up pending</option><option>Ready for review</option><option>Closed with documented outstanding items</option></select></label>
          <p className="appointment-save-boundary"><FileCheck2 size={16} aria-hidden="true" /> Working draft only — appointment notes, decisions, and follow-up actions are not yet persisted to the LCR. Do not rely on this screen as the durable follow-up record.</p>
        </div>}

        <div className="appointment-save-controls">
          <div className="appointment-save-status" role="status" aria-live="polite">
            {loadingRecord ? 'Loading saved appointment workspace…' : saveMessage}
            {saveError && <span className="appointment-error">{saveError}</span>}
          </div>
          <button type="button" className="appointment-primary" onClick={() => void saveWorkspace()} disabled={savingRecord || loadingRecord}>
            {savingRecord ? 'Saving…' : recordId ? 'Save appointment changes' : 'Save appointment workspace'}
          </button>
        </div>
      </>}
      <style jsx>{`
        .appointment-workspace { padding:22px; border:1px solid #dfe8df; border-radius:20px; background:#fff; color:#26392c; }
        .appointment-heading { display:flex; align-items:center; gap:14px; flex-wrap:wrap; }
        .appointment-heading-icon { display:grid; place-items:center; flex:0 0 42px; width:42px; height:42px; border:1px solid #dbe8d9; border-radius:13px; background:#edf5ec; color:#527657; }
        .appointment-heading-copy { flex:1; min-width:190px; }
        .appointment-kicker { display:block; margin-bottom:5px; color:#53745a; font-size:9px; font-weight:850; letter-spacing:.13em; }
        .appointment-heading h3 { margin:0; color:#24372a; font-size:clamp(18px,2.1vw,23px); letter-spacing:-.03em; }
        .appointment-heading p { margin:5px 0 0; color:#6a786e; font-size:12px; line-height:1.6; }
        .appointment-primary,.appointment-secondary { display:inline-flex; align-items:center; justify-content:center; gap:7px; min-height:40px; padding:9px 13px; border:1px solid #cbdcc9; border-radius:11px; background:#e7f0e5; color:#203b27; font:inherit; font-size:12px; font-weight:750; cursor:pointer; }
        .appointment-secondary { background:#fff; }
        .appointment-boundary,.appointment-save-boundary { display:flex; align-items:flex-start; gap:8px; margin:18px 0 0; padding:12px; border:1px solid #e4e9de; border-radius:11px; background:#f7f9f4; color:#536653; font-size:12px; line-height:1.6; }
        .appointment-boundary svg,.appointment-save-boundary svg { flex:0 0 auto; margin-top:2px; }
        .appointment-lcr-brief { margin:16px 0 18px; padding:14px; border:1px solid #dfe8df; border-radius:13px; background:#f8faf7; }
        .appointment-lcr-brief-heading { display:flex; justify-content:space-between; gap:12px; align-items:flex-start; }
        .appointment-lcr-brief-heading h5 { margin:0; }
        .appointment-lcr-brief-heading p { margin:5px 0 0; color:#738075; font-size:11px; }
        .appointment-source-pill { padding:5px 8px; border:1px solid #d7e2d4; border-radius:999px; color:#426648; font-size:10px; white-space:nowrap; }
        .appointment-brief-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; margin-top:12px; }
        .appointment-brief-grid > div { min-width:0; padding:10px; border:1px solid #e3eae0; border-radius:10px; background:#fff; }
        .appointment-brief-grid strong { color:#405343; font-size:11px; }
        .appointment-brief-grid ul { margin:8px 0 0; padding-left:16px; }
        .appointment-brief-grid li { margin:0 0 9px; color:#445647; font-size:11px; line-height:1.45; overflow-wrap:anywhere; }
        .appointment-brief-grid li span { display:block; }
        .appointment-brief-grid li small { display:block; margin-top:3px; color:#778278; font-size:9px; overflow-wrap:anywhere; }
        .appointment-brief-grid li p { margin:4px 0 0; font-size:10px; }
        .appointment-brief-grid > div > p,.appointment-brief-limitations { color:#758075; font-size:10px; line-height:1.55; }
        .appointment-brief-warning { padding:9px; border-radius:8px; background:#fff4e8; color:#815a28; font-size:11px; line-height:1.5; overflow-wrap:anywhere; }
        .appointment-source-coverage { margin-top:12px; }
        .appointment-source-coverage > strong { display:block; color:#536653; font-size:10px; margin-bottom:7px; }
        .appointment-source-coverage > div { display:flex; flex-wrap:wrap; gap:6px; }
        .appointment-coverage-item { display:flex; flex-direction:column; gap:2px; max-width:100%; padding:6px 8px; border:1px solid #e2e9df; border-radius:8px; background:#fff; }
        .appointment-coverage-item b { color:#526352; font-size:9px; text-transform:capitalize; }
        .appointment-coverage-item small { color:#788276; font-size:9px; }
        .appointment-brief-limitations { margin:12px 0 0; }
        .appointment-stages { display:flex; gap:8px; flex-wrap:wrap; margin:18px 0 0; padding-bottom:14px; border-bottom:1px solid #e8eee7; }
        .appointment-stage { min-height:40px; padding:9px 12px; border:1px solid #dfe8df; border-radius:10px; background:#fff; color:#506354; font:inherit; font-size:12px; font-weight:700; cursor:pointer; }
        .appointment-stage.is-active { border-color:#9fbd9d; background:#edf5eb; color:#294b31; }
        .appointment-stage-panel { padding-top:18px; }
        .appointment-stage-panel h4 { margin:0; font-size:17px; color:#26392c; }
        .appointment-stage-intro { margin:6px 0 16px; color:#6a786e; font-size:12px; line-height:1.65; }
        .appointment-fields { display:grid; grid-template-columns:minmax(0,1fr); gap:12px; margin-top:14px; }
        .appointment-fields-two { grid-template-columns:repeat(2,minmax(0,1fr)); }
        .appointment-fields label,.appointment-followup label,.appointment-review-status { display:flex; flex-direction:column; gap:6px; min-width:0; color:#405343; font-size:12px; font-weight:750; }
        .appointment-fields input,.appointment-fields textarea,.appointment-followup input,.appointment-followup select,.appointment-review-status select { width:100%; min-width:0; padding:10px 11px; border:1px solid #dce6da; border-radius:9px; background:#fff; color:#26392c; font:inherit; font-size:13px; font-weight:450; line-height:1.5; }
        .appointment-fields textarea { resize:vertical; }
        .appointment-stage-panel h5 { margin:20px 0 8px; font-size:13px; color:#334b38; }
        .appointment-summary { margin-top:18px; padding:14px; border:1px solid #e1e9de; border-radius:12px; background:#f9fbf8; }
        .appointment-summary h5 { margin:0 0 10px; }
        .appointment-summary p,.appointment-summary li { color:#506354; font-size:12px; line-height:1.6; overflow-wrap:anywhere; }
        .appointment-summary ol { margin:8px 0; padding-left:22px; }
        .appointment-followups-heading { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:18px; }
        .appointment-followups-heading h5 { margin:0; }
        .appointment-followup { display:grid; grid-template-columns:2fr 1fr 1fr 1fr; gap:10px; margin-top:10px; padding:12px; border:1px solid #e1e9de; border-radius:12px; }
        .appointment-review-status { max-width:440px; margin-top:16px; }
        @media(max-width:820px) { .appointment-brief-grid { grid-template-columns:minmax(0,1fr); } }
        @media(max-width:680px) { .appointment-workspace { padding:15px; border-radius:16px; } .appointment-fields-two { grid-template-columns:minmax(0,1fr); } .appointment-followup { grid-template-columns:minmax(0,1fr); } .appointment-primary { width:100%; } }
      `}</style>
    </section>
  )
}
