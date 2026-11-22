'use client'

import { useEffect, useState } from 'react'
import { ensureAnonymousSession, getJSON, postJSON, patchJSON } from '@/api/client'
import { caregiverFieldLabel, caregiverInformationAreaLabel, caregiverInformationLabel, caregiverRoleLabel, caregiverSafeAssistantText, caregiverSafeGeneratedText, caregiverStatusLabel } from '@/lib/caregiver-language'
import { CalendarDays, ShieldCheck } from 'lucide-react'
import { extractAttachedDocument } from '@/components/mvp-workspace/capture/extract-attached'

type Stage = 'prepare' | 'during' | 'after'
type PreparationBrief = {
  snapshot_at: string
  facts: Array<{ source_id: string; fact_type: string; value: string | null; epistemic_status: string; effective_at?: string | null }>
  events: Array<{ source_id: string; title: string; description?: string | null; occurred_at?: string | null; status: string; recorded_by_role?: string; time_provenance?: string | null; evidence_ids?: string[] }>
  appointments: Array<{ source_id: string; title: string; scheduled_at?: string | null; provider?: string | null; location?: string | null; status: string; evidence_ids?: string[] }>
  next_appointment?: { source_id: string; title: string; scheduled_at?: string | null; provider?: string | null; location?: string | null; status: string; evidence_ids?: string[] } | null
  appointment_context_status?: { code: string; has_appointment_information: boolean; date_known: boolean | null; next_appointment_id?: string | null; interpretation_limit?: string }
  appointment_recorded_events?: Array<{ source_id: string; title: string; description?: string | null; occurred_at?: string | null; status: string; recorded_by_role?: string; time_provenance?: string | null; evidence_ids?: string[] }>
  previous_appointment?: { source_id: string; title: string; scheduled_at?: string | null; provider?: string | null; status: string } | null
  change_window?: { starts_at?: string | null; basis: string; interpretation_limit?: string }
  lcr_retrieval_status?: { status: string; schema_status?: string; scan_complete?: boolean; projection_complete?: boolean; failed_sources?: string[]; missing_required_sources?: string[]; missing_optional_sources?: string[]; retrieval_error?: string | null }
  documents?: Array<{ source_id: string; source_evidence_id?: string; filename?: string | null; extracted_text?: string | null; extraction_status?: string | null; recorded_at?: string | null; epistemic_status?: string | null; interpretation_limit?: string }>
  open_loops?: Array<{ source_id: string; appointment_id?: string | null; source_workspace_id?: string | null; title: string; description?: string | null; status: string; priority?: string | null; owner_label?: string | null; deadline_at?: string | null; source_type?: string | null; interpretation_limit?: string }>
  prior_decisions?: Array<{ id: string; title?: string | null; decision_text?: string | null; decision_status?: string | null; decided_at?: string | null; context?: string | null }>
  decision_outcomes?: Array<{ id: string; decision_id?: string | null; outcome_status?: string | null; description?: string | null; observed_at?: string | null }>
  assertions?: Array<{ source_id: string; field: string; asserted_value: string; assertion_kind: string; epistemic_state: string; assertion_status: string; source_label: string; source_text?: string | null; event_time_text?: string | null; observed_at?: string | null; recorded_at?: string | null; evidence_ids: string[]; interpretation_limit: string }>
  open_questions?: Array<{ source_id: string; question: string; subject_type?: string | null; intended_answerer_role?: string | null; intended_answerer_label?: string | null; necessity: string; necessity_rationale?: string | null; priority: string; status: string; evidence_ids: string[]; asked_at?: string | null }>
  appointment_needs?: Array<{ source_id: string; question: string; intended_answerer_role?: string | null; intended_answerer_label?: string | null; necessity_rationale?: string | null; priority: string; status: string; interpretation_limit: string }>
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
    documents?: string
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
  created_at?: string | null
  updated_at?: string | null
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

const appointmentFollowUpText = (payload?: Record<string, unknown>) => {
  const value = payload?.followUps ?? payload?.follow_ups
  if (!Array.isArray(value)) return ''
  return value
    .map(item => item && typeof item === 'object' && 'action' in item && typeof item.action === 'string' ? item.action : '')
    .filter(Boolean)
    .join('\n')
}

const appointmentFollowUpsFromText = (
  value: string,
  existingPayload?: Record<string, unknown>,
  identity = 'appointment',
) => {
  const previous = existingPayload?.followUps ?? existingPayload?.follow_ups
  const priorItems = Array.isArray(previous)
    ? previous.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    : []
  const used = new Set<number>()
  return value
    .split(/\r?\n/)
    .map(action => action.trim())
    .filter(Boolean)
    .map((action, index) => {
      const normalized = action.toLocaleLowerCase().replace(/\s+/g, ' ')
      let priorIndex = priorItems.findIndex((item, candidateIndex) =>
        !used.has(candidateIndex) &&
        typeof item.action === 'string' &&
        item.action.toLocaleLowerCase().replace(/\s+/g, ' ') === normalized
      )
      if (priorIndex < 0 && priorItems[index] && !used.has(index)) priorIndex = index
      const prior = priorIndex >= 0 ? priorItems[priorIndex] : undefined
      if (priorIndex >= 0) used.add(priorIndex)
      return {
        ...(prior || {}),
        id: typeof prior?.id === 'string' && prior.id
          ? prior.id
          : 'appointment-follow-up:' + identity + ':' + (index + 1),
        action,
        status: typeof prior?.status === 'string' ? prior.status : 'not_recorded',
        owner_role: typeof prior?.owner_role === 'string' ? prior.owner_role : 'unassigned',
      }
    })
}

const latestWorkspaceForAppointment = (items: WorkspaceRecord[], appointmentId: string | null) => {
  if (!appointmentId) return null
  return items
    .filter(item => item.appointment_id === appointmentId)
    .sort((a, b) => {
      const aUpdated = Date.parse(a.updated_at || a.created_at || '') || 0
      const bUpdated = Date.parse(b.updated_at || b.created_at || '') || 0
      // updated_at can have coarse precision in local test databases. Use
      // the persisted optimistic-lock version as a deterministic tie-breaker
      // so a newly revised workspace wins over an older preparation snapshot.
      return bUpdated - aUpdated || (b.version_number || 0) - (a.version_number || 0)
    })[0] || null
}

const selectNextAppointment = (brief: PreparationBrief) => {
  if (brief.next_appointment) return brief.next_appointment
  const recorded = [...brief.appointments]
  const upcoming = recorded
     .filter(item => ['scheduled', 'upcoming', 'today', 'rescheduled', 'date_unknown', 'overdue'].includes(item.status.toLowerCase()))
    .sort((a, b) => {
      const aTime = a.scheduled_at ? Date.parse(a.scheduled_at) : Number.MAX_SAFE_INTEGER
      const bTime = b.scheduled_at ? Date.parse(b.scheduled_at) : Number.MAX_SAFE_INTEGER
      return aTime - bTime
    })[0]
  if (upcoming) return upcoming
  // When there is no future visit, return to the most recent recorded
  // completed visit so after-appointment continuity remains attached to it.
  return recorded.find(item => ['completed', 'resolved', 'historical'].includes(item.status.toLowerCase())) || null
}

export default function AppointmentWorkspace() {
  const [open, setOpen] = useState(true)
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
  const [professionalStatement, setProfessionalStatement] = useState('')
  const [recordedDecisions, setRecordedDecisions] = useState('')
  const [recordedInstructions, setRecordedInstructions] = useState('')
  const [unansweredQuestions, setUnansweredQuestions] = useState('')
  const [followUps, setFollowUps] = useState('')
  const [attachedEvidenceIds, setAttachedEvidenceIds] = useState<string[]>([])
  const [documentBusy, setDocumentBusy] = useState(false)
  const [documentMessage, setDocumentMessage] = useState('')
  const [pendingDocumentEvidenceId, setPendingDocumentEvidenceId] = useState('')
  const [pendingDocumentName, setPendingDocumentName] = useState('')
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveRetry, setSaveRetry] = useState<AppointmentSaveRetry | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setStage('prepare')
    setError('')
    setMessage('')
    setBrief(null)
    setRecord(null)
    setAppointmentId('')
    setOutcome(null)
    setOutcomeProposals([])
    setNote('')
    setProfessionalStatement('')
    setRecordedDecisions('')
    setRecordedInstructions('')
    setUnansweredQuestions('')
    setFollowUps('')
    setAttachedEvidenceIds([])
    setDocumentMessage('')
    setPendingDocumentEvidenceId('')
    setPendingDocumentName('')
    setCorrectionDrafts({})
    setCorrectionContexts({})
    void (async () => {
      try {
        await ensureAnonymousSession()
        const [briefResult, workspaceResult] = await Promise.allSettled([
          getJSON('/appointment-workspaces/preparation-brief?window_days=90') as Promise<PreparationBrief>,
          getJSON('/appointment-workspaces') as Promise<{ items?: WorkspaceRecord[] }>,
        ])
        if (cancelled) return
        let selectedAppointmentId: string | null = null
        let selectedAppointmentStatus: string | null = null
        if (briefResult.status === 'fulfilled') {
          setBrief(briefResult.value)
          const nextAppointment = selectNextAppointment(briefResult.value)
          selectedAppointmentId = nextAppointment?.source_id || null
          selectedAppointmentStatus = nextAppointment?.status?.toLowerCase() || null
          setAppointmentId(selectedAppointmentId || '')
          if (nextAppointment && ['completed', 'resolved', 'historical'].includes(nextAppointment.status.toLowerCase())) {
            setStage('after')
          }
        } else {
          setError('Your visit summary could not be loaded. Your care record has not been changed.')
        }
        if (workspaceResult.status === 'fulfilled' && briefResult.status === 'fulfilled') {
          const items = workspaceResult.value.items || []
          let latest = selectedAppointmentId
            ? latestWorkspaceForAppointment(items, selectedAppointmentId)
            : null
          // Prepare and persist the workspace automatically for an existing
          // scheduled appointment. The caregiver does not complete a form.
          // This creates continuity workspace only; it does not book a visit.
          if (
            !latest &&
            selectedAppointmentId &&
            ['scheduled', 'upcoming', 'today', 'rescheduled', 'date_unknown'].includes(selectedAppointmentStatus || '')
          ) {
            try {
              const generated = await postJSON('/appointment-workspaces/ensure-upcoming', {}) as { workspace?: WorkspaceRecord | null }
              // Never attach a workspace for a different appointment just
              // because it happens to be the next one returned by the server.
              latest = generated.workspace?.appointment_id === selectedAppointmentId
                ? generated.workspace
                : null
              if (!latest && !cancelled) {
                setMessage('Your visit summary is ready. Its preparation workspace could not be matched to this appointment; no other visit was substituted.')
              }
            } catch {
              if (!cancelled) setMessage('Your visit summary is ready. Its preparation workspace could not be saved just now; you can still review the summary and try again later.')
            }
          }
          if (
            (latest?.status === 'outcome_pending' || latest?.payload?.captureStage === 'after') &&
            !cancelled
          ) {
            // Restore the after-visit workspace stage without changing the
            // appointment lifecycle or asserting that attendance was confirmed.
            setStage('after')
          }
          if (latest) {
            setRecord(latest)
            if (latest.appointment_id) setAppointmentId(latest.appointment_id)
            setNote(typeof latest.payload?.caregiverReport === 'string' ? latest.payload.caregiverReport : '')
            setProfessionalStatement(typeof latest.payload?.clinicianFindings === 'string' ? latest.payload.clinicianFindings : '')
            setRecordedDecisions(typeof latest.payload?.decisions === 'string' ? latest.payload.decisions : '')
            setRecordedInstructions(typeof latest.payload?.instructions === 'string' ? latest.payload.instructions : '')
            setUnansweredQuestions(typeof latest.payload?.unanswered === 'string' ? latest.payload.unanswered : '')
            setFollowUps(appointmentFollowUpText(latest.payload))
            setAttachedEvidenceIds(Array.isArray(latest.payload?.attachedEvidenceIds) ? latest.payload.attachedEvidenceIds.filter((id): id is string => typeof id === 'string') : [])
            try {
              const draft = await getJSON('/appointment-workspaces/' + encodeURIComponent(latest.id) + '/outcome-draft') as OutcomeDraft
              if (!cancelled) setOutcome(draft)
              try {
                const proposals = await getJSON('/appointment-workspaces/' + encodeURIComponent(latest.id) + '/outcome-proposals') as { items?: OutcomeProposal[] }
                let items = proposals.items || []
                if (
                  items.length === 0 &&
                  (latest.status === 'outcome_pending' || latest.payload?.captureStage === 'after') &&
                  typeof latest.payload?.caregiverReport === 'string' &&
                  latest.payload.caregiverReport.trim()
                ) {
                  const prepared = await postJSON('/appointment-workspaces/' + encodeURIComponent(latest.id) + '/outcome-proposals', {}) as { items?: OutcomeProposal[] }
                  items = prepared.items || []
                }
                if (!cancelled) setOutcomeProposals(items)
              } catch {
                if (!cancelled) {
                  setOutcomeProposals([])
                  if (latest.payload?.captureStage === 'after') setError('Your appointment note is saved. SolenOS could not prepare the suggested details just now.')
                }
              }
            } catch {
              if (!cancelled) {
                setOutcome(null)
                setError('Your appointment note is still saved, but we couldn’t load its details. Try refreshing.')
              }
            }
          } else if (!cancelled) {
            setRecord(null)
            setOutcome(null)
            setOutcomeProposals([])
            setNote('')
          }
        } else {
          setError('Saved appointment information could not be loaded. Your care record has not been changed.')
        }
      } catch (cause) {
        if (!cancelled) setError('We couldn’t open the appointment details. Please try again.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [open, reloadToken])

  const refreshOutcome = async (recordId: string) => {
    setError('')
    setMessage('')
    const [draftResult, proposalResult] = await Promise.allSettled([
      getJSON('/appointment-workspaces/' + encodeURIComponent(recordId) + '/outcome-draft') as Promise<OutcomeDraft>,
      getJSON('/appointment-workspaces/' + encodeURIComponent(recordId) + '/outcome-proposals') as Promise<{ items?: OutcomeProposal[] }>,
    ])
    if (draftResult.status === 'fulfilled') setOutcome(draftResult.value)
    if (proposalResult.status === 'fulfilled') setOutcomeProposals(proposalResult.value.items || [])
    if (draftResult.status === 'rejected' || proposalResult.status === 'rejected') {
      setError('Saved appointment information could not be fully refreshed. Your saved notes have not been changed. Try again.')
      return
    }
    setMessage('Appointment information refreshed from your saved records.')
  }

  const refreshSavedWorkspace = async () => {
    await ensureAnonymousSession()
    const [briefResult, workspaceResult] = await Promise.all([
      getJSON('/appointment-workspaces/preparation-brief?window_days=90') as Promise<PreparationBrief>,
      getJSON('/appointment-workspaces') as Promise<{ items?: WorkspaceRecord[] }>,
    ])
    setBrief(briefResult)
    const nextAppointment = selectNextAppointment(briefResult)
    const selectedAppointmentId = nextAppointment?.source_id || null
    setAppointmentId(selectedAppointmentId || '')

    const items = workspaceResult.items || []
    const latest = selectedAppointmentId
      ? latestWorkspaceForAppointment(items, selectedAppointmentId)
      : null
    if (
      (nextAppointment && ['completed', 'resolved', 'historical'].includes(nextAppointment.status.toLowerCase())) ||
      latest?.status === 'outcome_pending' ||
      latest?.payload?.captureStage === 'after'
    ) setStage('after')
    else setStage('prepare')
    setRecord(latest)
    if (!latest) {
      setOutcome(null)
      setOutcomeProposals([])
      setNote('')
      setProfessionalStatement('')
      setRecordedDecisions('')
      setRecordedInstructions('')
      setUnansweredQuestions('')
      setFollowUps('')
      setAttachedEvidenceIds([])
      return
    }
    if (latest.appointment_id) setAppointmentId(latest.appointment_id)
    setNote(typeof latest.payload?.caregiverReport === 'string' ? latest.payload.caregiverReport : '')
    setProfessionalStatement(typeof latest.payload?.clinicianFindings === 'string' ? latest.payload.clinicianFindings : '')
    setRecordedDecisions(typeof latest.payload?.decisions === 'string' ? latest.payload.decisions : '')
    setRecordedInstructions(typeof latest.payload?.instructions === 'string' ? latest.payload.instructions : '')
    setUnansweredQuestions(typeof latest.payload?.unanswered === 'string' ? latest.payload.unanswered : '')
    setFollowUps(appointmentFollowUpText(latest.payload))
    setAttachedEvidenceIds(Array.isArray(latest.payload?.attachedEvidenceIds) ? latest.payload.attachedEvidenceIds.filter((id): id is string => typeof id === 'string') : [])

    const [draftResult, proposalResult] = await Promise.allSettled([
      getJSON('/appointment-workspaces/' + encodeURIComponent(latest.id) + '/outcome-draft') as Promise<OutcomeDraft>,
      getJSON('/appointment-workspaces/' + encodeURIComponent(latest.id) + '/outcome-proposals') as Promise<{ items?: OutcomeProposal[] }>,
    ])
    setOutcome(draftResult.status === 'fulfilled' ? draftResult.value : null)
    setOutcomeProposals(proposalResult.status === 'fulfilled' ? proposalResult.value.items || [] : [])
    if (draftResult.status === 'rejected' || proposalResult.status === 'rejected') {
      setError('Some saved appointment details could not be refreshed. Your saved information has not been changed. Try again.')
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
      try {
        await refreshSavedWorkspace()
      } catch {
        setError('Your review was saved, but appointment details could not refresh. Open the appointment again and try refreshing.')
      }
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

  const linkDocumentToAppointment = async (evidenceId = pendingDocumentEvidenceId, documentName = pendingDocumentName): Promise<boolean> => {
    if (!evidenceId || !appointmentId) return false
    setDocumentBusy(true)
    setDocumentMessage('')
    setPendingDocumentEvidenceId(evidenceId)
    setPendingDocumentName(documentName)
    try {
      const nextIds = [...new Set([...attachedEvidenceIds, evidenceId])]
      const payload = {
        ...(record?.payload || {}),
        caregiverReport: note.trim(),
        clinicianFindings: professionalStatement.trim(),
        decisions: recordedDecisions.trim(),
        instructions: recordedInstructions.trim(),
        unanswered: unansweredQuestions.trim(),
        followUps: appointmentFollowUpsFromText(followUps, record?.payload, record?.id || appointmentId),
        attachedEvidenceIds: nextIds,
        captureStage: 'after',
      }
      const persisted = record
        ? await patchJSON('/appointment-workspaces/' + encodeURIComponent(record.id), {
            expected_version: record.version_number,
            status: record.status,
            payload,
            change_reason: 'Link saved care document to appointment',
            idempotency_key: newAppointmentSaveKey(),
          }) as WorkspaceRecord
        : await postJSON('/appointment-workspaces', {
            appointment_id: appointmentId,
            status: 'outcome_pending',
            payload,
            change_reason: 'Link saved care document to appointment',
            idempotency_key: newAppointmentSaveKey(),
          }) as WorkspaceRecord
      setRecord(persisted)
      setAttachedEvidenceIds(nextIds)
      setPendingDocumentEvidenceId('')
      setPendingDocumentName('')
      setDocumentMessage('The original document is now attached to this appointment.')
      setMessage('Document attached to the saved appointment record.')
      window.dispatchEvent(new Event('careRecordUpdated'))
      try { await refreshSavedWorkspace() } catch { /* the persisted link remains available on reload */ }
      return true
    } catch {
      setDocumentMessage('The original is saved in Documents, but its appointment link could not be saved. Retry linking; do not upload it again.')
      return false
    } finally {
      setDocumentBusy(false)
    }
  }

  const retryDocumentLink = async () => linkDocumentToAppointment()

  const updateAppointmentLifecycle = async (status: 'completed' | 'cancelled' | 'rescheduled') => {
    if (!appointmentId) return
    setProposalBusy(true)
    setError('')
    setMessage('')
    try {
      const body: Record<string, unknown> = { status }
      if (status === 'rescheduled') {
        body.scheduled_at = rescheduleDate ? new Date(rescheduleDate).toISOString() : null
      }
      await patchJSON('/appointments/' + encodeURIComponent(appointmentId) + '/lifecycle', body)
      setMessage(status === 'cancelled'
        ? 'The appointment is marked cancelled in the Care Record. No external booking action was taken.'
        : status === 'completed'
          ? 'You told us the visit took place. This does not mean the clinic has confirmed it.'
          : rescheduleDate
            ? 'The new date is saved in the Care Record. SolenOS has not booked or confirmed it with the provider.'
            : 'The appointment is marked rescheduled, but its new date is still unknown.')
      setReloadToken(value => value + 1)
    } catch {
      setError('The appointment status could not be saved. The existing appointment information has not been changed.')
    } finally {
      setProposalBusy(false)
    }
  }

  const saveNote = async () => {
    if (!appointmentId && !record?.appointment_id) {
      setError('We couldn’t find an existing appointment to add this note to. No new appointment was created.')
      return
    }
    if (!note.trim() && !professionalStatement.trim() && !recordedDecisions.trim() && !recordedInstructions.trim() && !unansweredQuestions.trim() && !followUps.trim()) {
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
        clinicianFindings: professionalStatement.trim(),
        decisions: recordedDecisions.trim(),
        instructions: recordedInstructions.trim(),
        unanswered: unansweredQuestions.trim(),
        followUps: appointmentFollowUpsFromText(followUps, record?.payload, record?.id || appointmentId),
        attachedEvidenceIds,
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
      // Saving after-visit notes is not itself an attendance confirmation.
      // Appointment lifecycle changes require a separate explicit caregiver action.
      try {
        await refreshSavedWorkspace()
        if (stage === 'after') {
          const prepared = await postJSON('/appointment-workspaces/' + encodeURIComponent(saved.id) + '/outcome-proposals', {}) as { items?: OutcomeProposal[]; count?: number }
          setOutcomeProposals(prepared.items || [])
          setMessage((prepared.count || 0) > 0
            ? 'Your note is saved. SolenOS prepared possible care updates for your review. Nothing has been added to your Care Record yet.'
            : 'Your note is saved. SolenOS found no separate care update to suggest from this note.')
        }
      } catch {
        setError(stage === 'after'
          ? 'Your note is saved. SolenOS could not finish preparing the review suggestions; you can retry.'
          : 'Your note was saved. Appointment details could not refresh; open appointment support again to retry.')
      }
    } catch (cause) {
      setError('Your note could not be saved. Check whether it appears before trying again.')
    } finally {
      setSaving(false)
    }
  }

  const selectedAppointmentEvidenceIds =
    brief?.appointments.find(item => item.source_id === appointmentId)?.evidence_ids ||
    brief?.next_appointment?.evidence_ids ||
    []
  const linkedAppointmentDocuments = (brief?.documents || []).filter(item =>
    Boolean(item.source_evidence_id && selectedAppointmentEvidenceIds.includes(item.source_evidence_id))
  )
  const otherCareDocuments = (brief?.documents || []).filter(item =>
    !item.source_evidence_id || !selectedAppointmentEvidenceIds.includes(item.source_evidence_id)
  )

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
              {brief.lcr_retrieval_status?.status === 'failed'
                ? <div role="alert"><p className="guided-muted">We couldn’t load all of your Care Record. Your care history may still contain information that isn’t showing here.</p><button type="button" className="guided-secondary" disabled={loading} onClick={() => setReloadToken(value => value + 1)}>Try again</button></div>
                : brief.lcr_retrieval_status?.status === 'partial'
                  ? <div role="status"><p className="guided-muted">We couldn’t check all of your saved care information. This summary may be missing details.</p><button type="button" className="guided-secondary" disabled={loading} onClick={() => setReloadToken(value => value + 1)}>Try again</button></div>
                  : null}
              {brief?.source_coverage?.documents === 'failed' && <div role="alert"><p className="guided-muted">We couldn’t load your saved documents. They may still be there.</p><button type="button" className="guided-secondary" disabled={loading} onClick={() => setReloadToken(value => value + 1)}>Try again</button></div>}
              {brief.appointment_context_status?.code === 'date_unknown' && <p className="guided-muted" role="status">Appointment information exists, but its date has not been recorded. SolenOS has not supplied or assumed a date.</p>}
              {brief.appointment_context_status?.code === 'cancelled' && <p className="guided-muted" role="status">The recorded appointment is marked cancelled. SolenOS does not treat it as a current booking.</p>}
              {brief.appointment_context_status?.code === 'rescheduled' && <p className="guided-muted" role="status">A rescheduled appointment is recorded. Use only the date currently saved in the Care Record.</p>}
              {brief.appointment_context_status?.code === 'occurred' && <p className="guided-muted" role="status">The available appointment records indicate that a visit has already occurred.</p>}
              {brief.appointment_context_status?.code === 'overdue' && <p className="guided-muted" role="status">The recorded appointment date has passed, but attendance is not recorded. SolenOS does not assume that the visit happened.</p>}
              {brief.appointment_context_status?.code === 'follow_up_needed' && <p className="guided-muted" role="status">The care record contains appointment-related questions or follow-ups. These indicate work to clarify, not an external booking.</p>}
              {brief.appointment_context_status?.code === 'visit_recorded' && <p className="guided-muted" role="status">A visit or clinic discussion is recorded in care history, but no separate appointment booking record was found.</p>}
              {brief.appointment_context_status?.code === 'no_appointment_information' && <p className="guided-muted" role="status">We couldn’t find appointment information in the notes and documents available here. This does not mean no appointment exists.</p>}
              <p className="guided-muted">Prepared from the care information SolenOS could access. You do not need to rewrite information already in your Care Record.</p>
              {(brief.living_care_record_context?.retrieval_scan_complete !== true ||
                brief.living_care_record_context?.retrieval_projection_complete !== true ||
                brief.living_care_record_context?.schema_status !== "complete" ||
                (brief.living_care_record_context?.missing_required_sources?.length ?? 0) > 0 ||
                Object.values(brief.source_completeness ?? {}).some(item => item.retrieval_complete === false || item.has_more === true)) &&
                <p className="guided-muted" role="status">Some parts of your Care Record could not be fully checked. This summary may be incomplete; that does not mean the information is missing from your Care Record.</p>}
              {brief.events.length === 0 && brief.facts.length === 0 && !(brief.assertions?.length) && !(brief.open_questions?.length) && !(brief.appointment_needs?.length) && !(brief.contradictions?.length) && !(brief.documents?.length) && !(brief.open_loops?.length) && !(brief.prior_decisions?.length) && !(brief.decision_outcomes?.length) && !brief.next_appointment && brief.appointments.length === 0
                ? <p className="guided-muted">There is not enough saved care information available to prepare a useful visit summary yet. This is only what we could find in your Care Record. Your family may know or have saved more.</p>
                : <div className="guided-columns">
                    {brief.events.length > 0 && <section><h6>{brief.change_window?.basis === 'since_previous_recorded_appointment' ? 'Changes since the previous recorded visit' : 'Recent changes'}</h6>{brief.change_window?.basis === 'bounded_recent_fallback' && <p className="guided-footnote">There is no earlier appointment date to compare these updates with. We are showing the most recent saved care information instead.</p>}<ul>{brief.events.slice(0, 3).map(item => <li key={item.source_id}><strong>{caregiverSafeAssistantText(item.title) || "Care update"}</strong>{item.description && <p>{caregiverSafeAssistantText(item.description)}</p>}<small>{item.occurred_at ? new Date(item.occurred_at).toLocaleDateString() : "Date not recorded"} · {caregiverStatusLabel(item.status) || "Not recorded"} · {item.recorded_by_role === 'caregiver' ? 'Shared by a caregiver' : 'Who shared this is not recorded'} · {item.evidence_ids?.length ? 'Related note or document available' : 'No related note or document found'}</small></li>)}</ul></section>}
                    {brief.facts.length > 0 && <section><h6>Saved care details</h6><ul>{brief.facts.slice(0, 3).map(item => <li key={item.source_id}><p>{caregiverSafeAssistantText(item.value) || "Saved care detail"}</p><small>{caregiverInformationLabel(item.epistemic_status) || "Not recorded"}</small></li>)}</ul></section>}
                    {brief.assertions?.length ? <section><h6>What caregivers have shared</h6><ul>{brief.assertions.slice(0, 3).map(item => <li key={item.source_id}><strong>{caregiverFieldLabel(item.field) || "Care detail"}</strong><p>{caregiverSafeAssistantText(item.asserted_value) || "Saved report"}</p><small>{caregiverSafeGeneratedText(item.source_label) || "Saved care record"} · {caregiverInformationLabel(item.epistemic_state || "reported") || "Caregiver report"}</small></li>)}</ul></section> : null}
                    {brief.open_questions?.length ? <section><h6>Questions still needing an answer</h6><ul>{brief.open_questions.slice(0, 3).map(item => <li key={item.source_id}><strong>{caregiverSafeAssistantText(item.question) || "Question to check"}</strong><small>{caregiverStatusLabel(item.priority) || "Priority not recorded"}</small></li>)}</ul></section> : null}
                    {brief.contradictions?.length ? <section><h6>Information that needs clarification</h6><ul>{brief.contradictions.slice(0, 2).map(item => <li key={item.source_id}><p>{caregiverSafeGeneratedText(item.description) || "Some reports do not match."}</p><small>{caregiverStatusLabel(item.resolution_status) || "Review needed"}</small></li>)}</ul></section> : null}
                    {brief.appointment_needs?.length ? <section><h6>Appointment details to check</h6><ul>{brief.appointment_needs.slice(0, 3).map(item => <li key={item.source_id}><strong>{caregiverSafeGeneratedText(item.question) || "An appointment detail needs checking"}</strong><small>{item.intended_answerer_label ? caregiverSafeGeneratedText(item.intended_answerer_label) || "Who may know was not recorded" : "Who may know was not recorded"} · {caregiverStatusLabel(item.priority) || "Priority not recorded"}</small><p>{caregiverSafeGeneratedText(item.necessity_rationale) || "This detail may matter for the visit."}</p><small>{caregiverSafeGeneratedText(item.interpretation_limit) || "This is not a booked or confirmed visit."}</small></li>)}</ul></section> : null}
                    {brief.appointment_recorded_events?.length ? <section><h6>Earlier visits and clinic discussions</h6><ul>{brief.appointment_recorded_events.slice(0, 3).map(item => <li key={item.source_id}><strong>{caregiverSafeAssistantText(item.title) || "Visit saved by a caregiver"}</strong>{item.description && <p>{caregiverSafeAssistantText(item.description)}</p>}<small>{item.occurred_at ? new Date(item.occurred_at).toLocaleString() : "Date not recorded"} · {item.recorded_by_role === 'caregiver' ? 'Shared by a caregiver' : 'Who shared this is not recorded'} · The clinic has not confirmed this visit</small></li>)}</ul></section> : null}
                    {brief.previous_appointment && <section><h6>Previous visit</h6><strong>{caregiverSafeAssistantText(brief.previous_appointment.title) || "Appointment"}</strong><p>{brief.previous_appointment.scheduled_at ? new Date(brief.previous_appointment.scheduled_at).toLocaleString() : "Date not recorded"} · {caregiverStatusLabel(brief.previous_appointment.status) || "Not recorded"}</p></section>}
                    {brief.next_appointment ? <section><h6>{['cancelled', 'canceled'].includes(brief.next_appointment.status.toLowerCase()) ? 'Appointment cancelled' : brief.next_appointment.status === 'overdue' ? 'Appointment date has passed · visit not confirmed' : brief.next_appointment.scheduled_at ? 'Next appointment recorded' : 'Appointment · date not recorded'}</h6><strong>{caregiverSafeAssistantText(brief.next_appointment.title) || "Appointment"}</strong><p>{brief.next_appointment.scheduled_at ? new Date(brief.next_appointment.scheduled_at).toLocaleString() : "Date not recorded"} · {caregiverStatusLabel(brief.next_appointment.status) || "Not recorded"}</p><small>This is saved information only. SolenOS has not booked or confirmed the appointment with the clinic.</small>{brief.next_appointment.provider && <small>{caregiverSafeAssistantText(brief.next_appointment.provider)}</small>}{brief.next_appointment.location && <small>{caregiverSafeAssistantText(brief.next_appointment.location)}</small>}
                      <details className="guided-optional-capture"><summary>Change appointment details (optional)</summary>
                        <p className="guided-footnote">Only change this if you know the clinic or family changed the visit. This updates your Care Record; it does not contact the clinic.</p>
                        {brief.next_appointment.status === 'overdue' && <button type="button" className="guided-secondary" disabled={proposalBusy} onClick={() => void updateAppointmentLifecycle('completed')}>Confirm the visit occurred</button>}
                        {!['cancelled', 'canceled'].includes(brief.next_appointment.status.toLowerCase()) && <button type="button" className="guided-secondary" disabled={proposalBusy} onClick={() => void updateAppointmentLifecycle('cancelled')}>Mark as cancelled</button>}
                        <label className="guided-capture-label">New date, if known
                          <input type="datetime-local" value={rescheduleDate} onChange={event => setRescheduleDate(event.target.value)} />
                        </label>
                        <button type="button" className="guided-secondary" disabled={proposalBusy} onClick={() => void updateAppointmentLifecycle('rescheduled')}>Save the new date</button>
                      </details></section> : brief.appointments.length > 0 ? <section><h6>Appointments in your Care Record</h6><ul>{brief.appointments.slice(0, 2).map(item => <li key={item.source_id}><strong>{caregiverSafeAssistantText(item.title) || "Appointment"}</strong><small>{item.scheduled_at ? new Date(item.scheduled_at).toLocaleString() : "Date not recorded"} · {caregiverStatusLabel(item.status) || "Not recorded"}</small></li>)}</ul></section> : null}
                    {brief.open_loops?.length ? <section><h6>Still being followed up</h6><ul>{brief.open_loops.slice(0, 3).map(item => <li key={item.source_id}><strong>{caregiverSafeAssistantText(item.title) || "Follow-up"}</strong>{item.description && item.description !== item.title && <p>{caregiverSafeAssistantText(item.description)}</p>}<small>{caregiverStatusLabel(item.status) || "Not recorded"}{item.deadline_at ? ` · Due ${new Date(item.deadline_at).toLocaleDateString()}` : ""}{item.owner_label ? ` · ${caregiverSafeAssistantText(item.owner_label)}` : ""}{item.appointment_id ? ` · Linked to ${caregiverSafeAssistantText(brief.appointments.find(appointment => appointment.source_id === item.appointment_id)?.title) || 'a recorded appointment'}` : ""}</small></li>)}</ul></section> : null}
                    {linkedAppointmentDocuments.length ? <section><h6>Documents for this appointment</h6><ul>{linkedAppointmentDocuments.slice(0, 5).map(item => <li key={item.source_id}><strong>{caregiverSafeAssistantText(item.filename) || "Care document"}</strong>{item.extracted_text && <p>{caregiverSafeAssistantText(item.extracted_text.slice(0, 280))}</p>}<small>{caregiverStatusLabel(item.extraction_status || "available") || "Text read from the document"} · {item.recorded_at ? new Date(item.recorded_at).toLocaleDateString() : "Date not recorded"} · {caregiverSafeAssistantText(item.interpretation_limit) || "This is from a document and has not been confirmed as a care detail"}</small></li>)}</ul></section> : null}
                    {otherCareDocuments.length ? <section><h6>Other recent care documents</h6><ul>{otherCareDocuments.slice(0, 3).map(item => <li key={item.source_id}><strong>{caregiverSafeAssistantText(item.filename) || "Care document"}</strong>{item.extracted_text && <p>{caregiverSafeAssistantText(item.extracted_text.slice(0, 280))}</p>}<small>{caregiverStatusLabel(item.extraction_status || "available") || "Text read from the document"} · {item.recorded_at ? new Date(item.recorded_at).toLocaleDateString() : "Date not recorded"} · {caregiverSafeAssistantText(item.interpretation_limit) || "This is from a document and has not been confirmed as a care detail"}</small>
                      {item.source_evidence_id && appointmentId && <button type="button" className="guided-secondary" disabled={documentBusy || attachedEvidenceIds.includes(item.source_evidence_id)} onClick={() => void linkDocumentToAppointment(item.source_evidence_id!, item.filename || 'Care document')}>{documentBusy ? 'Adding…' : 'Add to this appointment'}</button>}
                    </li>)}</ul></section> : null}
                    {brief.prior_decisions?.length ? <section><h6>Previous care decisions</h6><ul>{brief.prior_decisions.slice(0, 2).map(item => <li key={item.id}><strong>{caregiverSafeAssistantText(item.title) || "Decision recorded"}</strong>{item.decision_text && <p>{caregiverSafeAssistantText(item.decision_text)}</p>}<small>{caregiverStatusLabel(item.decision_status || "recorded") || "Recorded"}{item.decided_at ? ` · ${new Date(item.decided_at).toLocaleDateString()}` : ""}</small></li>)}</ul></section> : null}
                    {brief.decision_outcomes?.length ? <section><h6>What happened after those decisions</h6><ul>{brief.decision_outcomes.slice(0, 2).map(item => <li key={item.id}><p>{caregiverSafeAssistantText(item.description) || "An outcome was recorded."}</p><small>{caregiverStatusLabel(item.outcome_status || "recorded") || "Outcome recorded"}{item.observed_at ? ` · ${new Date(item.observed_at).toLocaleDateString()}` : ""}</small></li>)}</ul></section> : null}
                  </div>}
              <details className="appointment-source-review">
                <summary>More about the information in this summary</summary>
                <p className="guided-footnote">This section shows what information was available and what could not be checked. You do not need to manage these details to prepare for a visit.</p>
<div className="guided-columns">
              {(Object.entries(brief.source_completeness ?? {}).some(([, coverage]) => coverage.has_more === true || coverage.retrieval_complete === false) ||
                brief.living_care_record_context == null ||
                brief.living_care_record_context.retrieval_scan_complete !== true ||
                brief.living_care_record_context.retrieval_projection_complete !== true ||
                brief.living_care_record_context.schema_status !== "complete" ||
                (brief.living_care_record_context.missing_required_sources?.length ?? 0) > 0 ||
                (brief.living_care_record_context.missing_optional_sources?.length ?? 0) > 0) && <section className="guided-muted guided-full-span" role="status">
                <h5>Some care information is missing from this summary</h5>
                <p>This appointment summary shows only some saved care information. Open your full Care Record if you need more information before the visit.</p>
                {brief.living_care_record_context == null && <p>We couldn’t check whether this summary includes everything you’ve saved. Open your Care Record to see more.</p>}
                {brief.living_care_record_context?.schema_status === "failed" && <p>We could not check the full Care Record just now. Refresh or open the Care Record before relying on this visit summary.</p>}
                {brief.living_care_record_context?.missing_required_sources?.length ? <p>Information we couldn’t load: {brief.living_care_record_context.missing_required_sources.map(source => caregiverInformationAreaLabel(source) || "Other care information").join(", ")}.</p> : null}
                {brief.living_care_record_context?.missing_optional_sources?.length ? <p>Some other saved care information is not available in this view.</p> : null}
                <ul>{Object.entries(brief.source_completeness ?? {}).filter(([, coverage]) => coverage.has_more === true || coverage.retrieval_complete === false).map(([source, coverage]) => <li key={source}>{caregiverInformationAreaLabel(source) || "Other care information"}: {coverage.returned_count} {coverage.returned_count === 1 ? "detail" : "details"} shown{coverage.has_more ? "; more saved details are available" : ""}</li>)}</ul>
                {Object.entries(brief.living_care_record_context?.sources ?? {}).filter(([, source]) => source.has_more === true || source.candidate_scan_complete === false).length > 0 && <ul>{Object.entries(brief.living_care_record_context?.sources ?? {}).filter(([, source]) => source.has_more === true || source.candidate_scan_complete === false).map(([source, coverage]) => <li key={source}>{caregiverInformationAreaLabel(source) || "Other care information"}: {coverage.returned_count ?? 0} {coverage.returned_count === 1 ? "detail" : "details"} shown{coverage.has_more ? "; more saved information remains" : ""}</li>)}</ul>}
              </section>}
              {brief.source_completeness?.open_questions?.display_limited && <p className="guided-muted guided-full-span">There may be more questions in your Care Record. This view shows the most important ones first.</p>}
              <section><h5>Recent care history</h5>{brief.events.length ? <ul>{brief.events.slice(0, 6).map(item => <li key={item.source_id}><strong>{caregiverSafeAssistantText(item.title) || 'Care update'}</strong>{item.description && <p>{caregiverSafeAssistantText(item.description) || 'No further details are available.'}</p>}<small>{item.occurred_at ? new Date(item.occurred_at).toLocaleDateString() : 'Date not recorded'} · {caregiverStatusLabel(item.status) || "Not recorded"}</small></li>)}</ul> : <p className="guided-muted">No recent care updates are available for this summary.</p>}</section>
              <section><h5>Saved care details</h5>{brief.facts.length ? <ul>{brief.facts.slice(0, 6).map(item => <li key={item.source_id}><strong>Care information</strong><p>{caregiverSafeAssistantText(item.value) || 'No detail recorded'}</p><small>{caregiverInformationLabel(item.epistemic_status) || 'Not recorded'}</small></li>)}</ul> : <p className="guided-muted">No saved care details are available for this summary.</p>}{brief.source_coverage.medications_and_allergies === "unavailable" && <p className="guided-muted">A separate medication and allergy list is not available. Only details recorded in the care information above are shown.</p>}</section>
            </div>
            <section className="guided-assertions"><h5>What was noticed or shared</h5>{brief.assertions?.length ? <ul>{brief.assertions.slice(0, 10).map(item => <li key={item.source_id}><strong>Care detail</strong><p>{caregiverSafeAssistantText(item.asserted_value) || 'Saved care detail'}</p><small>{caregiverSafeAssistantText(item.source_label) || 'Saved care record'} · What we know: {caregiverInformationLabel(item.epistemic_state || "reported") || "Caregiver report"} · Review: {caregiverStatusLabel(item.assertion_status) || "Not recorded"} · {item.observed_at ? new Date(item.observed_at).toLocaleString() : caregiverSafeAssistantText(item.event_time_text) || "Event time not recorded"}</small>{item.source_text && item.source_text !== item.asserted_value && <p>{caregiverSafeAssistantText(item.source_text.slice(0, 280)) || 'The original wording is available in the saved note or document.'}</p>}<small>{caregiverSafeAssistantText(item.interpretation_limit) || 'The available information may not tell the whole story.'}{item.evidence_ids.length ? ` · ${item.evidence_ids.length} related ${item.evidence_ids.length === 1 ? "note or document" : "notes or documents"}` : " · No related note or document attached"}</small></li>)}</ul> : <p className="guided-muted">{brief.assertions ? "The notes or reports behind these care details could not be found in this summary." : "We couldn’t load these care details or the notes and reports they came from."}</p>}</section>
            <section className="guided-questions"><h5>Questions to ask the healthcare professional</h5>{brief.source_coverage.open_questions === "failed" ? <p className="guided-muted">Questions that still need answers could not be loaded.</p> : brief.open_questions?.filter(item => item.subject_type !== "appointment").length ? <ul>{brief.open_questions.filter(item => item.subject_type !== "appointment").slice(0, 8).map(item => <li key={item.source_id}><strong>{caregiverSafeAssistantText(item.question) || 'A question needs an answer'}</strong><small>{caregiverSafeAssistantText(item.intended_answerer_label) || caregiverRoleLabel(item.intended_answerer_role) || "Who may know was not recorded"} · {caregiverStatusLabel(item.priority) || "Priority not recorded"} · {caregiverStatusLabel(item.status) || "Not recorded"}</small>{item.necessity_rationale && <p>{caregiverSafeAssistantText(item.necessity_rationale) || 'More information may be needed.'}</p>}</li>)}</ul> : <p className="guided-muted">{brief.open_questions ? "No unanswered questions are shown here. This does not mean none exist." : "Questions that still need answers are not available in this summary."}</p>}</section>
            <section className="guided-conflicts"><h5>Concerns and reports that do not match</h5>{brief.source_coverage.contradictions === "failed" ? <p className="guided-muted">Reports that do not match could not be loaded.</p> : brief.contradictions?.length ? <ul>{brief.contradictions.slice(0, 8).map(item => <li key={item.source_id}><strong>Care detail · {caregiverStatusLabel(item.resolution_status) || "Review needed"}</strong><p>{caregiverSafeAssistantText(item.description) || 'No further details are available.'}</p>{item.unresolved_remainder && <p>{caregiverSafeAssistantText(item.unresolved_remainder) || 'What remains unclear was not recorded.'}</p>}<small>Related details: {item.source_assertion_ids.length} · Notes and documents: {item.evidence_ids.length}</small></li>)}</ul> : <p className="guided-muted">{brief.contradictions ? "No reports that do not match were found in this summary." : "Information about reports that differ is not available in this summary."}</p>}</section>
            <section className="guided-appointments"><h5>Appointments</h5>{brief.appointments.length ? <ul>{brief.appointments.slice(0, 5).map(item => <li key={item.source_id}><strong>{caregiverSafeAssistantText(item.title) || "Appointment"}</strong><span>{item.scheduled_at ? new Date(item.scheduled_at).toLocaleString() : 'Date not recorded'} · {caregiverStatusLabel(item.status) || "Not recorded"}</span></li>)}</ul> : <p className="guided-muted">No appointment details are listed here yet. This does not mean no appointment exists.</p>}<p className="guided-footnote">SolenOS shows visits already saved in your Care Record. It does not book appointments or confirm them with a provider.</p></section>
            <section className="guided-lineage" aria-label="Related notes and documents">
              <h5>How these notes and documents are connected</h5>
              {brief.evidence_lineage.groups.length ? <ul>{brief.evidence_lineage.groups.map(group => <li key={group.lineage_id}><strong>{group.source_independence_status === "shared_origin" ? "Same original" : group.source_independence_status === "independent" ? "Reported separately" : group.source_independence_status === "not_assessed" ? "Not checked" : "Not known"}</strong><p>{group.evidence_ids.length} {group.evidence_ids.length === 1 ? "note or document" : "notes or documents"}</p></li>)}</ul> : <p className="guided-muted">We couldn’t confirm whether these reports came from different sources. They may describe the same event.</p>}
              <p className="guided-footnote">Related notes do not prove that a report is true or that it came from a different person.</p>
              {brief.evidence_lineage.scope_truncated && <p className="guided-muted">We couldn’t check all the links between these notes and documents. We can’t tell whether the reports came from different people.</p>}
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
              <p className="guided-footnote">{caregiverSafeGeneratedText(brief.freshness_assessment_scope.interpretation_limit) || "The available dates may not tell the whole story."}</p>
            </section>
            <section className="guided-freshness" aria-label="Earlier reviews">
              <h5>What has been reviewed so far</h5>
              {!brief.source_coverage?.evidence_review_records || brief.source_coverage.evidence_review_records === "unavailable" || brief.source_coverage.evidence_review_records === "failed"
                ? <p className="guided-muted">Earlier reviews could not be loaded. This does not mean the notes were reviewed.</p>
                : brief.evidence_review_records?.length
                  ? <ul>{brief.evidence_review_records.slice(0, 8).map(item => <li key={item.review_id}>
                    <strong>Note or document review · {caregiverStatusLabel(item.outcome) || "Not recorded"}</strong>
                    <p>{caregiverSafeAssistantText(item.rationale) || "No review explanation was recorded."}</p>
                    <small>{caregiverSafeAssistantText(item.interpretation_limit) || "Reviewing a note or document does not by itself confirm that a care detail is true."}</small>
                  </li>)}</ul>
                  : <p className="guided-muted">No one has reviewed these notes yet. They remain reports, not confirmed facts.</p>}
              {!brief.source_coverage?.evidence_claim_assessments || brief.source_coverage.evidence_claim_assessments === "unavailable" || brief.source_coverage.evidence_claim_assessments === "failed"
                ? <p className="guided-muted">Earlier reviews of these care details could not be loaded.</p>
                : brief.claim_assessments?.length
                  ? <ul>{brief.claim_assessments.slice(0, 8).map(item => <li key={item.assessment_id}>
                    <strong>Care detail · {caregiverStatusLabel(item.status) || "Needs checking"}</strong>
                    <p>{caregiverSafeAssistantText(item.rationale) || "No review explanation was recorded."}</p>
                    <small>{caregiverSafeAssistantText(item.interpretation_limit) || "Reviewing a note does not prove that the care detail is true."}</small>
                  </li>)}</ul>
                  : <p className="guided-muted">These saved reports have not been reviewed yet.</p>}
              {!brief.source_coverage?.evidence_completeness_assessments || brief.source_coverage.evidence_completeness_assessments === "unavailable" || brief.source_coverage.evidence_completeness_assessments === "failed"
                ? <p className="guided-muted">SolenOS could not check whether any details are missing.</p>
                : brief.completeness_assessments?.length
                  ? <ul>{brief.completeness_assessments.slice(0, 8).map(item => <li key={item.assessment_id}>
                    <strong>Details in the original information · {caregiverStatusLabel(item.assessment_status) || "Not recorded"}</strong>
                    {item.missing_fields?.length ? <p>Not recorded: {item.missing_fields.map(field => caregiverFieldLabel(field)).filter(Boolean).join(", ") || "Some details"}</p> : null}
                    <p>{caregiverSafeGeneratedText(item.rationale) || "No further explanation is available."}</p>
                    <small>{caregiverSafeAssistantText(item.interpretation_limit) || "A list of details does not prove that the information is complete enough to guide care."}</small>
                  </li>)}</ul>
                  : <p className="guided-muted">We haven’t checked whether details are missing from the linked notes yet.</p>}
            </section>
              </details>

            <p className="guided-footnote">Prepared {new Date(brief.snapshot_at).toLocaleString()}. Reports, dates and unknown details are kept separate.</p>
            </section>
          </>}

        </div>}

        {stage === 'during' && <div className="guided-panel">
          <div className="guided-panel-heading"><div><h4>Stay with the appointment</h4><p>You do not need to document while speaking with the professional.</p></div><span className="guided-state">Optional</span></div>
          <p className="guided-muted">If it helps, leave yourself one short note. You can leave this empty and return later.</p>
          <label className="guided-capture-label">Anything you want to remember?
            <textarea value={note} onChange={event => setNote(event.target.value)} rows={4} placeholder="Optional note. Your own words are enough." />
          </label>
          <button className="guided-primary" type="button" onClick={() => void saveNote()} disabled={saving}>{saving ? 'Saving…' : 'Save note and continue'}</button>
          <p className="guided-footnote">A saved note is attributed to the caregiver. It is not a verified professional statement and does not change the Care Record.</p>
        </div>}

        {stage === 'after' && <div className="guided-panel">
          <div className="guided-panel-heading"><div><h4>Information recorded after the appointment</h4><p>SolenOS organises what has actually been recorded. You can return later if nothing is available yet.</p></div><span className="guided-state">Review first</span></div>
          {appointmentId && !['completed', 'resolved', 'historical', 'cancelled', 'canceled'].includes((brief?.appointments.find(item => item.source_id === appointmentId)?.status || '').toLowerCase()) && <section className="guided-optional-capture" aria-label="Confirm appointment attendance">
            <p className="guided-footnote">Saving notes does not change the appointment status. If you know the visit took place, confirm that separately.</p>
            <button type="button" className="guided-secondary" disabled={proposalBusy} onClick={() => void updateAppointmentLifecycle('completed')}>Confirm the visit occurred</button>
          </section>}
          <label className="guided-capture-label">Add anything you remember, if you want to
            <textarea value={note} onChange={event => setNote(event.target.value)} rows={4} placeholder="A short note is enough. You can also leave this empty." />
          </label>
          <details className="guided-optional-capture">
            <summary>Add specific details or a document (optional)</summary>
            <p className="guided-footnote">Only add what you know. These notes stay as your reports until you review any suggested changes to your Care Record.</p>
            <label className="guided-capture-label">What the professional said, as you remember it
              <textarea value={professionalStatement} onChange={event => setProfessionalStatement(event.target.value)} rows={3} placeholder="Optional. Keep the wording as close as you can." />
            </label>
            <label className="guided-capture-label">Decisions recorded
              <textarea value={recordedDecisions} onChange={event => setRecordedDecisions(event.target.value)} rows={3} placeholder="Optional. What was agreed, deferred or declined?" />
            </label>
            <label className="guided-capture-label">Instructions or next steps
              <textarea value={recordedInstructions} onChange={event => setRecordedInstructions(event.target.value)} rows={3} placeholder="Optional. Record the instruction as communicated; do not infer missing details." />
            </label>
            <label className="guided-capture-label">Questions still unanswered
              <textarea value={unansweredQuestions} onChange={event => setUnansweredQuestions(event.target.value)} rows={3} placeholder="Optional. What still needs clarification?" />
            </label>
            <label className="guided-capture-label">Follow-ups that should remain open (one per line)
              <textarea value={followUps} onChange={event => setFollowUps(event.target.value)} rows={3} placeholder="Optional. For example: Ask the clinic when the test result will be available." />
              <small>Leave this empty if no follow-up is needed. Removing a previously saved follow-up cancels its tracking; it does not mark it completed. Unassigned work stays unassigned.</small>
            </label>
            <label className="guided-capture-label">Upload a document to this appointment
              <input type="file" accept=".pdf,.txt,.md,.csv,.json,.xml,.yaml,.yml,.log,image/*" disabled={documentBusy || !appointmentId || brief?.source_coverage?.documents === 'restricted'} onChange={async event => {
                const file = event.currentTarget.files?.[0]
                event.currentTarget.value = ''
                if (!file) return
                setDocumentBusy(true)
                setDocumentMessage('')
                let uploadedEvidenceId = ''
                try {
                  const saved = await extractAttachedDocument(file, 'upload')
                  if (saved.status !== 'saved' || !saved.evidenceId) throw new Error(saved.errorNote || 'We couldn’t confirm that the original document was saved.')
                  uploadedEvidenceId = saved.evidenceId
                  setPendingDocumentEvidenceId(saved.evidenceId)
                  setPendingDocumentName(file.name)
                  setMessage('Document uploaded. Linking it to the appointment…')
                  await linkDocumentToAppointment(saved.evidenceId, file.name)
                } catch (cause) {
                  setDocumentMessage(uploadedEvidenceId
                    ? 'The original document is saved in Documents, but its appointment link could not be saved. Retry linking it below; do not upload it again.'
                    : cause instanceof Error ? cause.message : 'The document could not be saved. Try again when the connection is available.')
                } finally {
                  setDocumentBusy(false)
                }
              }} />
            </label>
            {brief?.source_coverage?.documents === 'restricted' && <p className="guided-muted" role="status">Document access is restricted for this caregiver. We can’t show the document or its details here.</p>}
            {documentBusy && <p className="guided-muted" role="status">Saving the original document…</p>}
            {documentMessage && <p className="guided-muted" role="status">{documentMessage}</p>}
            {pendingDocumentEvidenceId && <div className="guided-actions"><span className="guided-muted">Saved file: {caregiverSafeAssistantText(pendingDocumentName) || 'Document'}</span><button type="button" className="guided-secondary" disabled={documentBusy} onClick={() => void retryDocumentLink()}>Try adding the saved document again</button></div>}
            {attachedEvidenceIds.length > 0 && <p className="guided-footnote">{attachedEvidenceIds.length} document {attachedEvidenceIds.length === 1 ? 'is' : 'items are'} linked to this appointment.</p>}
          </details>
          <div className="guided-actions">
            <button className="guided-primary" type="button" onClick={() => void saveNote()} disabled={saving}>{saving ? 'Saving…' : 'Save what I remember'}</button>
            <button className="guided-secondary" type="button" onClick={() => record && void refreshOutcome(record.id)} disabled={!record}>Refresh appointment information</button>
          </div>
          {outcome?.status === 'ready_for_review' && <div className="guided-outcome" aria-live="polite">
            <h5>Information to check</h5>
            {Object.entries(outcome.sections).filter(([, items]) => items.length).map(([key, items]) => <section key={key}><h6>Appointment details</h6>{items.map((item, index) => <p key={key + index}>{caregiverSafeAssistantText(item.text) || "Saved appointment information"}<small>{caregiverInformationLabel(item.epistemic_status) || 'Recorded information'} · {item.source_type === 'document' ? 'Document' : item.source_type === 'professional' ? 'Care professional' : 'Caregiver report'}</small></p>)}</section>)}
            {outcome.missing_information.length > 0 && <p className="guided-muted">Not recorded: {outcome.missing_information.join(', ')}.</p>}
            <p className="guided-footnote">This is a draft for you to review. It has not been confirmed by a healthcare professional, and your saved care record has not been changed.</p>
            {outcomeProposals.length === 0 && <div className="guided-actions">
              <button className="guided-primary" type="button" onClick={() => void prepareOutcomeReview()} disabled={!record || proposalBusy}>
                {proposalBusy ? 'Preparing…' : 'Try again'}
              </button>
            </div>}
            {outcomeProposals.length > 0 && <div className="guided-proposals">
              <h5>Check these care details</h5>
              <p className="guided-muted">Each item is connected to the appointment information it came from. Accepting adds it as a caregiver report; it does not mean a healthcare professional has confirmed it.</p>
              {outcomeProposals.filter(item => item.proposed_change.source_record_version === record?.version_number).map(item => <article key={item.id} className="guided-proposal">
                <strong>{caregiverSafeAssistantText(item.proposed_change.label) || "Care detail"}</strong>
                <p>{caregiverSafeAssistantText(item.proposed_change.asserted_value) || "The saved wording is available for review."}</p>
                {item.proposed_change.asserted_value !== item.proposed_change.source_quote && <p><small>Original saved wording: {caregiverSafeAssistantText(item.proposed_change.source_quote) || "The original wording is saved in your Care Record."}</small></p>}
                <small>{caregiverStatusLabel(item.status) || 'Not recorded'} · Shared by a caregiver · not confirmed by a healthcare professional</small>
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
                    <button className="guided-secondary" type="button" disabled={proposalBusy} onClick={() => void reviewOutcomeProposal(item, 'reject')}>Reject suggestion</button>
                  </div>
                </>}
              </article>)}
            </div>}
          </div>}
          {(!outcome || outcome.status === 'no_outcome_information') && <p className="guided-muted">Nothing has been recorded about what happened at the appointment yet. You can return later; SolenOS will not invent what happened.</p>}
          {outcome?.limitations?.map((item, index) => <p className="guided-footnote" key={index}>{item}</p>)}

        </div>}

        <div className="guided-status" role="status" aria-live="polite">{message}{error && <span>{error} <button type="button" className="guided-secondary" onClick={() => setReloadToken(value => value + 1)} disabled={loading}>Try again</button></span>}</div>
        <p className="guided-footnote">You can leave notes empty. SolenOS keeps the appointment information it can find with the rest of your Care Record.</p>
      </>}

    </section>
  )
}
