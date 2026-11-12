'use client'

import { useEffect, useState } from 'react'
import { ensureAnonymousSession, getJSON, postJSON, patchJSON } from '@/api/client'
import { CalendarDays, ClipboardList, FileCheck2, ListChecks, ShieldCheck } from 'lucide-react'
import { caregiverInformationLabel, caregiverSafeAssistantText, caregiverStatusLabel } from '@/lib/caregiver-language'

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
type FreshnessAssessment = {
  assessment_id: string
  evidence_id: string
  policy_id: string
  domain_key: string
  policy_version: string
  freshness_status: string
  source_time?: string | null
  source_time_kind?: string | null
  assessed_at: string
  age_days?: number | null
  rationale: string
  interpretation_limit: string
}
type LinkedSource = { evidence_ids?: string[]; evidence_sources?: EvidenceSource[]; evidence_reference_status?: string; freshness_assessments?: FreshnessAssessment[] }
type PreparationBrief = {
  snapshot_at: string
  read_only: boolean
  facts: Array<{ source_id: string; fact_type: string; value: string | null; epistemic_status: string; effective_at?: string | null; recorded_at?: string | null; updated_at?: string | null } & LinkedSource>
  events: Array<{ source_id: string; title: string; description?: string | null; event_type: string; occurred_at?: string | null; status: string } & LinkedSource>
  appointments: Array<{ source_id: string; title: string; scheduled_at?: string | null; provider?: string | null; location?: string | null; status: string } & LinkedSource>
  source_coverage: Record<string, string>
  freshness_assessments?: FreshnessAssessment[]
  freshness_assessment_scope?: { status: string; bounded: boolean; limit: number; history_complete: boolean; interpretation_limit: string }
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
type FollowUp = { id: string; action: string; owner: string; due: string; status: 'Open' | 'In progress' | 'Done' | 'Needs clarification'; open_loop_id?: string; reported_done_at?: string }

type AppointmentSaveRetry = { signature: string; key: string }
const newAppointmentSaveKey = () => `appointment-save-${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`}`

const newFollowUpId = () => typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `follow-up-${Date.now()}-${Math.random().toString(36).slice(2)}`
const emptyFollowUp = (): FollowUp => ({ id: newFollowUpId(), action: '', owner: '', due: '', status: 'Open' })

export default function DetailedAppointmentWorkspace() {
  const [open, setOpen] = useState(false)
  const [recordId, setRecordId] = useState<string | null>(null)
  const [recordVersion, setRecordVersion] = useState(0)
  const [loadingRecord, setLoadingRecord] = useState(false)
  const [savingRecord, setSavingRecord] = useState(false)
  const [saveRetry, setSaveRetry] = useState<AppointmentSaveRetry | null>(null)
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
            setBriefError('Saved care information could not be loaded. Please try again.')
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
        setFollowUps(Array.isArray(p.followUps) && p.followUps.length ? p.followUps.map((item: unknown) => { const saved = item as Partial<FollowUp>; return { ...emptyFollowUp(), ...saved, id: saved.id || newFollowUpId() } }) : [emptyFollowUp()])
        const validStatuses = ['Awaiting documentation', 'Follow-up pending', 'Ready for review', 'Closed with documented outstanding items'] as const
        setReviewStatus(validStatuses.includes(p.reviewStatus as typeof validStatuses[number]) ? p.reviewStatus as typeof validStatuses[number] : 'Awaiting documentation')
        setSaveMessage('Your saved appointment information is ready.')
      } catch (error) {
        if (!cancelled) setSaveError('Could not load saved appointment information. Please try again.')
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
    const saveStatus = ({ 'Awaiting documentation': 'preparation', 'Follow-up pending': 'follow_up_pending', 'Ready for review': 'ready_for_review', 'Closed with documented outstanding items': 'closed_with_outstanding_items' } as const)[reviewStatus]
    const saveReason = recordId ? 'Caregiver saved appointment details' : 'Initial caregiver appointment workspace save'
    const saveSignature = JSON.stringify({ recordId, expectedVersion: recordVersion, status: saveStatus, payload, changeReason: saveReason })
    const requestKey = saveRetry?.signature === saveSignature ? saveRetry.key : newAppointmentSaveKey()
    setSaveRetry({ signature: saveSignature, key: requestKey })
    try {
      await ensureAnonymousSession()
      let savedRecordId = recordId
      let savedVersion = recordVersion
      if (savedRecordId) {
        const updated = await patchJSON('/appointment-workspaces/' + encodeURIComponent(savedRecordId), {
          expected_version: savedVersion,
          status: saveStatus,
          payload, change_reason: saveReason, idempotency_key: requestKey,
        }) as { version_number: number }
        savedVersion = updated.version_number
      } else {
        const created = await postJSON('/appointment-workspaces', {
          status: 'preparation', payload, change_reason: saveReason, idempotency_key: requestKey,
        }) as { id: string; version_number: number }
        savedRecordId = created.id
        savedVersion = created.version_number
      }
      if (!savedRecordId) throw new Error('The appointment workspace was not assigned a persisted record ID.')
      setRecordId(savedRecordId)
      setRecordVersion(savedVersion)
      setSaveRetry(null)
      setSaveMessage('Appointment notes saved · syncing follow-up actions…')

      // Persist follow-ups in the shared Open Loops service. "Done" is a
      // caregiver-reported outcome only; it is not independently verified.
      const synced = [...followUps]
      let followUpSyncError = ''
      for (let index = 0; index < synced.length; index += 1) {
        const item = synced[index]
        if (!item.action.trim()) continue
        try {
          let loopId = item.open_loop_id
          if (!loopId) {
            const created = await postJSON('/open-loops', {
              loop_type: 'follow_up',
              title: item.action.trim().slice(0, 240),
              description: item.action.trim(),
              source_type: 'appointment_workspace',
              source_id: savedRecordId + ':' + item.id,
              owner_role: 'caregiver',
              owner_label: item.owner.trim() || undefined,
              deadline_at: item.due ? new Date(item.due + 'T12:00:00').toISOString() : undefined,
              deadline_source: item.due ? 'explicit_user' : undefined,
              deadline_timezone: item.due ? Intl.DateTimeFormat().resolvedOptions().timeZone : undefined,
              idempotency_key: 'appointment-follow-up:' + savedRecordId + ':' + item.id,
            }) as { id: string }
            loopId = created.id
          } else {
            await patchJSON('/open-loops/' + encodeURIComponent(loopId), {
              title: item.action.trim().slice(0, 240),
              description: item.action.trim(),
              owner_role: 'caregiver',
              owner_label: item.owner.trim() || undefined,
              deadline_at: item.due ? new Date(item.due + 'T12:00:00').toISOString() : null,
              deadline_source: item.due ? 'explicit_user' : null,
              deadline_timezone: item.due ? Intl.DateTimeFormat().resolvedOptions().timeZone : null,
              reason: 'Updated from the caregiver appointment workspace',
              idempotency_key: 'appointment-follow-up-update:' + savedRecordId + ':' + item.id + ':' + savedVersion,
            })
          }
          synced[index] = { ...item, open_loop_id: loopId }
          if (item.status === 'Done' && !item.reported_done_at) {
            await postJSON('/open-loops/' + encodeURIComponent(loopId) + '/outcomes', {
              text: 'Caregiver marked this appointment follow-up as done in the appointment workspace. This is a caregiver-reported outcome, not independently verified.',
              evidence: [],
              idempotency_key: 'appointment-follow-up-done:' + savedRecordId + ':' + item.id,
            })
            synced[index] = { ...synced[index], reported_done_at: new Date().toISOString() }
          }
        } catch (error) {
          followUpSyncError = 'A follow-up action could not be updated.'
          break
        }
      }
      const followUpsChanged = synced.some((item, index) =>
        item.open_loop_id !== followUps[index]?.open_loop_id ||
        item.reported_done_at !== followUps[index]?.reported_done_at
      )
      if (followUpsChanged) {
        const syncedPayload = { ...payload, followUps: synced }
        const persisted = await patchJSON('/appointment-workspaces/' + encodeURIComponent(savedRecordId), {
          expected_version: savedVersion,
          status: ({ 'Awaiting documentation': 'preparation', 'Follow-up pending': 'follow_up_pending', 'Ready for review': 'ready_for_review', 'Closed with documented outstanding items': 'closed_with_outstanding_items' } as const)[reviewStatus],
          payload: syncedPayload,
          change_reason: 'Persisted Open Loop references for appointment follow-up actions',
          idempotency_key: requestKey + ':followups',
        }) as { version_number: number }
        savedVersion = persisted.version_number
        setRecordVersion(savedVersion)
        setFollowUps(synced)
      }
      if (followUpSyncError) {
        setSaveError('Your appointment notes were saved, but a follow-up could not be updated. Please try again.')
        setSaveMessage('Your appointment information was saved, but a follow-up could not be updated. Please try again.')
      } else {
        setSaveMessage('Your appointment information and follow-up actions were saved. A caregiver-reported completion has not been independently confirmed.')
      }
    } catch (error) {
      setSaveError('Your changes could not be saved. Check whether they appear before trying again.')
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
          {open ? 'Close appointment details' : 'Open appointment details'}
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
                <p>{lcrBrief ? 'Saved care information · ' + new Date(lcrBrief.snapshot_at).toLocaleString() : 'This section is not available right now.'}</p>
              </div>
              <span className="appointment-source-pill">{lcrBrief ? 'Source-linked' : 'Not loaded'}</span>
            </div>
            {briefError && <p className="appointment-brief-warning" role="status">Saved care information could not be loaded. Please try again. This is not evidence that no care history exists.</p>}
            {lcrBrief && <>
              <div className="appointment-brief-grid">
                <div><strong>Recorded facts ({lcrBrief.facts.length})</strong>
                  {lcrBrief.facts.length ? <ul>{lcrBrief.facts.slice(0, 10).map(item => <li key={item.source_id}><span>{item.value || 'No value recorded'}</span><small>Care information · {caregiverInformationLabel(item.epistemic_status) || 'Information status unavailable'}</small>{item.evidence_sources?.map(source => <small key={source.evidence_id}>{caregiverInformationLabel(source.epistemic_status) || 'Saved source'} · Author: {source.original_author || 'not recorded'} · Reported by: {source.reported_by_label || 'not recorded'}</small>)}</li>)}</ul> : <p>No care facts were returned from this source. This does not mean the information does not exist elsewhere.</p>}
                </div>
                <div><strong>Recent care events ({lcrBrief.events.length})</strong>
                  {lcrBrief.events.length ? <ul>{lcrBrief.events.slice(0, 8).map(item => <li key={item.source_id}><span>{item.title}</span><small>{item.occurred_at || 'Time not recorded'} · {caregiverStatusLabel(item.status) || 'Status not available'}</small>{item.description && <p>{item.description}</p>}{item.evidence_sources?.map(source => <small key={source.evidence_id}>Evidence {caregiverInformationLabel(source.epistemic_status) || 'Saved source'} · Author: {source.original_author || 'not recorded'} · Reported by: {source.reported_by_label || 'not recorded'}</small>)}</li>)}</ul> : <p>No events were returned for the selected time window.</p>}
                </div>
                <div><strong>Appointment history ({lcrBrief.appointments.length})</strong>
                  {lcrBrief.appointments.length ? <ul>{lcrBrief.appointments.slice(0, 6).map(item => <li key={item.source_id}><span>{item.title}</span><small>{item.scheduled_at || 'Date not recorded'} · {caregiverStatusLabel(item.status) || 'Status not available'}</small>{item.evidence_sources?.map(source => <small key={source.evidence_id}>Evidence {source.evidence_id} · {source.epistemic_status} · Author: {source.original_author || 'not recorded'} · Reporter: {source.reported_by_label || 'not recorded'} · {source.original_source_reference || 'original source reference not recorded'}</small>)}</li>)}</ul> : <p>No appointment records were returned.</p>}
                </div>
              </div>
              <div className="appointment-source-coverage"><strong>Source availability</strong><div>{Object.entries(lcrBrief.source_coverage).map(([source, status]) => <span key={source} className="appointment-coverage-item"><b>Care information source</b><small>{caregiverStatusLabel(String(status)) || 'Status not available'}</small></span>)}</div></div>
              <section className="appointment-source-coverage" aria-label="How recent this information is">
                <strong>How recent this information is</strong>
                <p>These checks can help show whether information may need another look. They do not prove that a report is true or still applies today.</p>
                {lcrBrief.freshness_assessment_scope && <small>{caregiverSafeAssistantText(lcrBrief.freshness_assessment_scope.interpretation_limit) || 'The available dates may not tell the whole story.'}</small>}
                {(lcrBrief.freshness_assessments?.length ?? 0) > 0
                  ? <ul>{lcrBrief.freshness_assessments?.map(item => <li key={item.assessment_id}>
                    <span>{caregiverStatusLabel(item.freshness_status) || 'Not checked'}</span>
                    <small>Information date: {item.source_time ? new Date(item.source_time).toLocaleString() : 'Not recorded'} · {item.age_days == null ? 'Age not known' : 'Recorded ' + item.age_days + ' days ago'}</small>
                    <small>{caregiverSafeAssistantText(item.rationale) || 'No further explanation is available.'}</small>
                    
                  </li>)}</ul>
                  : lcrBrief.freshness_assessment_scope?.status === 'unavailable_schema'
                    ? <p role="status">We couldn’t check how recent this information is. Its current status is unknown.</p>
                    : <p>We couldn’t find a review of how recent this information is. This does not mean it is current.</p>}
              </section>
              {lcrBrief.evidence_lineage && <section className="appointment-source-coverage" aria-label="Evidence source lineage">
                <strong>How these sources are connected</strong>
                {lcrBrief.evidence_lineage.scope_truncated && <p role="status">Lineage retrieval reached a safety bound. Unreturned source relationships are unknown, not absent; independent corroboration is not established.</p>}
                {lcrBrief.evidence_lineage.groups.length ? lcrBrief.evidence_lineage.groups.map(group => <div key={group.lineage_id} className="appointment-coverage-item">
                  <b>{group.source_independence_status === 'shared_origin' ? 'Same original source' : group.source_independence_status === 'independent' ? 'Reported separately' : group.source_independence_status === 'not_assessed' ? 'Not checked' : 'Not known'}</b>
                  
                  <small>{caregiverSafeAssistantText(group.interpretation_limit) || 'The relationship between these sources is not fully known.'}</small>
                </div>) : <p>No explicit shared-source group was returned for the retrieved evidence. This does not establish that the sources are independent.</p>}
                <p className="appointment-brief-limitations">{caregiverSafeAssistantText(lcrBrief.evidence_lineage.interpretation_limit) || 'A link between records does not prove that reports are true or independent.'}</p>
              </section>}
              <p className="appointment-brief-limitations">{lcrBrief.limitations.map(caregiverSafeAssistantText).filter(Boolean).join(' ')}</p>
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
            <label>Action<input maxLength={240} value={item.action} onChange={event => updateFollowUp(index, 'action', event.target.value)} placeholder="Book follow-up, complete test, obtain result…" /></label>
            <label>Owner<input value={item.owner} onChange={event => updateFollowUp(index, 'owner', event.target.value)} placeholder="Named person or service" /></label>
            <label>Due date<input type="date" value={item.due} onChange={event => updateFollowUp(index, 'due', event.target.value)} /></label>
            <label>Status<select value={item.status} onChange={event => updateFollowUp(index, 'status', event.target.value)}><option>Open</option><option>In progress</option><option>Done</option><option>Needs clarification</option></select></label>
          </div>)}
          <label className="appointment-review-status">Closure status<select value={reviewStatus} onChange={event => setReviewStatus(event.target.value as typeof reviewStatus)}><option>Awaiting documentation</option><option>Follow-up pending</option><option>Ready for review</option><option>Closed with documented outstanding items</option></select></label>
          <p className="appointment-save-boundary"><FileCheck2 size={16} aria-hidden="true" /> Appointment notes remain separate from accepted LCR facts. Follow-up actions are saved to the shared care follow-up record; marking one done records a caregiver report and does not verify or close it without source evidence.</p>
        </div>}

        <div className="appointment-save-controls">
          <div className="appointment-save-status" role="status" aria-live="polite">
            {loadingRecord ? 'Loading saved appointment information…' : saveMessage}
            {saveError && <span className="appointment-error">{saveError}</span>}
          </div>
          <button type="button" className="appointment-primary" onClick={() => void saveWorkspace()} disabled={savingRecord || loadingRecord}>
            {savingRecord ? 'Saving…' : recordId ? 'Save appointment changes' : 'Save appointment information'}
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
