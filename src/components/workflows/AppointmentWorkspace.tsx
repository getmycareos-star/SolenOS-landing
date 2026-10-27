'use client'

import { useState } from 'react'
import { CalendarDays, ClipboardList, FileCheck2, ListChecks, ShieldCheck } from 'lucide-react'

type Stage = 'prepare' | 'during' | 'after'
type FollowUp = { action: string; owner: string; due: string; status: 'Open' | 'In progress' | 'Done' | 'Needs clarification' }

const emptyFollowUp = (): FollowUp => ({ action: '', owner: '', due: '', status: 'Open' })

export default function AppointmentWorkspace() {
  const [open, setOpen] = useState(false)
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
        <div className="appointment-boundary"><ShieldCheck size={17} aria-hidden="true" /><span>This is a working draft in AI Companion. It is not saved to the Living Care Record yet. Caregiver reports, clinician statements, and AI suggestions must remain distinct.</span></div>
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
        @media(max-width:680px) { .appointment-workspace { padding:15px; border-radius:16px; } .appointment-fields-two { grid-template-columns:minmax(0,1fr); } .appointment-followup { grid-template-columns:minmax(0,1fr); } .appointment-primary { width:100%; } }
      `}</style>
    </section>
  )
}
