'use client'

import { useEffect, useState } from 'react'
import { ensureAnonymousSession, getJSON, postJSON, patchJSON } from '@/api/client'
import { caregiverInformationAreaLabel, caregiverInformationLabel, caregiverRoleLabel, caregiverSafeAssistantText, caregiverStatusLabel } from '@/lib/caregiver-language'
import { CalendarDays, ShieldCheck } from 'lucide-react'
import DetailedAppointmentWorkspace from './DetailedAppointmentWorkspace'
import QwenAssistPanel from '@/components/qwen/QwenAssistPanel'

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
    source_time_kind?: string
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
  evidence_review_records?: Array<{
    review_id: string
    evidence_id: string
    review_type: string
    outcome: string
    rationale: string
    policy_version: string
    created_at?: string | null
    interpretation_limit: string
  }>
  claim_assessments?: Array<{
    assessment_id: string
    claim_id: string
    claim_version: number
    status: string
    rationale: string
    policy_version: string
    created_at?: string | null
    interpretation_limit: string
  }>
  completeness_assessments?: Array<{
    assessment_id: string
    subject_type: string
    subject_id: string
    assessment_status: string
    missing_fields: string[]
    semantic_sufficiency: string
    rationale: string
    interpretation_limit: string
  }>
  source_coverage: {
    evidence_freshness_assessments: string
    evidence_review_records?: string
    evidence_claim_assessments?: string
    evidence_completeness_assessments?: string
    open_questions?: string
    contradictions?: string
    medications_and_allergies?: string
  }
  living_care_record_context?: {
    retrieval_scan_complete?: boolean
    retrieval_projection_complete?: boolean
    schema_status?: string
    missing_required_sources?: string[]
    missing_optional_sources?: string[]
    sources?: Record<string, { status?: string; returned_count?: number; has_more?: boolean; candidate_scan_complete?: boolean }>
  }
  source_completeness?: Record<string, {
    returned_count: number
    has_more: boolean | null
    retrieval_complete: boolean
    record_limit?: number
    candidate_count?: number | null
    additional_ordinary_count?: number | null
    display_limited?: boolean
    interpretation_limit?: string
  }>
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
          setError('Your visit summary could not be loaded. Your care record has not been changed.')
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
      // Candidates stay in proposal storage until explicit caregiver acceptance creates an care record detail.
      if (result.written_to_lcr === true) window.dispatchEvent(new Event("careRecordUpdated"))
      setMessage((result.count || 0) + ' possible care updates were prepared from your saved appointment details. Nothing is added to your Care Record until you review and approve a suggested detail.')
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
              ? 'Accepted as a caregiver-reviewed care record detail, and the care record was reassessed. It is not clinically verified.'
              : 'Added to your Care Record as your report. A healthcare professional has not confirmed it.'
            : 'No care record detail was created.')
        : decision === 'correct'
          ? 'Your correction was saved for review. It will not change your Care Record until you approve it.'
          : 'You chose not to add this detail. Your decision is saved in the review history.')
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
        <div className="appointment-boundary"><ShieldCheck size={17} aria-hidden="true" /><span>You do not have to fill in forms before, during or after a visit. Notes are optional. Your reports stay marked as yours, and nothing here changes your Care Record without your approval.</span></div>
        <nav className="guided-stages" aria-label="Appointment stages">
          {([['prepare', 'Before'], ['during', 'During'], ['after', 'After']] as const).map(([key, label]) => (
            <button key={key} type="button" className={stage === key ? 'is-active' : ''} aria-pressed={stage === key} onClick={() => setStage(key)}>{label}</button>
          ))}
        </nav>

        {loading && <p className="guided-muted" role="status">Preparing your appointment view…</p>}

        {stage === 'prepare' && <div className="guided-panel">
          <div className="guided-panel-heading"><div><h4>Your visit summary</h4><p>Prepared from information already in your Care Record. Nothing to fill in.</p></div><span className="guided-state">For reference</span></div>
          {!brief && <p className="guided-muted">Your care history could not be loaded. Missing information is not treated as proof that it does not exist.</p>}
          {brief && <>
            
            <section className="appointment-quick-summary" aria-label="Appointment preparation summary">
              <h5>What SolenOS found</h5>
              <p className="guided-muted">Prepared from the care information SolenOS could access. You do not need to rewrite information already in your Care Record.</p>
              {(brief.living_care_record_context?.retrieval_scan_complete !== true ||
                brief.living_care_record_context?.retrieval_projection_complete !== true ||
                brief.living_care_record_context?.schema_status !== "complete" ||
                (brief.living_care_record_context?.missing_required_sources?.length ?? 0) > 0 ||
                Object.values(brief.source_completeness ?? {}).some(item => item.retrieval_complete === false || item.has_more === true)) &&
                <p className="guided-muted" role="status">Some saved care information could not be fully checked. This summary may be incomplete; that does not mean the information is missing from your Care Record.</p>}
              {brief.events.length === 0 && brief.facts.length === 0 && !(brief.assertions?.length) && !(brief.open_questions?.length) && brief.appointments.length === 0
                ? <p className="guided-muted">There is not enough linked care information available to prepare a useful visit summary yet. This describes what SolenOS could retrieve, not everything the family may know or have recorded.</p>
                : <div className="guided-columns">
                    {brief.events.length > 0 && <section><h6>Recent changes</h6><ul>{brief.events.slice(0, 3).map(item => <li key={item.source_id}><strong>{caregiverSafeAssistantText(item.title) || "Care update"}</strong>{item.description && <p>{caregiverSafeAssistantText(item.description)}</p>}<small>{item.occurred_at ? new Date(item.occurred_at).toLocaleDateString() : "Date not recorded"} · {caregiverStatusLabel(item.status) || "Status not available"}</small></li>)}</ul></section>}
                    {brief.facts.length > 0 && <section><h6>Saved care details</h6><ul>{brief.facts.slice(0, 3).map(item => <li key={item.source_id}><p>{caregiverSafeAssistantText(item.value) || "Saved care detail"}</p><small>{caregiverInformationLabel(item.epistemic_status) || "Status not available"}</small></li>)}</ul></section>}
                    {brief.open_questions?.length ? <section><h6>Questions still needing an answer</h6><ul>{brief.open_questions.slice(0, 3).map(item => <li key={item.source_id}><strong>{caregiverSafeAssistantText(item.question) || "Question needs review"}</strong><small>{caregiverStatusLabel(item.priority) || "Priority not available"}</small></li>)}</ul></section> : null}
                    {brief.contradictions?.length ? <section><h6>Information that needs clarification</h6><ul>{brief.contradictions.slice(0, 2).map(item => <li key={item.source_id}><p>{caregiverSafeAssistantText(item.description) || "Some reports differ"}</p><small>{caregiverStatusLabel(item.resolution_status) || "Review needed"}</small></li>)}</ul></section> : null}
                    {brief.appointments.length > 0 && <section><h6>Appointments already recorded</h6><ul>{brief.appointments.slice(0, 2).map(item => <li key={item.source_id}><strong>{caregiverSafeAssistantText(item.title) || "Appointment"}</strong><small>{item.scheduled_at ? new Date(item.scheduled_at).toLocaleString() : "Date not recorded"} · {caregiverStatusLabel(item.status) || "Status not available"}</small></li>)}</ul></section>}
                  </div>}
              <details className="appointment-source-review">
                <summary>Review source details and information checks</summary>
                <p className="guided-footnote">These details explain which records SolenOS could access and what checks were completed. They are here when you need them; you do not need to manage them to prepare for a visit.</p>
<div className="guided-columns">
              {(Object.entries(brief.source_completeness ?? {}).some(([, coverage]) => coverage.has_more === true || coverage.retrieval_complete === false) ||
                brief.living_care_record_context == null ||
                brief.living_care_record_context.retrieval_scan_complete !== true ||
                brief.living_care_record_context.retrieval_projection_complete !== true ||
                brief.living_care_record_context.schema_status !== "complete" ||
                (brief.living_care_record_context.missing_required_sources?.length ?? 0) > 0 ||
                (brief.living_care_record_context.missing_optional_sources?.length ?? 0) > 0) && <section className="guided-muted guided-full-span" role="status">
                <h5>Some parts of your Care Record could not be fully checked</h5>
                <p>This appointment summary shows only some saved care information. Check your full Care Record before relying on it as the complete history.</p>
                {brief.living_care_record_context == null && <p>This service did not return the Care Record coverage details needed to confirm this summary is complete. Open the full Care Record before relying on it as the complete history.</p>}
                {brief.living_care_record_context?.schema_status === "failed" && <p>We could not check the full Care Record just now. Refresh or open the Care Record before relying on this visit summary.</p>}
                {brief.living_care_record_context?.missing_required_sources?.length ? <p>Sources that could not be checked: {brief.living_care_record_context.missing_required_sources.map(source => caregiverInformationAreaLabel(source) || "Other care information").join(", ")}.</p> : null}
                {brief.living_care_record_context?.missing_optional_sources?.length ? <p>Some other saved care information is not available in this view.</p> : null}
                <ul>{Object.entries(brief.source_completeness ?? {}).filter(([, coverage]) => coverage.has_more === true || coverage.retrieval_complete === false).map(([source, coverage]) => <li key={source}>{caregiverInformationAreaLabel(source) || "Other care information"}: {coverage.returned_count} {coverage.returned_count === 1 ? "detail" : "details"} shown{coverage.has_more ? "; more saved details are available" : ""}</li>)}</ul>
                {Object.entries(brief.living_care_record_context?.sources ?? {}).filter(([, source]) => source.has_more === true || source.candidate_scan_complete === false).length > 0 && <ul>{Object.entries(brief.living_care_record_context?.sources ?? {}).filter(([, source]) => source.has_more === true || source.candidate_scan_complete === false).map(([source, coverage]) => <li key={source}>{caregiverInformationAreaLabel(source) || "Other care information"}: {coverage.returned_count ?? 0} {coverage.returned_count === 1 ? "detail" : "details"} shown{coverage.has_more ? "; more saved information remains" : ""}</li>)}</ul>}
              </section>}
              {brief.source_completeness?.open_questions?.display_limited && <p className="guided-muted guided-full-span">There may be more questions in your Care Record. This view shows the most important ones first.</p>}
              <section><h5>Recent care history</h5>{brief.events.length ? <ul>{brief.events.slice(0, 6).map(item => <li key={item.source_id}><strong>{caregiverSafeAssistantText(item.title) || 'Care update'}</strong>{item.description && <p>{caregiverSafeAssistantText(item.description) || 'No further details are available.'}</p>}<small>{item.occurred_at ? new Date(item.occurred_at).toLocaleDateString() : 'Date not recorded'} · {caregiverStatusLabel(item.status) || "Status not available"}</small></li>)}</ul> : <p className="guided-muted">No recent care updates are available for this summary.</p>}</section>
              <section><h5>Saved care details</h5>{brief.facts.length ? <ul>{brief.facts.slice(0, 6).map(item => <li key={item.source_id}><strong>Care information</strong><p>{caregiverSafeAssistantText(item.value) || 'No detail recorded'}</p><small>{caregiverInformationLabel(item.epistemic_status) || 'Status not available'}</small></li>)}</ul> : <p className="guided-muted">No saved care details are available for this summary.</p>}{brief.source_coverage.medications_and_allergies === "unavailable" && <p className="guided-muted">A separate medication and allergy list is not available. Only details recorded in the care information above are shown.</p>}</section>
            </div>
            <section className="guided-assertions"><h5>What was noticed and reported</h5>{brief.assertions?.length ? <ul>{brief.assertions.slice(0, 10).map(item => <li key={item.source_id}><strong>Care detail</strong><p>{caregiverSafeAssistantText(item.asserted_value) || 'Saved care detail'}</p><small>{caregiverSafeAssistantText(item.source_label) || 'Saved care record'} · Information: {caregiverInformationLabel(item.epistemic_state || "reported") || "Caregiver report"} · Review: {caregiverStatusLabel(item.assertion_status) || "Status not available"} · {item.observed_at ? new Date(item.observed_at).toLocaleString() : caregiverSafeAssistantText(item.event_time_text) || "Event time not recorded"}</small>{item.source_text && item.source_text !== item.asserted_value && <p>{caregiverSafeAssistantText(item.source_text.slice(0, 280)) || 'The original wording is available in the saved note or document.'}</p>}<small>{caregiverSafeAssistantText(item.interpretation_limit) || 'The available information may not tell the whole story.'}{item.evidence_ids.length ? ` · ${item.evidence_ids.length} related {item.evidence_ids.length === 1 ? "note or document" : "notes or documents"}` : " · No related note or document attached"}</small></li>)}</ul> : <p className="guided-muted">{brief.assertions ? "No care details could be matched to their original notes or reports in this summary." : "SolenOS could not load care details linked to their original notes or reports."}</p>}</section>
            <section className="guided-questions"><h5>Questions to ask the healthcare professional</h5>{brief.source_coverage.open_questions === "failed" ? <p className="guided-muted">Questions that still need answers could not be loaded.</p> : brief.open_questions?.length ? <ul>{brief.open_questions.slice(0, 8).map(item => <li key={item.source_id}><strong>{caregiverSafeAssistantText(item.question) || 'A question needs an answer'}</strong><small>{caregiverSafeAssistantText(item.intended_answerer_label) || caregiverRoleLabel(item.intended_answerer_role) || "Who may know was not recorded"} · {caregiverStatusLabel(item.priority) || "Priority not available"} · {caregiverStatusLabel(item.status) || "Status not available"}</small>{item.necessity_rationale && <p>{caregiverSafeAssistantText(item.necessity_rationale) || 'More information may be needed.'}</p>}</li>)}</ul> : <p className="guided-muted">{brief.open_questions ? "No unanswered questions are shown here. This does not mean none exist." : "Questions that still need answers are not available in this summary."}</p>}</section>
            <section className="guided-conflicts"><h5>Concerns and reports that do not match</h5>{brief.source_coverage.contradictions === "failed" ? <p className="guided-muted">Reports that do not match could not be loaded.</p> : brief.contradictions?.length ? <ul>{brief.contradictions.slice(0, 8).map(item => <li key={item.source_id}><strong>Care detail · {caregiverStatusLabel(item.resolution_status) || "Review needed"}</strong><p>{caregiverSafeAssistantText(item.description) || 'No further details are available.'}</p>{item.unresolved_remainder && <p>{caregiverSafeAssistantText(item.unresolved_remainder) || 'What remains unclear was not recorded.'}</p>}<small>Related care details: {item.source_assertion_ids.length} · Notes and documents: {item.evidence_ids.length}</small></li>)}</ul> : <p className="guided-muted">{brief.contradictions ? "No reports that do not match were found in this summary." : "Information about reports that differ is not available in this summary."}</p>}</section>
            <section className="guided-appointments"><h5>Appointments</h5>{brief.appointments.length ? <ul>{brief.appointments.slice(0, 5).map(item => <li key={item.source_id}><strong>{caregiverSafeAssistantText(item.title) || "Appointment"}</strong><span>{item.scheduled_at ? new Date(item.scheduled_at).toLocaleString() : 'Date not recorded'} · {caregiverStatusLabel(item.status) || "Status not available"}</span></li>)}</ul> : <p className="guided-muted">No appointment is recorded in this summary. This does not mean that no appointment exists.</p>}</section>
            <section className="guided-lineage" aria-label="How the notes and documents are related">
              <h5>How the notes and documents are related</h5>
              {brief.evidence_lineage.groups.length ? <ul>{brief.evidence_lineage.groups.map(group => <li key={group.lineage_id}><strong>{group.source_independence_status === "shared_origin" ? "Same original" : group.source_independence_status === "independent" ? "Reported separately" : group.source_independence_status === "not_assessed" ? "Not checked" : "Not known"}</strong><p>{group.evidence_ids.length} {group.evidence_ids.length === 1 ? "note or document" : "notes or documents"}</p></li>)}</ul> : <p className="guided-muted">We could not check whether some of these notes or documents came from the same original. Do not assume they are separate.</p>}
              <p className="guided-footnote">A connection between notes does not prove that a report is true or came from a separate person.</p>
              {brief.evidence_lineage.scope_truncated && <p className="guided-muted">Only some connections between these notes and documents could be checked. We do not know whether the reports are separate.</p>}
            </section>
            <section className="guided-freshness" aria-label="How recent this information is">
              <h5>How recent this information is</h5>
              {brief.source_coverage.evidence_freshness_assessments === 'unavailable' && <p className="guided-muted">We couldn’t check how recent this information is right now.</p>}
              {brief.freshness_assessments.length ? <ul>{brief.freshness_assessments.slice(0, 8).map(item => <li key={item.assessment_id}>
                <strong>How recent: {caregiverStatusLabel(item.freshness_status) || 'Not checked'}</strong>
                <p>{caregiverSafeAssistantText(item.rationale) || 'No further explanation is available.'}</p>
                <small>Date on the information: {item.source_time ? new Date(item.source_time).toLocaleString() : 'Not recorded'} · Checked {item.assessed_at ? new Date(item.assessed_at).toLocaleString() : 'time not recorded'}</small>
                <small>{caregiverSafeAssistantText(item.interpretation_limit) || 'The available dates may not tell the whole story.'}</small>
              </li>)}</ul> : brief.source_coverage.evidence_freshness_assessments !== 'unavailable' && <p className="guided-muted">We couldn’t check how recent the linked information is. This does not mean it is current.</p>}
              <p className="guided-footnote">{caregiverSafeAssistantText(brief.freshness_assessment_scope.interpretation_limit) || "The available dates may not tell the whole story."}</p>
            </section>
            <section className="guided-freshness" aria-label="What has been checked about these notes and claims">
              <h5>What has been checked about these notes</h5>
              {!brief.source_coverage?.evidence_review_records || brief.source_coverage.evidence_review_records === "unavailable" || brief.source_coverage.evidence_review_records === "failed"
                ? <p className="guided-muted">Source review history could not be loaded. That does not mean the notes have been checked.</p>
                : brief.evidence_review_records?.length
                  ? <ul>{brief.evidence_review_records.slice(0, 8).map(item => <li key={item.review_id}>
                    <strong>Source review · {caregiverStatusLabel(item.outcome) || "Status not available"}</strong>
                    <p>{caregiverSafeAssistantText(item.rationale) || "No review explanation was recorded."}</p>
                    <small>{caregiverSafeAssistantText(item.interpretation_limit) || "A source review does not independently confirm a care fact."}</small>
                  </li>)}</ul>
                  : <p className="guided-muted">No source review is recorded for the linked notes. They remain reports or source material, not confirmed facts.</p>}
              {!brief.source_coverage?.evidence_claim_assessments || brief.source_coverage.evidence_claim_assessments === "unavailable" || brief.source_coverage.evidence_claim_assessments === "failed"
                ? <p className="guided-muted">Claim review history could not be loaded.</p>
                : brief.claim_assessments?.length
                  ? <ul>{brief.claim_assessments.slice(0, 8).map(item => <li key={item.assessment_id}>
                    <strong>Care detail · {caregiverStatusLabel(item.status) || "Needs checking"}</strong>
                    <p>{caregiverSafeAssistantText(item.rationale) || "No review explanation was recorded."}</p>
                    <small>{caregiverSafeAssistantText(item.interpretation_limit) || "This review does not independently confirm a clinical fact."}</small>
                  </li>)}</ul>
                  : <p className="guided-muted">No claim review is recorded for the saved reports shown here.</p>}
              {!brief.source_coverage?.evidence_completeness_assessments || brief.source_coverage.evidence_completeness_assessments === "unavailable" || brief.source_coverage.evidence_completeness_assessments === "failed"
                ? <p className="guided-muted">The check for missing source details is not available.</p>
                : brief.completeness_assessments?.length
                  ? <ul>{brief.completeness_assessments.slice(0, 8).map(item => <li key={item.assessment_id}>
                    <strong>Recorded source details · {caregiverStatusLabel(item.assessment_status) || "Status not available"}</strong>
                    {item.missing_fields?.length ? <p>Not recorded: {item.missing_fields.map(field => caregiverSafeAssistantText(field)).filter(Boolean).join(", ")}</p> : null}
                    <p>{caregiverSafeAssistantText(item.rationale) || "No further explanation is available."}</p>
                    <small>{caregiverSafeAssistantText(item.interpretation_limit) || "A field checklist does not prove the information is complete enough to guide care."}</small>
                  </li>)}</ul>
                  : <p className="guided-muted">No check for missing source details is recorded for the linked notes.</p>}
            </section>
              </details>
