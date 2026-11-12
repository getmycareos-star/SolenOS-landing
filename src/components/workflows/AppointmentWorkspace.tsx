'use client'

import { useEffect, useState } from 'react'
import { ensureAnonymousSession, getJSON, postJSON, patchJSON } from '@/api/client'
import { caregiverInformationLabel, caregiverSafeAssistantText, caregiverStatusLabel } from '@/lib/caregiver-language'
import { caregiverInformationLabel, caregiverStatusLabel, caregiverSafeAssistantText } from '@/lib/caregiver-language'
import { CalendarDays, ShieldCheck } from 'lucide-react'
import DetailedAppointmentWorkspace from './DetailedAppointmentWorkspace'

type Stage = 'prepare' | 'during' | 'after'
type PreparationBrief = {
  snapshot_at: string
  facts: Array<{ source_id: string; fact_type: string; value: string | null; epistemic_status: string; effective_at?: string | null }>
  events: Array<{ source_id: string; title: string; description?: string | null; occurred_at?: string | null; status: string }>
  appointments: Array<{ source_id: string; title: string; scheduled_at?: string | null; provider?: string | null; location?: string | null; status: string }>
  assertions?: Array<{ source_id: string; field: string; asserted_value: string; assertion_kind: string; epistemic_state: string; assertion_status: string; source_label: string; source_text?: string | null; event_time_text?: string | null; observed_at?: string | null; recorded_at?: string | null; evidence_ids: string[]; interpretation_limit: string }>
  open_questions?: Array<{ source_id: string; question: string; intended_answerer_role?: string | null; intended_answerer_label?: string | null; necessity: string; necessity_rationale?: string | null; priority: string; status: string; evidence_ids: string[]; asked_at?: string | null }>
  contradictions?: Array<{ source_id: string; field: string; description: string; resolution_status: string; resolution_notes?: string | null; unresolved_remainder?: string | null; source_assertion_ids: string[]; evidence_ids: string[]; created_at?: string | null }>
  limitations: string[]
  evidence_lineage: {
    status: string
    groups: Array<{
      lineage_id: string
      evidence_ids: string[]
      source_independence_status: string
      basis: string
      interpretation_limit: string
    }>
    interpretation_limit: string
    scope_truncated: boolean
    lineage_nodes_examined?: number
    relationship_records_examined?: number
  }
  freshness_assessments: Array<{
    assessment_id: string
    evidence_id: string
    domain_key: string
    policy_version: string
    freshness_status: string
    source_time: string | null
    source_time_kind: string
    assessed_at: string | null
    age_days: number | null
    rationale: string
    interpretation_limit: string
  }>
  freshness_assessment_scope: {
    status: string
    bounded: boolean
    limit: number
    history_complete: boolean
    interpretation_limit: string
  }
  source_coverage: { evidence_freshness_assessments: string; open_questions?: string; contradictions?: string; medications_and_allergies?: string }
}
type WorkspaceRecord = {
  id: string
  appointment_id?: string | null
  status: string
  version_number: number
  payload: Record<string, unknown>
}
type OutcomeDraft = {
  status: string
  read_only: boolean
  updates_lcr: boolean
  sections: Record<string, Array<{ label?: string; text: string; epistemic_status?: string; source_type?: string }>>
  missing_information: string[]
  limitations: string[]
}
type AppointmentSaveRetry = { signature: string; key: string }
const newAppointmentSaveKey = () => `appointment-save-${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`}`
type OutcomeProposal = {
  id: string
  status: string
  candidate_index: number
  proposal_version: number
  proposed_change: {
    asserted_value: string
    source_quote: string
    label: string
    field: string
    source_record_version: number
    epistemic_status: string
    independently_verified: boolean
    correction_context?: string
    supersedes_proposal_id?: string
  }
}

const stageStatus: Record<Stage, string> = {
  prepare: 'preparation',
  during: 'during_visit',
  after: 'outcome_pending',
}

export default function AppointmentWorkspace() {
  const [open, setOpen] = useState(false)
  const [stage, setStage] = useState<Stage>('prepare')
  const [brief, setBrief] = useState<PreparationBrief | null>(null)
  const [record, setRecord] = useState<WorkspaceRecord | null>(null)
  const [appointmentId, setAppointmentId] = useState('')
  const [outcome, setOutcome] = useState<OutcomeDraft | null>(null)
  const [outcomeProposals, setOutcomeProposals] = useState<OutcomeProposal[]>([])
  const [proposalBusy, setProposalBusy] = useState(false)
  const [correctionDrafts, setCorrectionDrafts] = useState<Record<string, string>>({})
  const [correctionContexts, setCorrectionContexts] = useState<Record<string, string>>({})
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveRetry, setSaveRetry] = useState<AppointmentSaveRetry | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [showDetailed, setShowDetailed] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setError('')
    void (async () => {
      try {
        await ensureAnonymousSession()
        const [briefResult, workspaceResult] = await Promise.allSettled([
          getJSON('/appointment-workspaces/preparation-brief?window_days=90') as Promise<PreparationBrief>,
          getJSON('/appointment-workspaces') as Promise<{ items?: WorkspaceRecord[] }>,
        ])
        if (cancelled) return
        if (briefResult.status === 'fulfilled') {
          setBrief(briefResult.value)
          const nextAppointment = briefResult.value.appointments.find(item => item.status.toLowerCase() === 'scheduled')
          if (nextAppointment) setAppointmentId(nextAppointment.source_id)
        } else {
          setError('Your appointment brief could not be loaded. Your care record has not been changed.')
        }
        if (workspaceResult.status === 'fulfilled') {
          const latest = workspaceResult.value.items?.[0] || null
          if (latest) {
            setRecord(latest)
            if (latest.appointment_id) setAppointmentId(latest.appointment_id)
            setNote(typeof latest.payload?.caregiverReport === 'string' ? latest.payload.caregiverReport : '')
            try {
              const draft = await getJSON('/appointment-workspaces/' + encodeURIComponent(latest.id) + '/outcome-draft') as OutcomeDraft
              if (!cancelled) setOutcome(draft)
              try {
                const proposals = await getJSON('/appointment-workspaces/' + encodeURIComponent(latest.id) + '/outcome-proposals') as { items?: OutcomeProposal[] }
                if (!cancelled) setOutcomeProposals(proposals.items || [])
              } catch {
                if (!cancelled) setOutcomeProposals([])
              }
            } catch {
              if (!cancelled) setOutcome(null)
            }
          }
        } else {
          setError('Saved appointment information could not be loaded. Your care record has not been changed.')
        }
      } catch (cause) {
        if (!cancelled) setError('Appointment support could not be opened. Please try again.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [open])

  const refreshOutcome = async (recordId: string) => {
    const draft = await getJSON('/appointment-workspaces/' + encodeURIComponent(recordId) + '/outcome-draft') as OutcomeDraft
    setOutcome(draft)
  }

  const refreshSavedWorkspace = async () => {
    try {
      await ensureAnonymousSession()
      const result = await getJSON('/appointment-workspaces') as { items?: WorkspaceRecord[] }
      const latest = result.items?.[0] || null
      setRecord(latest)
      if (!latest) {
        setOutcome(null)
        setOutcomeProposals([])
        return
      }
      setAppointmentId(latest.appointment_id || '')
      setNote(typeof latest.payload?.caregiverReport === 'string' ? latest.payload.caregiverReport : '')
      await refreshOutcome(latest.id)
      const proposals = await getJSON('/appointment-workspaces/' + encodeURIComponent(latest.id) + '/outcome-proposals') as { items?: OutcomeProposal[] }
      setOutcomeProposals(proposals.items || [])
    } catch (cause) {
      setError('Saved appointment information could not be refreshed. Please try again.')
    }
  }

  const prepareOutcomeReview = async () => {
    if (!record) return
    setProposalBusy(true)
    setError('')
    setMessage('')
    try {
      const result = await postJSON('/appointment-workspaces/' + encodeURIComponent(record.id) + '/outcome-proposals', {}) as { items?: OutcomeProposal[]; count?: number; written_to_lcr?: boolean }
      setOutcomeProposals(result.items || [])
      // Candidates stay in proposal storage until explicit caregiver acceptance creates an LCR assertion.
      if (result.written_to_lcr === true) window.dispatchEvent(new Event("careRecordUpdated"))
      setMessage((result.count || 0) + ' outcome candidate(s) prepared from the saved appointment revision. No LCR assertion is created until you accept a candidate after review.')
    } catch (cause) {
      setError('Appointment information could not be prepared for review. Please try again.')
    } finally {
      setProposalBusy(false)
    }
  }

  const reviewOutcomeProposal = async (proposal: OutcomeProposal, decision: 'accept' | 'correct' | 'reject') => {
    if (!record) return
    setProposalBusy(true)
    setError('')
    setMessage('')
    try {
      const body: Record<string, string> = { decision }
      if (decision === 'correct') {
        body.corrected_text = correctionDrafts[proposal.id] || ''
        body.correction_context = correctionContexts[proposal.id] || ''
      }
      const result = await postJSON(
        '/appointment-workspaces/' + encodeURIComponent(record.id) + '/outcome-proposals/' + encodeURIComponent(proposal.id) + '/review',
        body,
      ) as {
        proposal: OutcomeProposal;
        corrected_proposal?: OutcomeProposal | null;
        written_to_lcr?: boolean;
        reconciliation?: { stages?: Record<string, string> } | null;
      }
      if (result.written_to_lcr === true) window.dispatchEvent(new Event("careRecordUpdated"))
      setOutcomeProposals(current => {
        const updated = current.map(item => item.id === proposal.id ? result.proposal : item)
        return result.corrected_proposal && !updated.some(item => item.id === result.corrected_proposal?.id)
          ? [...updated, result.corrected_proposal]
          : updated
      })
      setMessage(decision === 'accept'
        ? (result.written_to_lcr
            ? result.reconciliation?.stages?.reconciliation === 'committed'
              ? 'Accepted as a caregiver-reviewed LCR assertion, and the care record was reassessed. It is not clinically verified.'
              : 'Accepted as a caregiver-reviewed LCR assertion. The original report remains attributed to the caregiver; reassessment status was not returned.'
            : 'No LCR assertion was created.')
        : decision === 'correct'
          ? 'Correction saved as a separate pending candidate. Review and accept it separately before it becomes an LCR assertion.'
          : 'Candidate rejected. No LCR assertion was created; the rejection remains in review history.')
    } catch (cause) {
      setError('Your review could not be saved. Please try again.')
    } finally {
      setProposalBusy(false)
    }
  }

  const saveNote = async () => {
    if (!note.trim()) {
      setMessage('Nothing to save. You can continue without adding a note.')
      if (stage === 'after' && record) {
        try { await refreshOutcome(record.id) } catch (cause) {
          setError('Appointment information could not be refreshed. Please try again.')
        }
      }
      return
    }
    setSaving(true)
    setError('')
    setMessage('')
    try {
      await ensureAnonymousSession()
      const payload = {
        ...(record?.payload || {}),
        caregiverReport: note.trim(),
        captureStage: stage,
      }
      const nextStatus = record
        ? record.status === 'preparation' && stage !== 'prepare'
          ? stage === 'during' ? 'during_visit' : 'outcome_pending'
          : record.status === 'during_visit' && stage === 'after' ? 'outcome_pending' : record.status
        : stageStatus[stage]
      const changeReason = 'Caregiver saved an optional appointment note'
      const saveSignature = JSON.stringify({
        recordId: record?.id || null,
        expectedVersion: record?.version_number || null,
        appointmentId: appointmentId || null,
        status: nextStatus,
        payload,
        changeReason,
      })
      const requestKey = saveRetry?.signature === saveSignature ? saveRetry.key : newAppointmentSaveKey()
      setSaveRetry({ signature: saveSignature, key: requestKey })
      let saved: WorkspaceRecord
      if (record) {
        saved = await patchJSON('/appointment-workspaces/' + encodeURIComponent(record.id), {
          expected_version: record.version_number,
          status: nextStatus,
          payload,
          change_reason: changeReason,
          idempotency_key: requestKey,
        }) as WorkspaceRecord
      } else {
        saved = await postJSON('/appointment-workspaces', {
          appointment_id: appointmentId || undefined,
          status: nextStatus,
          payload,
          change_reason: changeReason,
          idempotency_key: requestKey,
        }) as WorkspaceRecord
      }
      setRecord(saved)
      setSaveRetry(null)
      setMessage('Your note is saved as a caregiver report.')
      if (stage === 'after') {
        try {
          await refreshOutcome(saved.id)
        } catch {
          setError('Your note was saved. The outcome view could not refresh; use Refresh outcome to retry.')
        }
      }
    } catch (cause) {
      setError('Your note could not be saved. Check whether it appears before trying again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="appointment-workspace guided-appointment" aria-labelledby="appointment-workspace-title">
      <div className="appointment-heading">
        <div className="appointment-heading-icon" aria-hidden="true"><CalendarDays size={21} /></div>
        <div className="appointment-heading-copy">
          <span className="appointment-kicker">APPOINTMENTS</span>
          <h3 id="appointment-workspace-title">Your appointment, supported by SolenOS</h3>
          <p>SolenOS prepares and organises the information. You only add what it cannot know.</p>
        </div>
        <button type="button" className="appointment-primary" onClick={() => setOpen(value => !value)} aria-expanded={open}>
          {open ? 'Close' : 'Open appointment support'}
        </button>
      </div>

      {open && <>
        <div className="appointment-boundary"><ShieldCheck size={17} aria-hidden="true" /><span>You are not expected to complete forms before, during or after a visit. Notes are optional. Caregiver reports stay attributed to the caregiver, and nothing here silently changes the Living Care Record.</span></div>
        <nav className="guided-stages" aria-label="Appointment stages">
          {([['prepare', 'Before'], ['during', 'During'], ['after', 'After']] as const).map(([key, label]) => (
            <button key={key} type="button" className={stage === key ? 'is-active' : ''} aria-pressed={stage === key} onClick={() => setStage(key)}>{label}</button>
          ))}
        </nav>

        {loading && <p className="guided-muted" role="status">Preparing your appointment view…</p>}

        {stage === 'prepare' && <div className="guided-panel">
          <div className="guided-panel-heading"><div><h4>Your appointment brief</h4><p>Prepared from information already in the Living Care Record. Nothing to fill in.</p></div><span className="guided-state">Read-only</span></div>
          {!brief && <p className="guided-muted">Your care history could not be loaded. Missing information is not treated as proof that it does not exist.</p>}
          {brief && <>
            <div className="guided-columns">
              <section><h5>Recent care history</h5>{brief.events.length ? <ul>{brief.events.slice(0, 6).map(item => <li key={item.source_id}><strong>{item.title}</strong>{item.description && <p>{caregiverSafeAssistantText(item.description) || 'No further details are available.'}</p>}<small>{item.occurred_at ? new Date(item.occurred_at).toLocaleDateString() : 'Date not recorded'} · {caregiverStatusLabel(item.status) || "Status not available"}</small></li>)}</ul> : <p className="guided-muted">No recent care events were returned for this brief.</p>}</section>
              <section><h5>Recorded care information</h5>{brief.facts.length ? <ul>{brief.facts.slice(0, 6).map(item => <li key={item.source_id}><strong>Care information</strong><p>{item.value || 'No detail recorded'}</p><small>{caregiverInformationLabel(item.epistemic_status) || 'Information status not available'}</small></li>)}</ul> : <p className="guided-muted">No care facts were returned for this brief.</p>}{brief.source_coverage.medications_and_allergies === "unavailable" && <p className="guided-muted">A dedicated medication/allergy source is unavailable. Only medication information explicitly present in the recorded care information above is shown.</p>}</section>
            </div>
            <section className="guided-assertions"><h5>Recorded observations and caregiver reports</h5>{brief.assertions?.length ? <ul>{brief.assertions.slice(0, 10).map(item => <li key={item.source_id}><strong>Care detail</strong><p>{item.asserted_value}</p><small>{caregiverSafeAssistantText(item.source_label) || 'Saved care record'} · Information: {caregiverInformationLabel(item.epistemic_state || "reported") || "Caregiver report"} · Review: {caregiverStatusLabel(item.assertion_status) || "Review status not available"} · {item.observed_at ? new Date(item.observed_at).toLocaleString() : item.event_time_text || "Event time not recorded"}</small>{item.source_text && item.source_text !== item.asserted_value && <p>{item.source_text.slice(0, 280)}</p>}<small>{caregiverSafeAssistantText(item.interpretation_limit) || 'The available information may not tell the whole story.'}{item.evidence_ids.length ? ` · ${item.evidence_ids.length} linked evidence source(s)` : " · No evidence attachment linked"}</small></li>)}</ul> : <p className="guided-muted">{brief.assertions ? "No source-attributed care observations were returned for this brief." : "Reports linked to their original source are not included in this preparation response."}</p>}</section>
            <section className="guided-questions"><h5>Questions to raise with the healthcare professional</h5>{brief.source_coverage.open_questions === "failed" ? <p className="guided-muted">Unresolved questions could not be loaded from the care record.</p> : brief.open_questions?.length ? <ul>{brief.open_questions.slice(0, 8).map(item => <li key={item.source_id}><strong>{item.question}</strong><small>{item.intended_answerer_label || item.intended_answerer_role || "Answerer not recorded"} · {caregiverStatusLabel(item.priority) || "Priority not available"} · {caregiverStatusLabel(item.status) || "Status not available"}</small>{item.necessity_rationale && <p>{caregiverSafeAssistantText(item.necessity_rationale) || 'More information may be needed.'}</p>}</li>)}</ul> : <p className="guided-muted">{brief.open_questions ? "No unresolved questions were returned. This does not establish that none exist." : "Unresolved questions are not included in this preparation response."}</p>}</section>
            <section className="guided-conflicts"><h5>Unresolved concerns and conflicting information</h5>{brief.source_coverage.contradictions === "failed" ? <p className="guided-muted">Conflicting information could not be loaded from the care record.</p> : brief.contradictions?.length ? <ul>{brief.contradictions.slice(0, 8).map(item => <li key={item.source_id}><strong>Care detail · {caregiverStatusLabel(item.resolution_status) || "Review needed"}</strong><p>{item.description}</p>{item.unresolved_remainder && <p>{item.unresolved_remainder}</p>}<small>{item.source_assertion_ids.length} linked assertion(s) · {item.evidence_ids.length} evidence source(s)</small></li>)}</ul> : <p className="guided-muted">{brief.contradictions ? "No unresolved conflicts were returned for this brief." : "Conflict information is not included in this preparation response."}</p>}</section>
            <section className="guided-appointments"><h5>Appointments in the care record</h5>{brief.appointments.length ? <ul>{brief.appointments.slice(0, 5).map(item => <li key={item.source_id}><strong>{item.title}</strong><span>{item.scheduled_at ? new Date(item.scheduled_at).toLocaleString() : 'Date not recorded'} · {caregiverStatusLabel(item.status) || "Status not available"}</span></li>)}</ul> : <p className="guided-muted">No appointment was returned. This does not establish that no appointment exists.</p>}</section>
            <section className="guided-lineage" aria-label="How the sources are connected">
              <h5>How the sources are connected</h5>
              {brief.evidence_lineage.groups.length ? <ul>{brief.evidence_lineage.groups.map(group => <li key={group.lineage_id}><strong>{group.source_independence_status === "shared_origin" ? "Same original source" : group.source_independence_status === "independent" ? "Reported separately" : group.source_independence_status === "not_assessed" ? "Not checked" : "Not known"}</strong><p>{group.evidence_ids.length} saved items</p></li>)}</ul> : <p className="guided-muted">No review was found showing whether these sources came from the same original. This does not mean they are separate.</p>}
              <p className="guided-footnote">A link between records does not prove that a report is true or that two reports are separate.</p>
              {brief.evidence_lineage.scope_truncated && <p className="guided-muted">Only some source links could be checked. Whether the reports are separate is unknown.</p>}
            </section>
            <section className="guided-freshness" aria-label="How recent this information is">
              <h5>How recent this information is</h5>
              {brief.source_coverage.evidence_freshness_assessments === 'unavailable' && <p className="guided-muted">We couldn’t check how recent this information is right now.</p>}
              {brief.freshness_assessments.length ? <ul>{brief.freshness_assessments.slice(0, 8).map(item => <li key={item.assessment_id}>
                <strong>How recent: {caregiverStatusLabel(item.freshness_status) || 'Not checked'}</strong>
                <p>{item.rationale}</p>
                <small>Source time: {item.source_time ? new Date(item.source_time).toLocaleString() : 'Not recorded'} · Checked {item.assessed_at ? new Date(item.assessed_at).toLocaleString() : 'time not recorded'}</small>
                <small>{item.interpretation_limit}</small>
              </li>)}</ul> : brief.source_coverage.evidence_freshness_assessments !== 'unavailable' && <p className="guided-muted">We couldn’t check how recent the linked information is. This does not mean it is current.</p>}
              <p className="guided-footnote">{caregiverSafeAssistantText(brief.freshness_assessment_scope.interpretation_limit) || "The available dates may not tell the whole story."}</p>
            </section>
            <p className="guided-footnote">Prepared {new Date(brief.snapshot_at).toLocaleString()}. Reports, dates and unknowns remain separate.</p>
          </>}
        </div>}

        {stage === 'during' && <div className="guided-panel">
          <div className="guided-panel-heading"><div><h4>Stay with the appointment</h4><p>You do not need to document while speaking with the professional.</p></div><span className="guided-state">Optional</span></div>
          <p className="guided-muted">If it helps, leave yourself one short note. You can leave this empty and return later.</p>
          <label className="guided-capture-label">Anything you want to remember?
            <textarea value={note} onChange={event => setNote(event.target.value)} rows={4} placeholder="Optional note. Your own words are enough." />
          </label>
          <button className="guided-primary" type="button" onClick={() => void saveNote()} disabled={saving}>{saving ? 'Saving…' : 'Save note and continue'}</button>
          <p className="guided-footnote">A saved note is attributed to the caregiver. It is not a verified professional statement and does not change the Living Care Record.</p>
        </div>}

        {stage === 'after' && <div className="guided-panel">
          <div className="guided-panel-heading"><div><h4>Appointment information gathered</h4><p>SolenOS organises what has actually been recorded. You can return later if nothing is available yet.</p></div><span className="guided-state">Review first</span></div>
          <label className="guided-capture-label">Add anything you remember, if you want to
            <textarea value={note} onChange={event => setNote(event.target.value)} rows={4} placeholder="A short note is enough. You can also leave this empty." />
          </label>
          <div className="guided-actions">
            <button className="guided-primary" type="button" onClick={() => void saveNote()} disabled={saving}>{saving ? 'Saving…' : 'Save what I remember'}</button>
            <button className="guided-secondary" type="button" onClick={() => record && void refreshOutcome(record.id)} disabled={!record}>Refresh outcome</button>
          </div>
          {outcome?.status === 'ready_for_review' && <div className="guided-outcome" aria-live="polite">
            <h5>Information available for review</h5>
            {Object.entries(outcome.sections).filter(([, items]) => items.length).map(([key, items]) => <section key={key}><h6>Appointment details</h6>{items.map((item, index) => <p key={key + index}>{item.text}<small>{caregiverInformationLabel(item.epistemic_status) || 'Recorded information'} · {item.source_type === 'document' ? 'Document' : item.source_type === 'professional' ? 'Care professional' : 'Caregiver report'}</small></p>)}</section>)}
            {outcome.missing_information.length > 0 && <p className="guided-muted">Not recorded: {outcome.missing_information.join(', ')}.</p>}
            <p className="guided-footnote">This is a review draft, not a clinical conclusion. The Living Care Record has not been changed.</p>
            <div className="guided-actions">
              <button className="guided-primary" type="button" onClick={() => void prepareOutcomeReview()} disabled={!record || proposalBusy}>
                {proposalBusy ? 'Preparing…' : 'Prepare LCR review'}
              </button>
            </div>
            {outcomeProposals.length > 0 && <div className="guided-proposals">
              <h5>Caregiver review required</h5>
              <p className="guided-muted">Each candidate is tied to the saved appointment revision. Accepting records a caregiver-reviewed assertion, not a clinically verified fact.</p>
              {outcomeProposals.filter(item => item.proposed_change.source_record_version === record?.version_number).map(item => <article key={item.id} className="guided-proposal">
                <strong>{item.proposed_change.label || "Care detail"}</strong>
                <p>{item.proposed_change.asserted_value}</p>
                {item.proposed_change.asserted_value !== item.proposed_change.source_quote && <p><small>Original saved wording: {item.proposed_change.source_quote}</small></p>}
                <small>Appointment record revision {item.proposed_change.source_record_version} · {caregiverStatusLabel(item.status) || 'Status not available'} · caregiver reported · not independently verified</small>
                {item.status === 'pending_authorization' && <>
                  <label className="guided-capture-label">Correction, if needed
                    <textarea rows={2} value={correctionDrafts[item.id] || ''} onChange={event => setCorrectionDrafts(current => ({ ...current, [item.id]: event.target.value }))} placeholder="Enter the corrected statement." />
                  </label>
                  <label className="guided-capture-label">Why this correction is needed
                    <textarea rows={2} value={correctionContexts[item.id] || ''} onChange={event => setCorrectionContexts(current => ({ ...current, [item.id]: event.target.value }))} placeholder="Record the caregiver's correction context. The corrected statement must appear here." />
                  </label>
                  <div className="guided-actions">
                    <button className="guided-primary" type="button" disabled={proposalBusy} onClick={() => void reviewOutcomeProposal(item, 'accept')}>Accept as caregiver report</button>
                    <button className="guided-secondary" type="button" disabled={proposalBusy || !(correctionDrafts[item.id] || '').trim() || !(correctionContexts[item.id] || '').includes((correctionDrafts[item.id] || '').trim())} onClick={() => void reviewOutcomeProposal(item, 'correct')}>Save correction</button>
                    <button className="guided-secondary" type="button" disabled={proposalBusy} onClick={() => void reviewOutcomeProposal(item, 'reject')}>Reject</button>
                  </div>
                </>}
              </article>)}
            </div>}
          </div>}
          {(!outcome || outcome.status === 'no_outcome_information') && <p className="guided-muted">No appointment outcome has been recorded yet. You can return later; SolenOS will not invent what happened.</p>}
          {outcome?.limitations?.map((item, index) => <p className="guided-footnote" key={index}>{item}</p>)}
        </div>}

        <div className="guided-status" role="status" aria-live="polite">{message}{error && <span>{error}</span>}</div>
        <button className="guided-details-toggle" type="button" aria-expanded={showDetailed} onClick={() => { if (showDetailed) void refreshSavedWorkspace(); setShowDetailed(value => !value) }}>{showDetailed ? 'Close detailed appointment controls' : 'Open detailed appointment and follow-up controls (optional)'}</button>
        {showDetailed && <div className="guided-detailed"><p>Use these additional controls only when you need to review individual sections or manage follow-up actions. The guided appointment stages above remain the normal path.</p><DetailedAppointmentWorkspace /></div>}
      </>}
      <style jsx>{`
        .guided-appointment { color:var(--theme-panel-fg); }
        .guided-stages { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; margin:18px 0 0; }
        .guided-stages button { min-height:44px; border:1px solid var(--theme-panel-border); border-radius:11px; background:var(--theme-panel-bg); color:var(--theme-panel-muted); font:inherit; font-size:13px; font-weight:750; cursor:pointer; }
        .guided-stages button.is-active { border-color:var(--theme-success-border); background:var(--theme-selected-bg); color:var(--theme-panel-fg); }
        .guided-panel { margin-top:16px; padding:16px; border:1px solid var(--theme-panel-border); border-radius:14px; background:var(--theme-subtle-bg); }
        .guided-panel-heading { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; }
        .guided-panel h4 { margin:0; color:var(--theme-panel-fg); font-size:17px; }
        .guided-panel-heading p,.guided-muted { margin:5px 0 0; color:var(--theme-panel-muted); font-size:12px; line-height:1.6; }
        .guided-state { padding:5px 8px; border:1px solid var(--theme-panel-border); border-radius:99px; color:var(--theme-panel-muted); font-size:10px; white-space:nowrap; }
        .guided-columns { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; margin-top:15px; }
        .guided-columns section,.guided-appointments { min-width:0; padding:12px; border:1px solid var(--theme-panel-border); border-radius:11px; background:var(--theme-panel-bg); }
        .guided-panel h5 { margin:0 0 9px; color:var(--theme-panel-fg); font-size:12px; }
        .guided-columns ul,.guided-appointments ul { margin:0; padding-left:17px; }
        .guided-columns li { margin:0 0 11px; color:var(--theme-panel-fg); font-size:12px; line-height:1.5; overflow-wrap:anywhere; }
        .guided-columns li p { margin:3px 0; }
        .guided-columns li small,.guided-appointments li span { display:block; color:var(--theme-panel-muted); font-size:10px; }
        .guided-appointments { margin-top:12px; }
        .guided-appointments li { display:flex; justify-content:space-between; gap:10px; margin:7px 0; font-size:12px; }
        .guided-footnote { margin:12px 0 0; color:var(--theme-panel-muted); font-size:10px; line-height:1.55; }
        .guided-capture-label { display:flex; flex-direction:column; gap:7px; margin-top:14px; color:var(--theme-panel-fg); font-size:12px; font-weight:750; }
        .guided-capture-label textarea { width:100%; box-sizing:border-box; min-height:100px; padding:12px; border:1px solid var(--theme-panel-border); border-radius:10px; background:var(--theme-field-bg); color:var(--theme-field-fg); font:inherit; font-size:14px; line-height:1.55; resize:vertical; }
        .guided-actions { display:flex; flex-wrap:wrap; gap:8px; margin-top:12px; }
        .guided-primary,.guided-secondary { min-height:42px; padding:10px 14px; border:1px solid var(--theme-action-border); border-radius:11px; background:var(--theme-action-bg); color:var(--theme-action-fg); font:inherit; font-size:12px; font-weight:750; cursor:pointer; }
        .guided-secondary { background:var(--theme-panel-bg); }
        .guided-primary:disabled,.guided-secondary:disabled { opacity:.6; cursor:not-allowed; }
        .guided-outcome { margin-top:16px; padding:14px; border:1px solid var(--theme-panel-border); border-radius:12px; background:var(--theme-panel-bg); }
        .guided-outcome h5 { margin:0 0 12px; }
        .guided-outcome section { padding:10px 0; border-top:1px solid var(--theme-panel-border); }
        .guided-outcome h6 { margin:0 0 5px; color:#526653; font-size:11px; text-transform:capitalize; }
        .guided-outcome p { margin:0; color:var(--theme-panel-fg); font-size:12px; line-height:1.55; white-space:pre-wrap; }
        .guided-outcome small { display:block; margin-top:4px; color:var(--theme-panel-muted); font-size:10px; }
        .guided-proposals { margin-top:16px; padding-top:12px; border-top:1px solid var(--theme-panel-border); }
        .guided-proposal { margin-top:10px; padding:12px; border:1px solid var(--theme-panel-border); border-radius:10px; background:var(--theme-subtle-bg); }
        .guided-proposal strong { color:var(--theme-panel-fg); font-size:12px; }
        .guided-proposal p { margin:7px 0; color:var(--theme-panel-fg); font-size:12px; line-height:1.55; white-space:pre-wrap; }
        .guided-proposal small { color:var(--theme-panel-muted); font-size:10px; }
        .guided-status { margin-top:10px; color:var(--theme-panel-muted); font-size:11px; }
        .guided-status span { display:block; color:var(--theme-error-fg); margin-top:4px; }
        .guided-details-toggle { margin-top:16px; padding:9px 0; border:0; background:transparent; color:var(--theme-link); font:inherit; font-size:12px; font-weight:750; text-decoration:underline; cursor:pointer; }
        .guided-detailed { margin-top:12px; padding-top:12px; border-top:1px solid var(--theme-panel-border); }
        .guided-detailed > p { color:var(--theme-panel-muted); font-size:11px; line-height:1.5; }
        @media(max-width:640px) { .guided-columns { grid-template-columns:minmax(0,1fr); } .guided-appointments li { display:block; } .guided-actions button,.guided-primary { width:100%; } .guided-panel { padding:13px; } }
      `}</style>
    </section>
  )
}
