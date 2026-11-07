'use client'

import { useEffect, useState } from 'react'
import { ensureAnonymousSession, getJSON, postJSON, patchJSON } from '@/api/client'
import { CalendarDays, ClipboardList, FileCheck2, ListChecks, ShieldCheck } from 'lucide-react'

type Stage = 'prepare' | 'during' | 'after'
type AttendanceStatus = 'not_recorded' | 'attended' | 'cancelled' | 'rescheduled' | 'missed'
type FollowUpStatus = 'Not started' | 'In progress' | 'Waiting for result' | 'Received' | 'Needs review' | 'Completed' | 'Cancelled'
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
type SavedWorkspace = { id: string; appointment_id?: string | null; status: string; version_number: number; payload: Record<string, unknown>; updated_at?: string }
type AppointmentConflict = { id: string; field: string; description: string; resolution_status: string; subject_type: string; subject_id: string }
type AppointmentAssertion = { id: string; field: string; subject_id: string; asserted_value: string; source_label?: string | null; assertion_status: string }
type HandoffAssignmentOption = { handoff_id: string; caregiver_id: string; name: string; expires_at?: string | null }
type FollowUpOutcomeEvent = { id: string; action_id: string; outcome_status: string; related_outcome_id?: string | null; review_decision?: string | null; notes?: string | null; created_by_caregiver_id?: string | null; created_at?: string | null; received_at?: string | null; received_by_caregiver_id?: string | null; reviewed_at?: string | null; reviewed_by_caregiver_id?: string | null }
type RegisteredActionSnapshot = { id: string; status: string; version: number; responsible_caregiver_id?: string | null; suggestion_id: string }
type FollowUp = { action: string; owner: string; due: string; status: FollowUpStatus; resultStatus: 'Not expected' | 'Waiting' | 'Received' | 'Reviewed'; notes: string; register: boolean; assignedCaregiverId?: string; assignmentHandoffId?: string; registeredActionId?: string; resultText?: string; reviewNotes?: string; reviewDecision?: 'acknowledged' | 'follow_up_required' | 'disputed' | 'needs_clinician_review' | 'not_relevant'; resultReceivedEventId?: string; resultReviewedEventId?: string; resultReceivedAt?: string; resultReceivedByCaregiverId?: string; resultReviewedAt?: string; resultReviewedByCaregiverId?: string }

const emptyFollowUp = (): FollowUp => ({ action: '', owner: '', due: '', status: 'Not started', resultStatus: 'Not expected', notes: '', register: false })

const appointmentFieldLabel = (field: string) => ({
  caregiverReport: 'What the caregiver reported',
  clinicianFindings: 'What the professional said',
  decisions: 'Decisions made',
  instructions: 'Instructions given',
  unanswered: 'Questions still unanswered',
  medicationReconciliation: 'Medication information and questions',
  testsReferrals: 'Tests and referrals',
  pendingResults: 'Results still expected',
  familySummary: 'What the family needs to know',
} as Record<string, string>)[field] || field.replace(/([A-Z])/g, ' $1').replaceAll('_', ' ').trim()


async function textFingerprint(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('')
}

function DetailedAppointmentWorkspace() {
  const [open, setOpen] = useState(false)
  const [recordId, setRecordId] = useState<string | null>(null)
  const [recordVersion, setRecordVersion] = useState(0)
  const [savedWorkspaces, setSavedWorkspaces] = useState<SavedWorkspace[]>([])
  const [acceptedHandoffRecipients, setAcceptedHandoffRecipients] = useState<HandoffAssignmentOption[]>([])
  const [followUpOutcomeEvents, setFollowUpOutcomeEvents] = useState<FollowUpOutcomeEvent[]>([])
  const [registeredActionSnapshots, setRegisteredActionSnapshots] = useState<RegisteredActionSnapshot[]>([])
  const [currentCaregiverId, setCurrentCaregiverId] = useState('')
  const [appointmentConflicts, setAppointmentConflicts] = useState<AppointmentConflict[]>([])
  const [appointmentAssertions, setAppointmentAssertions] = useState<AppointmentAssertion[]>([])
  const [selectedAppointmentId, setSelectedAppointmentId] = useState('')
  const [draftKey, setDraftKey] = useState('')
  const [attendanceStatus, setAttendanceStatus] = useState<AttendanceStatus>('not_recorded')
  const [actualVisitDate, setActualVisitDate] = useState('')
  const [rescheduledDate, setRescheduledDate] = useState('')
  const [testsReferrals, setTestsReferrals] = useState('')
  const [approvedEvidenceFields, setApprovedEvidenceFields] = useState<string[]>([])
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
  const updateFollowUp = (index: number, key: keyof FollowUp, value: string | boolean) => {
    setFollowUps(current => current.map((item, i) => i === index ? { ...item, [key]: value } as FollowUp : item))
    const invalidatesResultApproval =
      key === 'resultText' ||
      (key === 'resultStatus' && !['Received', 'Reviewed'].includes(String(value))) ||
      (key === 'reviewDecision' && value === 'not_relevant') ||
      (key === 'register' && value === false)
    if (invalidatesResultApproval) {
      setApprovedEvidenceFields(current => current.filter(field => field !== 'followUpResult:' + index))
    }
  }
  const addFollowUp = () => setFollowUps(current => [...current, emptyFollowUp()])
  const updateFollowUpAssignment = (index: number, value: string) => {
    const [handoffId, caregiverId] = value ? value.split('::') : ['', '']
    setFollowUps(current => current.map((item, i) => i === index
      ? { ...item, assignedCaregiverId: caregiverId || undefined, assignmentHandoffId: handoffId || undefined }
      : item))
  }


  const applySavedWorkspace = (record: SavedWorkspace, outcomeEvents: FollowUpOutcomeEvent[] = followUpOutcomeEvents, actionSnapshots: RegisteredActionSnapshot[] = registeredActionSnapshots) => {
        const p = record.payload || {}
        setRecordId(record.id)
        setSelectedAppointmentId(record.appointment_id || String(p.appointmentId || ''))
        setDraftKey(String(p.draftKey || record.id))
        setAttendanceStatus((['not_recorded', 'attended', 'cancelled', 'rescheduled', 'missed'].includes(String(p.attendanceStatus)) ? String(p.attendanceStatus) : 'not_recorded') as AttendanceStatus)
        setActualVisitDate(String(p.actualVisitDate || ''))
        setRescheduledDate(String(p.rescheduledDate || ''))
        setTestsReferrals(String(p.testsReferrals || ''))
        setApprovedEvidenceFields(Array.isArray(p.approvedEvidenceFields) ? p.approvedEvidenceFields.map(String) : [])
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
        setFollowUps(Array.isArray(p.followUps) && p.followUps.length ? p.followUps.map((item: unknown) => {
          const saved = item as Partial<FollowUp>
          const oldStatus = String(saved.status || '')
          const status = (['Not started', 'In progress', 'Waiting for result', 'Received', 'Needs review', 'Completed', 'Cancelled'].includes(oldStatus) ? oldStatus : oldStatus === 'Done' ? 'Completed' : oldStatus === 'Open' ? 'Not started' : 'Needs review') as FollowUpStatus
          const linkedEvents = outcomeEvents.filter(event => event.action_id === saved.registeredActionId)
          const action = actionSnapshots.find(candidate => candidate.id === saved.registeredActionId)
          const received = linkedEvents.filter(event => event.outcome_status === 'result_received').sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))[0]
          const reviewed = linkedEvents.filter(event => event.outcome_status === 'result_reviewed').sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))[0]
          const currentStatus = action ? ({
            approved: 'Not started', in_progress: 'In progress', completed: 'Completed',
            cancelled: 'Cancelled', deferred: 'Waiting for result', needs_clarification: 'Needs review',
          } as Record<string, FollowUpStatus>)[action.status] || status : status
          return {
            ...emptyFollowUp(), ...saved, status: currentStatus,
            assignedCaregiverId: action?.responsible_caregiver_id || saved.assignedCaregiverId,
            resultStatus: reviewed ? 'Reviewed' : received ? 'Received' : saved.resultStatus || 'Not expected',
            resultReceivedEventId: received?.id || saved.resultReceivedEventId,
            resultReviewedEventId: reviewed?.id || saved.resultReviewedEventId,
            resultReceivedAt: received?.received_at || saved.resultReceivedAt,
            resultReceivedByCaregiverId: received?.received_by_caregiver_id || saved.resultReceivedByCaregiverId,
            resultReviewedAt: reviewed?.reviewed_at || saved.resultReviewedAt,
            resultReviewedByCaregiverId: reviewed?.reviewed_by_caregiver_id || saved.resultReviewedByCaregiverId,
            reviewDecision: (reviewed?.review_decision as FollowUp['reviewDecision']) || saved.reviewDecision,
          }
        }) : [emptyFollowUp()])
        const validStatuses = ['Awaiting documentation', 'Follow-up pending', 'Ready for review', 'Closed with documented outstanding items'] as const
        setReviewStatus(validStatuses.includes(p.reviewStatus as typeof validStatuses[number]) ? p.reviewStatus as typeof validStatuses[number] : 'Awaiting documentation')
        setSaveMessage('Your saved appointment notes are open.')
    void ensureAnonymousSession().then(async session => {
      const [conflicts, assertions] = await Promise.all([
        getJSON('/care-continuity/contradictions/' + encodeURIComponent(session.person.id) + '?limit=100') as Promise<AppointmentConflict[]>,
        getJSON('/care-continuity/assertions/' + encodeURIComponent(session.person.id) + '?limit=100') as Promise<AppointmentAssertion[]>,
      ])
      setAppointmentConflicts(conflicts.filter(item => item.subject_type === 'appointment' && item.subject_id === record.id && item.resolution_status === 'unresolved'))
      setAppointmentAssertions(assertions.filter(item => item.subject_id === record.id))
    }).catch(() => { setAppointmentConflicts([]); setAppointmentAssertions([]) })
  }

  const startAnotherAppointment = () => {
    setRecordId(null); setRecordVersion(0); setSelectedAppointmentId(''); setDraftKey(crypto.randomUUID())
    setAttendanceStatus('not_recorded'); setActualVisitDate(''); setRescheduledDate(''); setTestsReferrals(''); setApprovedEvidenceFields([]); setAppointmentConflicts([]); setAppointmentAssertions([])
    setVisitPurpose(''); setClinician(''); setSpecialty(''); setVisitDate(''); setLocation(''); setAttendees('')
    setTopConcerns(['', '', '']); setChanges(''); setSymptoms(''); setMedicationQuestions(''); setHistoryQuestions(''); setPracticalNotes('')
    setConcernsDiscussed(''); setCaregiverReport(''); setClinicianFindings(''); setDecisions(''); setInstructions(''); setUnanswered('')
    setMedicationReconciliation(''); setPendingResults(''); setFamilySummary(''); setFollowUps([emptyFollowUp()]); setReviewStatus('Awaiting documentation')
    setStage('prepare'); setSaveMessage('A new appointment is ready to record.'); setSaveError('')
  }
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoadingRecord(true)
    setSaveError('')
    void (async () => {
      try {
        const session = await ensureAnonymousSession()
        setCurrentCaregiverId(session.caregiver.id)
        if (!draftKey && typeof crypto !== 'undefined' && crypto.randomUUID) setDraftKey(crypto.randomUUID())
        try {
          const brief = await getJSON('/appointment-workspaces/preparation-brief?window_days=90') as PreparationBrief
          if (!cancelled) setLcrBrief(brief)
          if (!cancelled) setBriefError('')
        } catch (error) {
          if (!cancelled) {
            setLcrBrief(null)
            setBriefError('Your care history could not be loaded. You can still record this visit.')
          }
        }
        const [response, handoffResponse, outcomeResponse, actionResponse] = await Promise.all([
          getJSON('/appointment-workspaces') as Promise<{ items?: SavedWorkspace[] }>,
          (getJSON('/handoffs/outbox') as Promise<{ items?: Array<{ id: string; scope?: string[]; expires_at?: string | null; is_expired?: boolean; recipients?: Array<{ caregiver_id: string; name?: string; status?: string }> }> }>).catch(() => ({ items: [] })),
          (getJSON('/care-continuity/outcomes/' + encodeURIComponent(session.person.id)) as Promise<FollowUpOutcomeEvent[]>).catch(() => []),
          (getJSON('/registered-actions/' + encodeURIComponent(session.person.id)) as Promise<RegisteredActionSnapshot[]>).catch(() => []),
        ])
        const items = response.items || []
        const outcomeEvents = Array.isArray(outcomeResponse) ? outcomeResponse : []
        const actionSnapshots = Array.isArray(actionResponse) ? actionResponse : []
        if (!cancelled) {
          setFollowUpOutcomeEvents(outcomeEvents)
          setRegisteredActionSnapshots(actionSnapshots)
        }
        const assignmentOptions = (handoffResponse.items || []).flatMap(handoff =>
          !handoff.is_expired && (handoff.scope || []).includes('open_loops')
            ? (handoff.recipients || []).filter(recipient => recipient.status === 'accepted').map(recipient => ({
                handoff_id: handoff.id,
                caregiver_id: recipient.caregiver_id,
                name: recipient.name || 'Linked caregiver',
                expires_at: handoff.expires_at,
              }))
            : []
        )
        if (!cancelled) setAcceptedHandoffRecipients(assignmentOptions)
        if (cancelled) return
        setSavedWorkspaces(items)
        const first = items[0]
        if (!first) return
        applySavedWorkspace(first, outcomeEvents, actionSnapshots)
      } catch (error) {
        if (!cancelled) setSaveError('We could not open these saved appointment notes. Try again.')
      } finally {
        if (!cancelled) setLoadingRecord(false)
      }
    })()
    return () => { cancelled = true }
  }, [open])

  const saveWorkspace = async () => {
    if (attendanceStatus === 'rescheduled' && !rescheduledDate) {
      setSaveError('Add the new appointment date before saving a rescheduled visit.')
      return
    }
    for (const item of followUps) {
      if (['Received', 'Reviewed'].includes(item.resultStatus) && (!item.register || !item.action.trim())) {
        setSaveError('Register the follow-up action before recording a result against it.')
        return
      }
      if (['Received', 'Reviewed'].includes(item.resultStatus) && !item.resultText?.trim()) {
        setSaveError('Describe the result that was received before saving its status.')
        return
      }
      if (item.resultStatus === 'Reviewed' && (!item.reviewDecision || !item.reviewNotes?.trim())) {
        setSaveError('Choose a review decision and record what was concluded after reviewing the result.')
        return
      }
    }
    const activeDraftKey = draftKey || crypto.randomUUID()
    setDraftKey(activeDraftKey)
    setSavingRecord(true)
    setSaveError('')
    setSaveMessage('')
    let baseWorkspaceSaved = false
    const payload = {
      draftKey: activeDraftKey, appointmentId: selectedAppointmentId || null, attendanceStatus, actualVisitDate, actualVisitAt: actualVisitDate ? new Date(actualVisitDate).toISOString() : undefined, rescheduledDate, rescheduledAt: rescheduledDate ? new Date(rescheduledDate).toISOString() : undefined, testsReferrals, approvedEvidenceFields, visitPurpose, clinician, specialty, visitDate, location, attendees, topConcerns,
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
      const session = await ensureAnonymousSession()
      const sourceFields: Array<[string, string, string]> = [
        ['caregiverReport', 'What the person or caregiver reported', caregiverReport],
        ['clinicianFindings', 'What the professional said', clinicianFindings],
        ['decisions', 'Decisions made', decisions],
        ['instructions', 'Instructions given', instructions],
        ['unanswered', 'Questions still unanswered', unanswered],
        ['medicationReconciliation', 'Medication information and questions', medicationReconciliation],
        ['testsReferrals', 'Tests and referrals', testsReferrals],
        ['pendingResults', 'Results still expected', pendingResults],
        ['familySummary', 'What the family needs to know', familySummary],
      ]
      const evidenceByField: Record<string, string> = {}
      for (const [field, label, sourceText] of sourceFields) {
        if (!sourceText.trim()) continue
        const fingerprint = await textFingerprint(sourceText)
        const evidence = await postJSON('/evidence', {
          person_id: session.person.id,
          type: 'appointment_note',
          evidence_kind: 'caregiver_report',
          epistemic_status: 'caregiver_reported',
          source_text: sourceText,
          source_type: field === 'clinicianFindings' ? 'caregiver_report_of_professional_statement' : 'caregiver_report',
          reported_by_label: session.caregiver.name || 'Caregiver',
          reported_by_caregiver_id: session.caregiver.id,
          uploaded_by_caregiver_id: session.caregiver.id,
          occurred_at: actualVisitDate ? new Date(actualVisitDate).toISOString() : undefined,
          collection_method: 'manual',
          extra_metadata: { appointment_draft_key: activeDraftKey, field, label },
          ingestion_key: 'appt-' + activeDraftKey + '-' + field + '-' + fingerprint.slice(0, 24),
        }) as { id: string }
        evidenceByField[field] = evidence.id
      }
      const followUpEvidence: Record<number, string> = {}
      const resultEvidenceByIndex: Record<number, string> = {}
      for (let index = 0; index < followUps.length; index += 1) {
        const item = followUps[index]
        if (!item.register || !item.action.trim()) continue
        const sourceText = [item.action, item.owner ? 'Responsible person: ' + item.owner : '', item.due ? 'Due: ' + item.due : '', item.notes].filter(Boolean).join('\\n')
        const fingerprint = await textFingerprint(sourceText)
        const evidence = await postJSON('/evidence', {
          person_id: session.person.id,
          type: 'appointment_follow_up',
          evidence_kind: 'caregiver_report',
          epistemic_status: 'caregiver_reported',
          source_text: sourceText,
          source_type: 'caregiver_recorded_follow_up',
          reported_by_label: session.caregiver.name || 'Caregiver',
          reported_by_caregiver_id: session.caregiver.id,
          uploaded_by_caregiver_id: session.caregiver.id,
          occurred_at: actualVisitDate ? new Date(actualVisitDate).toISOString() : undefined,
          collection_method: 'manual',
          extra_metadata: { appointment_draft_key: activeDraftKey, follow_up_index: index },
          ingestion_key: 'appt-' + activeDraftKey + '-followup-' + index + '-' + fingerprint.slice(0, 20),
        }) as { id: string }
        followUpEvidence[index] = evidence.id
      }
      for (let index = 0; index < followUps.length; index += 1) {
        const item = followUps[index]
        if (!item.register || !['Received', 'Reviewed'].includes(item.resultStatus)) continue
        if (!item.resultText?.trim()) throw new Error('Add the received result before saving its receipt.')
        const resultFingerprint = await textFingerprint(item.resultText.trim())
        const evidence = await postJSON('/evidence', {
          person_id: session.person.id,
          type: 'appointment_result',
          evidence_kind: 'caregiver_report',
          epistemic_status: 'caregiver_reported',
          source_text: item.resultText.trim(),
          source_type: 'caregiver_recorded_received_result',
          reported_by_label: session.caregiver.name || 'Caregiver',
          reported_by_caregiver_id: session.caregiver.id,
          uploaded_by_caregiver_id: session.caregiver.id,
          collection_method: 'manual',
          extra_metadata: { appointment_draft_key: activeDraftKey, follow_up_index: index, result_received: true },
          ingestion_key: 'appt-' + activeDraftKey + '-result-' + index + '-' + resultFingerprint.slice(0, 24),
        }) as { id: string }
        resultEvidenceByIndex[index] = evidence.id
      }
      const durablePayload = { ...payload, evidenceByField, followUpEvidence, resultEvidenceByIndex, evidence_ids: [...Object.values(evidenceByField), ...Object.values(followUpEvidence), ...Object.values(resultEvidenceByIndex)] }
      let savedRecordId: string
      let savedRecordVersion = recordVersion
      const linkedFollowUps = followUps.map(item => ({ ...item }))
      const createdOutcomeEvents: FollowUpOutcomeEvent[] = []
      if (recordId) {
        savedRecordId = recordId
        const updated = await patchJSON('/appointment-workspaces/' + encodeURIComponent(recordId), {
          expected_version: recordVersion,
          idempotency_key: activeDraftKey + '-v' + String(recordVersion + 1),
          status: ({ 'Awaiting documentation': 'preparation', 'Follow-up pending': 'follow_up_pending', 'Ready for review': 'ready_for_review', 'Closed with documented outstanding items': 'closed_with_outstanding_items' } as const)[reviewStatus],
          payload: durablePayload, change_reason: 'Caregiver saved appointment workspace',
        }) as { version_number: number }
        setRecordVersion(updated.version_number)
        savedRecordVersion = updated.version_number
        baseWorkspaceSaved = true
      } else {
        const created = await postJSON('/appointment-workspaces', {
          appointment_id: selectedAppointmentId || null, status: 'outcome_pending', payload: durablePayload, change_reason: 'Initial caregiver appointment workspace save', idempotency_key: activeDraftKey,
        }) as { id: string; version_number: number }
        setRecordId(created.id)
        savedRecordId = created.id
        setRecordVersion(created.version_number)
        savedRecordVersion = created.version_number
        baseWorkspaceSaved = true
      }
      try {
        const refreshedWorkspaces = await getJSON('/appointment-workspaces') as { items?: SavedWorkspace[] }
        setSavedWorkspaces(refreshedWorkspaces.items || [])
      } catch { /* The saved appointment remains available on the next refresh. */ }
      const savedActions = await getJSON('/registered-actions/' + encodeURIComponent(session.person.id)) as RegisteredActionSnapshot[]
      const updatedActionSnapshots = [...savedActions]
      const upsertActionSnapshot = (snapshot: RegisteredActionSnapshot) => {
        const existingIndex = updatedActionSnapshots.findIndex(action => action.id === snapshot.id)
        if (existingIndex >= 0) updatedActionSnapshots[existingIndex] = snapshot
        else updatedActionSnapshots.push(snapshot)
      }
      for (let index = 0; index < followUps.length; index += 1) {
        const item = followUps[index]
        const evidenceId = followUpEvidence[index]
        if (!item.register || !item.action.trim() || !evidenceId) continue
        const sourceText = [item.action, item.owner ? 'Responsible person: ' + item.owner : '', item.due ? 'Due: ' + item.due : '', item.notes].filter(Boolean).join('\\n')
        const sourceFingerprint = await textFingerprint(sourceText)
        const suggestionPrefix = 'appointment-' + activeDraftKey + '-followup-' + index + '-'
        const suggestionId = suggestionPrefix + sourceFingerprint.slice(0, 20)
        const targetStatus = item.status === 'Completed' ? 'completed' : item.status === 'Cancelled' ? 'cancelled' : item.status === 'Not started' ? 'approved' : 'in_progress'
        let registered = savedActions.find(action => action.suggestion_id === suggestionId)
        if (!registered) {
          registered = await postJSON('/registered-actions/' + encodeURIComponent(session.person.id) + '/approve', {
            explicit_approval: true,
            idempotency_key: 'appointment-' + activeDraftKey + '-action-' + index + '-' + sourceFingerprint.slice(0, 20),
            suggestion_id: suggestionId,
            title: item.action,
            action_type: 'follow_up',
            rationale: 'Caregiver-approved next step. ' + (item.owner ? 'Responsible person noted: ' + item.owner + '. ' : '') + (item.due ? 'Due: ' + item.due + '. ' : '') + item.notes,
            limitations: 'A name here is only a note; SolenOS does not notify that person.',
            evidence_ids: [evidenceId],
            create_reminder: Boolean(item.due),
            reminder_due_at: item.due ? new Date(item.due + 'T09:00:00').toISOString() : undefined,
          }) as { id: string; suggestion_id: string; status: string; version: number; responsible_caregiver_id?: string | null }
        }
        for (const prior of savedActions.filter(action => action.suggestion_id.startsWith(suggestionPrefix) && action.suggestion_id !== suggestionId && ['approved', 'in_progress'].includes(action.status))) {
          if (prior.responsible_caregiver_id && prior.responsible_caregiver_id !== session.caregiver.id) {
            throw new Error('A follow-up already assigned to another caregiver must be updated by that caregiver. The existing responsibility was not changed.')
          }
          const cancelled = await patchJSON('/registered-actions/' + encodeURIComponent(prior.id) + '/status', {
            status: 'cancelled',
            expected_version: prior.version,
            reason: 'This follow-up was replaced by an updated caregiver entry.',
          }) as RegisteredActionSnapshot
          upsertActionSnapshot(cancelled)
        }
        if (registered.status !== targetStatus) {
          registered = await patchJSON('/registered-actions/' + encodeURIComponent(registered.id) + '/status', {
            status: targetStatus,
            expected_version: registered.version,
            explicit_completion_confirmation: targetStatus === 'completed',
            reason: 'Caregiver updated this appointment follow-up. Result status: ' + item.resultStatus,
          }) as typeof registered
        }
        if (!['completed', 'cancelled'].includes(targetStatus) && item.assignedCaregiverId && item.assignmentHandoffId && registered.responsible_caregiver_id !== item.assignedCaregiverId) {
          if (registered.responsible_caregiver_id && registered.responsible_caregiver_id !== session.caregiver.id) {
            throw new Error('Only the currently responsible caregiver can transfer this follow-up again.')
          }
          const assignmentFingerprint = await textFingerprint(registered.id + '|' + item.assignedCaregiverId + '|' + item.assignmentHandoffId)
          registered = await patchJSON('/registered-actions/' + encodeURIComponent(registered.id) + '/assignee', {
            target_caregiver_id: item.assignedCaregiverId,
            handoff_id: item.assignmentHandoffId,
            expected_version: registered.version,
            idempotency_key: 'appointment-' + activeDraftKey + '-assign-' + index + '-' + assignmentFingerprint.slice(0, 20),
            reason: 'The receiving caregiver accepted the appointment follow-up handoff.',
          }) as typeof registered
        }
        upsertActionSnapshot(registered)
        linkedFollowUps[index] = { ...item, registeredActionId: registered.id }
        if (['Received', 'Reviewed'].includes(item.resultStatus)) {
          const resultEvidenceId = resultEvidenceByIndex[index]
          if (!resultEvidenceId) throw new Error('The received result has no saved source evidence.')
          const resultFingerprint = await textFingerprint(item.resultText!.trim())
          const received = await postJSON('/care-continuity/action-outcomes', {
            action_id: registered.id,
            action_type: 'follow_up_result',
            outcome_status: 'result_received',
            notes: item.resultText!.trim(),
            evidence_ids: [resultEvidenceId],
            idempotency_key: 'appt-' + activeDraftKey + '-result-received-' + index + '-' + resultFingerprint.slice(0, 16),
          }) as FollowUpOutcomeEvent
          createdOutcomeEvents.push(received)
          linkedFollowUps[index] = {
            ...linkedFollowUps[index], resultReceivedEventId: received.id, resultStatus: 'Received',
            resultReceivedAt: received.received_at ?? received.created_at ?? undefined,
            resultReceivedByCaregiverId: received.received_by_caregiver_id ?? received.created_by_caregiver_id ?? undefined,
          }
          if (item.resultStatus === 'Reviewed') {
            const reviewFingerprint = await textFingerprint((item.reviewNotes || '').trim())
            const reviewed = await postJSON('/care-continuity/action-outcomes', {
              action_id: registered.id,
              action_type: 'follow_up_result',
              outcome_status: 'result_reviewed',
              related_outcome_id: received.id,
              review_decision: item.reviewDecision,
              notes: item.reviewNotes!.trim(),
              evidence_ids: [resultEvidenceId],
              idempotency_key: 'appt-' + activeDraftKey + '-result-reviewed-' + index + '-' + item.reviewDecision + '-' + resultFingerprint.slice(0, 10) + '-' + reviewFingerprint.slice(0, 10),
            }) as FollowUpOutcomeEvent
            createdOutcomeEvents.push(reviewed)
            linkedFollowUps[index] = {
              ...linkedFollowUps[index], resultReviewedEventId: reviewed.id, resultStatus: 'Reviewed',
              resultReviewedAt: reviewed.reviewed_at ?? reviewed.created_at ?? undefined,
              resultReviewedByCaregiverId: reviewed.reviewed_by_caregiver_id ?? reviewed.created_by_caregiver_id ?? undefined,
              reviewDecision: item.reviewDecision,
            }
          }
        }
      }
      if (linkedFollowUps.some(item => item.registeredActionId || item.resultReceivedEventId || item.resultReviewedEventId)) {
        const linked = await patchJSON('/appointment-workspaces/' + encodeURIComponent(savedRecordId), {
          expected_version: savedRecordVersion,
          idempotency_key: activeDraftKey + '-links-v' + String(savedRecordVersion + 1),
          status: ({ 'Awaiting documentation': 'preparation', 'Follow-up pending': 'follow_up_pending', 'Ready for review': 'ready_for_review', 'Closed with documented outstanding items': 'closed_with_outstanding_items' } as const)[reviewStatus],
          payload: { ...durablePayload, followUps: linkedFollowUps },
          change_reason: 'Saved links to registered follow-ups and result history.',
        }) as { version_number: number }
        savedRecordVersion = linked.version_number
        setRecordVersion(linked.version_number)
      }
      setFollowUps(linkedFollowUps)
      setRegisteredActionSnapshots(updatedActionSnapshots)
      if (createdOutcomeEvents.length) setFollowUpOutcomeEvents(current => [...current, ...createdOutcomeEvents.filter(event => !current.some(existing => existing.id === event.id))])
      if (actualVisitDate && attendanceStatus === 'attended' && approvedEvidenceFields.length) {
        const assertions = await getJSON('/care-continuity/assertions/' + encodeURIComponent(session.person.id) + '?limit=200') as Array<{ id: string; subject_type: string; subject_id: string; field: string; asserted_value: string; evidence_ids: string[]; assertion_status: string }>
        for (const field of approvedEvidenceFields) {
          const source = sourceFields.find(entry => entry[0] === field)
          const evidenceId = evidenceByField[field]
          if (!source || !evidenceId || !source[2].trim()) continue
          const existing = assertions.find(item => item.subject_type === 'appointment' && item.subject_id === savedRecordId && item.field === field && item.asserted_value === source[2] && item.evidence_ids?.includes(evidenceId))
          let assertionId = existing?.id
          if (!existing) {
            const created = await postJSON('/care-continuity/assertions', {
              subject_type: 'appointment',
              subject_id: savedRecordId,
              field,
              assertion_kind: 'time_bound_observation',
              asserted_value: source[2],
              source_label: field === 'clinicianFindings' ? 'Caregiver-reported professional statement' : 'Caregiver report',
              source_text: source[2],
              evidence_ids: [evidenceId],
              observed_at: new Date(actualVisitDate).toISOString(),
            }) as { id: string; subject_type: string; subject_id: string; field: string; asserted_value: string; evidence_ids: string[]; assertion_status: string }
            assertionId = created.id
            assertions.push(created)
          }
          if (assertionId && existing?.assertion_status !== 'accepted') {
            await patchJSON('/care-continuity/assertions/' + encodeURIComponent(assertionId) + '/status', { assertion_status: 'accepted' })
          }
        }
      }
      const approvedFollowUpResultFields = approvedEvidenceFields.filter(field => field.startsWith('followUpResult:'))
      if (approvedFollowUpResultFields.length) {
        const resultAssertions = await getJSON('/care-continuity/assertions/' + encodeURIComponent(session.person.id) + '?limit=200') as Array<{ id: string; subject_type: string; subject_id: string; field: string; asserted_value: string; evidence_ids: string[]; assertion_status: string }>
        for (const approvalField of approvedFollowUpResultFields) {
          const index = Number(approvalField.split(':')[1])
          const item = followUps[index]
          const evidenceId = resultEvidenceByIndex[index]
          if (!item || !evidenceId || !item.resultText?.trim()) continue
          const assertionField = 'followUpResult_' + index
          const receivedEventId = linkedFollowUps[index]?.resultReceivedEventId || item.resultReceivedEventId
          const receivedEvent = createdOutcomeEvents.find(event => event.id === receivedEventId) || followUpOutcomeEvents.find(event => event.id === receivedEventId)
          const observedAt = receivedEvent?.received_at || receivedEvent?.created_at || new Date().toISOString()
          const existing = resultAssertions.find(assertion => assertion.subject_type === 'appointment' && assertion.subject_id === savedRecordId && assertion.field === assertionField && assertion.asserted_value === item.resultText!.trim() && assertion.evidence_ids?.includes(evidenceId))
          let assertionId = existing?.id
          if (!existing) {
            const created = await postJSON('/care-continuity/assertions', {
              subject_type: 'appointment',
              subject_id: savedRecordId,
              field: assertionField,
              assertion_kind: 'time_bound_observation',
              asserted_value: item.resultText.trim(),
              source_label: 'Caregiver-reported follow-up result',
              source_text: item.resultText.trim(),
              evidence_ids: [evidenceId],
              observed_at: observedAt,
            }) as { id: string; assertion_status: string }
            assertionId = created.id
            resultAssertions.push({
              id: created.id, subject_type: 'appointment', subject_id: savedRecordId,
              field: assertionField, asserted_value: item.resultText.trim(),
              evidence_ids: [evidenceId], assertion_status: created.assertion_status,
            })
          }
          const requiresFurtherReview = ['disputed', 'needs_clinician_review', 'not_relevant'].includes(item.reviewDecision || '')
          if (assertionId && !requiresFurtherReview && existing?.assertion_status !== 'accepted') {
            await patchJSON('/care-continuity/assertions/' + encodeURIComponent(assertionId) + '/status', { assertion_status: 'accepted' })
          }
        }
      }
      const [latestConflicts, latestAssertions] = await Promise.all([
        getJSON('/care-continuity/contradictions/' + encodeURIComponent(session.person.id) + '?limit=100') as Promise<AppointmentConflict[]>,
        getJSON('/care-continuity/assertions/' + encodeURIComponent(session.person.id) + '?limit=100') as Promise<AppointmentAssertion[]>,
      ])
      setAppointmentConflicts(latestConflicts.filter(item => item.subject_type === 'appointment' && item.subject_id === savedRecordId && item.resolution_status === 'unresolved'))
      setAppointmentAssertions(latestAssertions.filter(item => item.subject_id === savedRecordId))
      setSaveMessage('Appointment notes and available follow-up updates have been saved.')
    } catch (error) {
      if (baseWorkspaceSaved) {
        const detail = error instanceof Error ? error.message : ''
        const responsibilityConflict = /assigned to another caregiver|currently responsible caregiver/i.test(detail)
        setSaveError(responsibilityConflict
          ? detail
          : 'Your appointment notes were saved, but some follow-up updates could not be confirmed. Keep this screen open and retry; saved steps are protected against duplicate creation.')
      } else {
        setSaveError('We could not save these appointment notes. Your entries are still on this screen. Try again.')
      }
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
        <div className="appointment-boundary"><ShieldCheck size={17} aria-hidden="true" /><span>Your notes stay connected to the person’s care history. What you report, what a professional said, and what a document records are kept distinct.</span></div>
        {savedWorkspaces.length > 0 && <section className="appointment-saved-list" aria-label="Saved appointment notes">
          <div className="appointment-saved-list-heading"><h4>Previous appointment notes</h4><button type="button" className="appointment-secondary" onClick={startAnotherAppointment}>Start another appointment</button></div>
          <div className="appointment-saved-list-items">{savedWorkspaces.map(item => { const linked = lcrBrief?.appointments.find(appointment => appointment.source_id === item.appointment_id); return <button key={item.id} type="button" className="appointment-saved-item" aria-pressed={recordId === item.id} onClick={() => applySavedWorkspace(item)}><strong>{linked?.title || 'Appointment notes'}</strong><span>{item.updated_at ? 'Updated ' + new Date(item.updated_at).toLocaleDateString() : 'Saved appointment'}</span></button> })}</div>
        </section>}
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
                <p>{lcrBrief ? 'Care history updated · ' + new Date(lcrBrief.snapshot_at).toLocaleString() : 'Your care history could not be loaded.'}</p>
              </div>
              <span className="appointment-source-pill">{lcrBrief ? 'From your care record' : 'Not available'}</span>
            </div>
            {briefError && <p className="appointment-brief-warning" role="status">Care history could not be loaded: {briefError}. This is not evidence that no care history exists.</p>}
            {lcrBrief && <>
              <div className="appointment-brief-grid">
                <div><strong>Recorded facts ({lcrBrief.facts.length})</strong>
                  {lcrBrief.facts.length ? <ul>{lcrBrief.facts.slice(0, 10).map(item => <li key={item.source_id} data-record-reference={item.source_id} data-epistemic-status={item.epistemic_status}><span>{item.value || 'No value recorded'}</span><small>{item.fact_type.replaceAll('_', ' ')}</small>{item.evidence_sources?.map(source => <small key={source.evidence_id}>{source.reported_by_label || source.original_author || 'Source not identified'} · {source.epistemic_status === 'caregiver_reported' ? 'Reported by a caregiver' : source.epistemic_status === 'professional_recorded' ? 'Recorded by a professional' : source.epistemic_status === 'document_extracted' ? 'Taken from a document' : 'Source status not confirmed'}{source.occurred_at ? ' · ' + new Date(source.occurred_at).toLocaleDateString() : ''}</small>)}</li>)}</ul> : <p>No recorded information is available in this section yet.</p>}
                </div>
                <div><strong>Recent updates ({lcrBrief.events.length})</strong>
                  {lcrBrief.events.length ? <ul>{lcrBrief.events.slice(0, 8).map(item => <li key={item.source_id} data-record-reference={item.source_id}><span>{item.title}</span><small>{item.occurred_at ? new Date(item.occurred_at).toLocaleString() : 'Time not recorded'}</small>{item.description && <p>{item.description}</p>}{item.evidence_sources?.map(source => <small key={source.evidence_id}>{source.reported_by_label || source.original_author || 'Source not identified'} · {source.epistemic_status === 'caregiver_reported' ? 'Reported by a caregiver' : source.epistemic_status === 'professional_recorded' ? 'Recorded by a professional' : source.epistemic_status === 'document_extracted' ? 'Taken from a document' : 'Source status not confirmed'}</small>)}</li>)}</ul> : <p>No recent updates are recorded yet.</p>}
                </div>
                <div><strong>Previous appointments ({lcrBrief.appointments.length})</strong>
                  {lcrBrief.appointments.length ? <ul>{lcrBrief.appointments.slice(0, 6).map(item => <li key={item.source_id} data-record-reference={item.source_id}><span>{item.title}</span><small>{item.scheduled_at ? new Date(item.scheduled_at).toLocaleString() : 'Date not recorded'} · {item.status.replaceAll('_', ' ')}</small>{item.evidence_sources?.map(source => <small key={source.evidence_id}>{source.reported_by_label || source.original_author || 'Source not identified'} · {source.epistemic_status === 'caregiver_reported' ? 'Reported by a caregiver' : source.epistemic_status === 'professional_recorded' ? 'Recorded by a professional' : source.epistemic_status === 'document_extracted' ? 'Taken from a document' : 'Source status not confirmed'}</small>)}</li>)}</ul> : <p>No previous appointments are recorded yet.</p>}
                </div>
              </div>
              <section className="appointment-source-coverage" aria-label="Source availability">
                <strong>Information availability</strong>
                <div>{Object.entries(lcrBrief.source_coverage).map(([source, status]) => {
                  const sourceLabels: Record<string, string> = { care_facts: 'Care history', care_events: 'Recent updates', appointments: 'Appointments', evidence_freshness_assessments: 'Evidence review', medications_and_allergies: 'Medication and allergy details', documents: 'Documents', community: 'Community posts' }
                  const statusLabels: Record<string, string> = { available: 'Available', no_records_returned: 'No entries found in this period', unavailable: 'Could not be checked', unavailable_schema: 'Not available yet', not_authorized: 'Not included in this view', not_applicable_no_linked_evidence: 'No linked information to review' }
                  return <span key={source} className="appointment-coverage-item"><b>{sourceLabels[source] || 'Other information'}</b><small>{statusLabels[status] || 'Availability not confirmed'}</small></span>
                })}</div>
              </section>
              
              {lcrBrief.evidence_lineage && <section className="appointment-source-coverage" aria-label="Where this information came from" data-source-scope-truncated={String(Boolean(lcrBrief.evidence_lineage.scope_truncated))}>
                <strong>Where this information came from</strong>
                {lcrBrief.evidence_lineage.scope_truncated && <p role="status">We could only check part of the available source history. Other links may exist.</p>}
                {lcrBrief.evidence_lineage.groups.length ? lcrBrief.evidence_lineage.groups.map(group => <div key={group.lineage_id} className="appointment-coverage-item">
                  <b>{group.source_independence_status === 'independent' ? 'Separate sources were recorded' : group.source_independence_status === 'shared_origin' ? 'These entries share an original source' : 'The relationship between these sources is not confirmed'}</b>
                  <small>{group.evidence_ids.length} linked source records</small>
                </div>) : <p>Source connections are not recorded for these entries. This does not establish that the sources are independent.</p>}
              </section>}
              
              <section className="appointment-source-coverage" aria-label="When information was last reviewed">
                <strong>When information was last reviewed</strong>
                {lcrBrief.freshness_assessment_scope?.status === 'unavailable_schema'
                  ? <p>Review dates are not available for some care information yet. This does not mean those details are up to date.</p>
                  : lcrBrief.freshness_assessments?.length
                    ? lcrBrief.freshness_assessments.map(item => {
                      const reviewLabels: Record<string, string> = {
                        fresh: 'Checked within its review period',
                        current: 'Checked within its review period',
                        aging: 'A fresh check may be due soon',
                        stale: 'A fresh check may be needed',
                        overdue: 'A fresh check may be needed',
                        unknown: 'Review status is not known',
                      }
                      const domainLabels: Record<string, string> = {
                        medication: 'Medication information',
                        medications: 'Medication information',
                        allergy: 'Allergy information',
                        allergies: 'Allergy information',
                        care_plan: 'Care plan information',
                      }
                      return <div key={item.assessment_id} className="appointment-coverage-item">
                        <b>{domainLabels[item.domain_key] || 'Care information'}</b>
                        <small>{reviewLabels[item.freshness_status] || 'Review status is not confirmed'}</small>
                        <small>{item.assessed_at ? 'Last checked ' + new Date(item.assessed_at).toLocaleDateString() : 'Review date not recorded'}</small>
                      </div>
                    })
                    : <p>No review dates have been recorded for the linked information yet. This does not mean the information is up to date.</p>}
              </section>
              
              <p className="appointment-brief-limitations">Only information already recorded in your care history appears here. Missing information is not assumed to be absent.</p>
            </>}
          </section>
          <div className="appointment-fields appointment-fields-two">
            <label>Which appointment is this for?<select value={selectedAppointmentId} disabled={Boolean(recordId)} onChange={event => setSelectedAppointmentId(event.target.value)}><option value="">Choose an appointment</option>{lcrBrief?.appointments.map(item => <option key={item.source_id} value={item.source_id}>{item.title} · {item.scheduled_at ? new Date(item.scheduled_at).toLocaleDateString() : 'Date not recorded'}{item.provider ? ' · ' + item.provider : ''}</option>)}</select></label>
            <label>Visit purpose<textarea value={visitPurpose} onChange={event => setVisitPurpose(event.target.value)} rows={2} placeholder="What does the family want help understanding?" /></label>
            <label>Clinician name<input value={clinician} onChange={event => setClinician(event.target.value)} placeholder="Name, if known" /></label>
            <label>Specialty<input value={specialty} onChange={event => setSpecialty(event.target.value)} placeholder="Specialty, if known" /></label>
            <label>Date and time<input type="datetime-local" value={visitDate} onChange={event => setVisitDate(event.target.value)} /></label>
            <label>Location<input value={location} onChange={event => setLocation(event.target.value)} placeholder="Clinic or appointment location" /></label>
            <label>Who is attending?<input value={attendees} onChange={event => setAttendees(event.target.value)} placeholder="Person receiving care and support people" /></label>
          </div>
          <h5>The most important things to discuss</h5>
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
            <label>How did the appointment end?<select value={attendanceStatus} onChange={event => setAttendanceStatus(event.target.value as AttendanceStatus)}><option value="not_recorded">Not recorded yet</option><option value="attended">Attended</option><option value="cancelled">Cancelled</option><option value="rescheduled">Rescheduled</option><option value="missed">Missed</option></select></label>
            {attendanceStatus === 'attended' && <label>When did the visit take place?<input type="datetime-local" value={actualVisitDate} onChange={event => setActualVisitDate(event.target.value)} /></label>}
            {attendanceStatus === 'rescheduled' && <label>New appointment date and time<input type="datetime-local" value={rescheduledDate} onChange={event => setRescheduledDate(event.target.value)} /></label>}
            <label>Tests and referrals<textarea value={testsReferrals} onChange={event => setTestsReferrals(event.target.value)} rows={4} placeholder="Tests requested, referrals made, expected results, or details still unknown." /></label>
            <label>Medication reconciliation / discrepancies<textarea value={medicationReconciliation} onChange={event => setMedicationReconciliation(event.target.value)} rows={4} placeholder="Record the exact clinician instruction, source, effective date, verification status, and unresolved discrepancy. Never infer start/stop/change." /></label>
            <label>Results still expected<textarea value={pendingResults} onChange={event => setPendingResults(event.target.value)} rows={4} placeholder="What was ordered/referred, expected timing if stated, who will obtain/review results, and documented escalation route." /></label>
            <label>What the family needs to know<textarea value={familySummary} onChange={event => setFamilySummary(event.target.value)} rows={4} placeholder="What changes in everyday care, what remains the same, what to monitor, when to contact whom, and what remains uncertain." /></label>
          </div>
          <div className="appointment-followups-heading"><h5>Follow-up actions</h5><button type="button" className="appointment-secondary" onClick={addFollowUp}><ListChecks size={15} /> Add action</button></div>
          {followUps.map((item, index) => <div className="appointment-followup" key={index}>
            <label>Action<input value={item.action} disabled={Boolean(item.assignedCaregiverId && item.assignedCaregiverId !== currentCaregiverId)} onChange={event => updateFollowUp(index, 'action', event.target.value)} placeholder="Book follow-up, complete test, obtain result…" /></label>
            <label>Person or service mentioned<input value={item.owner} disabled={Boolean(item.assignedCaregiverId && item.assignedCaregiverId !== currentCaregiverId)} onChange={event => updateFollowUp(index, 'owner', event.target.value)} placeholder="Optional note; this does not assign responsibility" /></label>
            <label>Assign responsibility<select value={item.assignedCaregiverId && item.assignmentHandoffId ? item.assignmentHandoffId + '::' + item.assignedCaregiverId : ''} onChange={event => updateFollowUpAssignment(index, event.target.value)} disabled={!item.register || acceptedHandoffRecipients.length === 0 || ['Completed', 'Cancelled'].includes(item.status) || Boolean(item.assignedCaregiverId && item.assignedCaregiverId !== currentCaregiverId)}>
              <option value="">Keep with current caregiver</option>
              {item.assignedCaregiverId && item.assignmentHandoffId && !acceptedHandoffRecipients.some(option => option.handoff_id === item.assignmentHandoffId && option.caregiver_id === item.assignedCaregiverId) && <option value={item.assignmentHandoffId + '::' + item.assignedCaregiverId}>{item.assignedCaregiverId === currentCaregiverId ? 'Assigned to you' : 'Assigned to another caregiver'}</option>}
              {acceptedHandoffRecipients.map(option => <option key={option.handoff_id + '::' + option.caregiver_id} value={option.handoff_id + '::' + option.caregiver_id}>{option.name} · accepted handoff</option>)}
            </select></label>
            {item.assignedCaregiverId && <p className="appointment-assignment-help">{item.assignedCaregiverId === currentCaregiverId ? 'You are responsible for this follow-up.' : 'This follow-up has been assigned to another caregiver. That caregiver manages its status and any further transfer.'}</p>}
            {item.register && !item.assignedCaregiverId && acceptedHandoffRecipients.length === 0 && <p className="appointment-assignment-help">To assign this to another caregiver, share an open-loop handoff in Care Handoff and wait for that caregiver to accept it.</p>}
            <label>Due date<input type="date" value={item.due} disabled={Boolean(item.assignedCaregiverId && item.assignedCaregiverId !== currentCaregiverId)} onChange={event => updateFollowUp(index, 'due', event.target.value)} /></label>
            <label>Status<select value={item.status} disabled={Boolean(item.assignedCaregiverId && item.assignedCaregiverId !== currentCaregiverId) || ['Completed', 'Cancelled'].includes(item.status)} onChange={event => updateFollowUp(index, 'status', event.target.value)}><option>Not started</option><option>In progress</option><option>Waiting for result</option><option>Received</option><option>Needs review</option><option>Completed</option><option>Cancelled</option></select></label>
            <label>Result status<select value={item.resultStatus} disabled={!item.register || Boolean(item.assignedCaregiverId && item.assignedCaregiverId !== currentCaregiverId)} onChange={event => updateFollowUp(index, 'resultStatus', event.target.value)}><option>Not expected</option><option>Waiting</option><option>Received</option><option>Reviewed</option></select></label>
            <label>Notes<textarea value={item.notes} disabled={Boolean(item.assignedCaregiverId && item.assignedCaregiverId !== currentCaregiverId)} onChange={event => updateFollowUp(index, 'notes', event.target.value)} rows={2} placeholder="What happened, or what is still needed?" /></label>
            {['Received', 'Reviewed'].includes(item.resultStatus) && <label>What result was received?<textarea value={item.resultText || ''} disabled={Boolean(item.assignedCaregiverId && item.assignedCaregiverId !== currentCaregiverId)} onChange={event => updateFollowUp(index, 'resultText', event.target.value)} rows={3} placeholder="Record what arrived and its source. Keep the original document or evidence linked where available." /></label>}
            {item.resultStatus === 'Reviewed' && <>
              <label>Review decision<select value={item.reviewDecision || ''} disabled={Boolean(item.assignedCaregiverId && item.assignedCaregiverId !== currentCaregiverId)} onChange={event => updateFollowUp(index, 'reviewDecision', event.target.value)}><option value="">Choose a review decision</option><option value="acknowledged">Understood; no further action recorded</option><option value="follow_up_required">Further follow-up is required</option><option value="disputed">The result or interpretation is disputed</option><option value="needs_clinician_review">A clinician needs to review this</option><option value="not_relevant">Not relevant to this follow-up</option></select></label>
              <label>What did the caregiver decide after reviewing?<textarea value={item.reviewNotes || ''} disabled={Boolean(item.assignedCaregiverId && item.assignedCaregiverId !== currentCaregiverId)} onChange={event => updateFollowUp(index, 'reviewNotes', event.target.value)} rows={3} placeholder="Record the review and any remaining uncertainty." /></label>
            </>}
            {item.resultReceivedEventId && <small>Result received {item.resultReceivedAt ? new Date(item.resultReceivedAt).toLocaleString() : 'and saved'} · {item.resultReceivedByCaregiverId === currentCaregiverId ? 'by you' : 'by a linked caregiver'}.</small>}
            {item.resultReviewedEventId && <small>Reviewed {item.resultReviewedAt ? new Date(item.resultReviewedAt).toLocaleString() : 'and saved'} · {item.resultReviewedByCaregiverId === currentCaregiverId ? 'by you' : 'by a linked caregiver'}.</small>}
            {item.resultText?.trim() && ['Received', 'Reviewed'].includes(item.resultStatus) && <label className="appointment-review-status"><input type="checkbox" checked={approvedEvidenceFields.includes('followUpResult:' + index)} disabled={Boolean(item.assignedCaregiverId && item.assignedCaregiverId !== currentCaregiverId)} onChange={event => setApprovedEvidenceFields(current => event.target.checked ? [...current, 'followUpResult:' + index] : current.filter(value => value !== 'followUpResult:' + index))} /> Include this caregiver-reported result in the Living Care Record</label>}
            {item.resultStatus === 'Reviewed' && ['disputed', 'needs_clinician_review'].includes(item.reviewDecision || '') && <small>This result remains a caregiver report requiring further review; it will not be marked as accepted care information.</small>}
            <label className="appointment-review-status"><input type="checkbox" checked={item.register} disabled={Boolean(item.assignedCaregiverId && item.assignedCaregiverId !== currentCaregiverId)} onChange={event => updateFollowUp(index, 'register', event.target.checked)} /> Add this to my follow-up responsibilities</label>
          </div>)}
          <section className="appointment-review-status"><h5>Add notes to the care history</h5>{appointmentConflicts.length > 0 && <div className="appointment-conflicts"><h6>Different accounts need a closer look</h6><p>These notes do not agree. Neither has been chosen as correct. Both accounts remain available for review.</p>{appointmentConflicts.map(conflict => {
            const related = appointmentAssertions.filter(assertion => assertion.field === conflict.field && assertion.subject_id === conflict.subject_id)
            return <article key={conflict.id}><strong>{appointmentFieldLabel(conflict.field)}</strong>{related.length ? related.map(assertion => <div key={assertion.id}><small>{assertion.source_label || 'Caregiver report'} · {assertion.assertion_status === 'accepted' ? 'Included in your care history' : assertion.assertion_status === 'rejected' ? 'Not included' : 'Waiting for your review'}</small><p>{assertion.asserted_value}</p></div>) : <p>{conflict.description}</p>}</article>
          })}</div>}<p>Choose the notes you have checked and want included in the care history. A note about what a professional said remains a caregiver report unless supported by the original professional record. These notes are not added until you choose them here.</p>{[['caregiverReport','What the person or caregiver reported'],['clinicianFindings','What the professional said'],['decisions','Decisions made'],['instructions','Instructions given'],['unanswered','Questions still unanswered'],['medicationReconciliation','Medication information and questions'],['testsReferrals','Tests and referrals'],['pendingResults','Results still expected'],['familySummary','What the family needs to know']].map(([field,label]) => <label key={field}><input type="checkbox" checked={approvedEvidenceFields.includes(field)} disabled={!actualVisitDate || attendanceStatus !== 'attended' || !(field === 'caregiverReport' ? caregiverReport : field === 'clinicianFindings' ? clinicianFindings : field === 'decisions' ? decisions : field === 'instructions' ? instructions : field === 'unanswered' ? unanswered : field === 'medicationReconciliation' ? medicationReconciliation : field === 'testsReferrals' ? testsReferrals : field === 'pendingResults' ? pendingResults : familySummary).trim()} onChange={event => setApprovedEvidenceFields(current => event.target.checked ? [...current, field] : current.filter(value => value !== field))} /> {label}</label>)}</section>
          <label className="appointment-review-status">Closure status<select value={reviewStatus} onChange={event => setReviewStatus(event.target.value as typeof reviewStatus)}><option>Awaiting documentation</option><option>Follow-up pending</option><option>Ready for review</option><option>Closed with documented outstanding items</option></select></label>
          <p className="appointment-save-boundary"><FileCheck2 size={16} aria-hidden="true" /> Save your notes before leaving this page. Your saved appointment and follow-up details will be here when you return.</p>
        </div>}

        <div className="appointment-save-controls">
          <div className="appointment-save-status" role="status" aria-live="polite">
            {loadingRecord ? 'Opening your saved appointment notes…' : saveMessage}
            {saveError && <span className="appointment-error">{saveError}</span>}
          </div>
          <button type="button" className="appointment-primary" onClick={() => void saveWorkspace()} disabled={savingRecord || loadingRecord}>
            {savingRecord ? 'Saving…' : recordId ? 'Save appointment changes' : 'Save appointment'}
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


type GuidedAppointment = {
  source_id: string
  title: string
  scheduled_at?: string | null
  provider?: string | null
  location?: string | null
  status: string
}
type GuidedBrief = {
  snapshot_at: string
  facts: Array<{ source_id: string; fact_type: string; value: string | null; epistemic_status: string; effective_at?: string | null }>
  events: Array<{ source_id: string; title: string; description?: string | null; occurred_at?: string | null; status: string }>
  appointments: GuidedAppointment[]
  limitations: string[]
}
type GuidedWorkspace = {
  id: string
  appointment_id?: string | null
  status: string
  version_number: number
  payload: Record<string, unknown>
}
type GuidedOutcome = {
  status: string
  read_only: boolean
  updates_lcr: boolean
  sections: Record<string, Array<{ label?: string; text: string; epistemic_status?: string; source_type?: string }>>
  missing_information: string[]
  limitations: string[]
}

const guidedStageStatus: Record<Stage, string> = {
  prepare: 'preparation',
  during: 'during_visit',
  after: 'outcome_pending',
}

function GuidedStageContent({
  stage, brief, outcome, quickCapture, setQuickCapture, saving, saveError, saveMessage,
  onSave, onRefreshOutcome,
}: {
  stage: Stage
  brief: GuidedBrief | null
  outcome: GuidedOutcome | null
  quickCapture: string
  setQuickCapture: (value: string) => void
  saving: boolean
  onSave: () => void
  onRefreshOutcome: () => void
}) {
  if (stage === 'prepare') {
    return <div className="guided-panel">
      <div className="guided-panel-heading"><div><h4>Your appointment brief</h4><p>Prepared from information already in the Living Care Record. Nothing to fill in.</p></div><span className="guided-state">Read-only</span></div>
      {!brief && <p className="guided-muted">Your care history could not be loaded. SolenOS will not treat missing information as proof that it does not exist.</p>}
      {brief && <>
        <div className="guided-columns">
          <section><h5>Recent care history</h5>{brief.events.length ? <ul>{brief.events.slice(0,6).map(item => <li key={item.source_id}><strong>{item.title}</strong>{item.description && <p>{item.description}</p>}<small>{item.occurred_at ? new Date(item.occurred_at).toLocaleDateString() : 'Date not recorded'} · {item.status}</small></li>)}</ul> : <p className="guided-muted">No recent care events were returned for this brief.</p>}</section>
          <section><h5>Recorded care information</h5>{brief.facts.length ? <ul>{brief.facts.slice(0,6).map(item => <li key={item.source_id}><strong>{item.fact_type.replaceAll('_',' ')}</strong><p>{item.value || 'No detail recorded'}</p><small>{item.epistemic_status.replaceAll('_',' ')}</small></li>)}</ul> : <p className="guided-muted">No care facts were returned for this brief.</p>}</section>
        </div>
        <section className="guided-appointments"><h5>Appointments in the care record</h5>{brief.appointments.length ? <ul>{brief.appointments.slice(0,5).map(item => <li key={item.source_id}><strong>{item.title}</strong><span>{item.scheduled_at ? new Date(item.scheduled_at).toLocaleString() : 'Date not recorded'} · {item.status}</span></li>)}</ul> : <p className="guided-muted">No appointment was returned. This does not establish that no appointment exists.</p>}</section>
        <p className="guided-footnote">Prepared {new Date(brief.snapshot_at).toLocaleString()}. The brief keeps recorded reports, dates and unknowns separate.</p>
      </>}
    </div>
  }
  if (stage === 'during') {
    return <div className="guided-panel">
      <div className="guided-panel-heading"><div><h4>Stay with the appointment</h4><p>You do not need to document while speaking with the professional.</p></div><span className="guided-state">Optional</span></div>
      <p className="guided-muted">If it helps, leave yourself one short note. You can also leave this empty and return later.</p>
      <label className="guided-capture-label">Anything you want to remember?
        <textarea value={quickCapture} onChange={event => setQuickCapture(event.target.value)} rows={4} placeholder="Optional note. Your own words are enough." />
      </label>
      <button className="guided-primary" type="button" onClick={onSave} disabled={saving}>{saving ? 'Saving…' : 'Save note and continue'}</button>
      <p className="guided-footnote">A note saved here is attributed to the caregiver. It does not become a verified professional statement or change the Living Care Record.</p>
    </div>
  }
  return <div className="guided-panel">
    <div className="guided-panel-heading"><div><h4>What happened at the appointment?</h4><p>SolenOS will organise only information that has actually been recorded.</p></div><span className="guided-state">Review first</span></div>
    <label className="guided-capture-label">Add anything you remember, if you want to
      <textarea value={quickCapture} onChange={event => setQuickCapture(event.target.value)} rows={4} placeholder="You can add a brief note, paste text, or leave this empty." />
    </label>
    <div className="guided-actions"><button className="guided-primary" type="button" onClick={onSave} disabled={saving}>{saving ? 'Saving…' : 'Save what I remember'}</button><button className="guided-secondary" type="button" onClick={onRefreshOutcome}>Refresh outcome</button></div>
    {outcome?.status === 'ready_for_review' && <div className="guided-outcome" aria-live="polite">
      <h5>Appointment information gathered</h5>
      {Object.entries(outcome.sections).filter(([,items]) => items.length).map(([key,items]) => <section key={key}><h6>{key.replaceAll('_',' ')}</h6>{items.map((item,index) => <p key={key+index}>{item.text}<small>{item.epistemic_status?.replaceAll('_',' ') || 'Recorded information'} · {item.source_type?.replaceAll('_',' ') || 'Caregiver record'}</small></p>)}</section>)}
      {outcome.missing_information.length > 0 && <p className="guided-muted">Not recorded: {outcome.missing_information.join(', ')}.</p>}
      <p className="guided-footnote">This is a review draft, not a clinical conclusion. The Living Care Record has not been changed.</p>
    </div>}
    {(!outcome || outcome.status === 'no_outcome_information') && <p className="guided-muted">No appointment outcome has been recorded yet. You can return later; SolenOS will not invent what happened.</p>}
  </div>
}

export default function AppointmentWorkspace() {
  const [open, setOpen] = useState(false)
  const [stage, setStage] = useState<Stage>('prepare')
  const [brief, setBrief] = useState<GuidedBrief | null>(null)
  const [record, setRecord] = useState<GuidedWorkspace | null>(null)
  const [appointmentId, setAppointmentId] = useState('')
  const [outcome, setOutcome] = useState<GuidedOutcome | null>(null)
  const [quickCapture, setQuickCapture] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveMessage, setSaveMessage] = useState('')
  const [showDetailed, setShowDetailed] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setSaveError('')
    void (async () => {
      try {
        await ensureAnonymousSession()
        const [briefResult, workspaceResult] = await Promise.allSettled([
          getJSON('/appointment-workspaces/preparation-brief?window_days=90') as Promise<GuidedBrief>,
          getJSON('/appointment-workspaces') as Promise<{ items?: GuidedWorkspace[] }>,
        ])
        if (cancelled) return
        if (briefResult.status === 'fulfilled') {
          setBrief(briefResult.value)
          const nextAppointment = briefResult.value.appointments.find(item => item.status === 'scheduled')
          if (nextAppointment) setAppointmentId(nextAppointment.source_id)
        }
        else setSaveError('Your appointment brief could not be loaded. Existing care information has not been changed.')
        if (workspaceResult.status === 'fulfilled') {
          const latest = workspaceResult.value.items?.[0] || null
          setRecord(latest)
          if (latest) {
            const savedNote = String(latest.payload?.caregiverReport || '')
            setQuickCapture(savedNote)
            setAppointmentId(latest.appointment_id || '')
            try {
              const draft = await getJSON('/appointment-workspaces/' + encodeURIComponent(latest.id) + '/outcome-draft') as GuidedOutcome
              if (!cancelled) setOutcome(draft)
            } catch {
              if (!cancelled) setOutcome(null)
            }
          }
        } else {
          setSaveError('Saved appointment notes could not be loaded. Your care history has not been changed.')
        }
      } catch (error) {
        if (!cancelled) setSaveError(error instanceof Error ? error.message : 'The appointment workspace could not be opened.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [open])

  const refreshOutcome = async () => {
    if (!record) return
    try {
      const draft = await getJSON('/appointment-workspaces/' + encodeURIComponent(record.id) + '/outcome-draft') as GuidedOutcome
      setOutcome(draft)
      setSaveError('')
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'The appointment outcome could not be refreshed.')
    }
  }

  const saveCapture = async () => {
    if (!quickCapture.trim()) {
      setSaveMessage('Nothing to save. You can continue without adding notes.')
      if (stage === 'after') await refreshOutcome()
      return
    }
    setSaving(true)
    setSaveError('')
    setSaveMessage('')
    try {
      await ensureAnonymousSession()
      const payload = {
        ...(record?.payload || {}),
        caregiverReport: quickCapture.trim(),
        captureStage: stage,
        caregiverReportAt: new Date().toISOString(),
      }
      const nextStatus = record
        ? (record.status === 'preparation' && stage === 'after' ? 'outcome_pending'
          : record.status === 'preparation' && stage === 'during' ? 'during_visit'
          : record.status === 'during_visit' && stage === 'after' ? 'outcome_pending'
          : record.status)
        : guidedStageStatus[stage]
      let saved: GuidedWorkspace
      if (record) {
        saved = await patchJSON('/appointment-workspaces/' + encodeURIComponent(record.id), {
          expected_version: record.version_number,
          appointment_id: appointmentId || undefined,
          status: nextStatus,
          payload,
          change_reason: 'Caregiver saved an optional appointment note',
          idempotency_key: 'guided-appointment:' + record.id + ':' + (record.version_number + 1) + ':' + stage,
        }) as GuidedWorkspace
      } else {
        saved = await postJSON('/appointment-workspaces', {
          status: nextStatus,
          payload,
          change_reason: 'Caregiver saved an optional appointment note',
          idempotency_key: 'guided-appointment:' + crypto.randomUUID(),
        }) as GuidedWorkspace
      }
      setRecord(saved)
      setSaveMessage('Your note is saved. It remains a caregiver report.')
      if (stage === 'after') {
        const draft = await getJSON('/appointment-workspaces/' + encodeURIComponent(saved.id) + '/outcome-draft') as GuidedOutcome
        setOutcome(draft)
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Your note could not be saved. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return <section className="appointment-workspace guided-appointment" aria-labelledby="appointment-workspace-title">
    <div className="appointment-heading">
      <div className="appointment-heading-icon" aria-hidden="true"><CalendarDays size={21} /></div>
      <div className="appointment-heading-copy">
        <span className="appointment-kicker">APPOINTMENTS</span>
        <h3 id="appointment-workspace-title">Your appointment, supported by SolenOS</h3>
        <p>SolenOS prepares and organises the information. You only add what it cannot know.</p>
      </div>
      <button type="button" className="appointment-primary" onClick={() => setOpen(value => !value)} aria-expanded={open}>{open ? 'Close' : 'Open appointment support'}</button>
    </div>
    {open && <>
      <div className="appointment-boundary"><ShieldCheck size={17} aria-hidden="true" /><span>You are not expected to complete forms before, during or after a visit. Notes are optional. Caregiver notes remain caregiver reports, and nothing here silently changes the Living Care Record.</span></div>
      <nav className="guided-stages" aria-label="Appointment stages">
        {([['prepare','Before'],['during','During'],['after','After']] as const).map(([key,label]) => <button key={key} type="button" className={stage === key ? 'is-active' : ''} aria-pressed={stage === key} onClick={() => setStage(key)}>{label}</button>)}
      </nav>
      {loading && <p className="guided-muted" role="status">Preparing your appointment view…</p>}
      <GuidedStageContent stage={stage} brief={brief} outcome={outcome} quickCapture={quickCapture} setQuickCapture={setQuickCapture} saving={saving} onSave={() => void saveCapture()} onRefreshOutcome={() => void refreshOutcome()} />
      <div className="guided-status" role="status" aria-live="polite">{saveMessage}{saveError && <span>{saveError}</span>}</div>
      <button className="guided-details-toggle" type="button" aria-expanded={showDetailed} onClick={() => setShowDetailed(value => !value)}>{showDetailed ? 'Close detailed review and follow-up controls' : 'Open detailed review and follow-up controls'}</button>
      {showDetailed && <div className="guided-detailed"><p>For caregivers who need to correct individual sections, review evidence or manage follow-up responsibilities. This is optional.</p><DetailedAppointmentWorkspace /></div>}
    </>}
    <style jsx>{`
      .guided-appointment { color:#26392c; }
      .guided-stages { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; margin:18px 0 0; }
      .guided-stages button { min-height:44px; border:1px solid #dfe8df; border-radius:11px; background:#fff; color:#536653; font:inherit; font-size:13px; font-weight:750; cursor:pointer; }
      .guided-stages button.is-active { border-color:#a7c3a4; background:#edf5eb; color:#294b31; }
      .guided-panel { margin-top:16px; padding:16px; border:1px solid #e2eae0; border-radius:14px; background:#fbfcfa; }
      .guided-panel-heading { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; }
      .guided-panel h4 { margin:0; color:#26392c; font-size:17px; }
      .guided-panel-heading p,.guided-muted { margin:5px 0 0; color:#68776b; font-size:12px; line-height:1.6; }
      .guided-state { padding:5px 8px; border:1px solid #dce7d9; border-radius:99px; color:#526b54; font-size:10px; white-space:nowrap; }
      .guided-columns { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; margin-top:15px; }
      .guided-columns section,.guided-appointments { min-width:0; padding:12px; border:1px solid #e5ebe2; border-radius:11px; background:#fff; }
      .guided-panel h5 { margin:0 0 9px; color:#3b5140; font-size:12px; }
      .guided-columns ul,.guided-appointments ul { margin:0; padding-left:17px; }
      .guided-columns li { margin:0 0 11px; color:#425447; font-size:12px; line-height:1.5; overflow-wrap:anywhere; }
      .guided-columns li p { margin:3px 0; }
      .guided-columns li small,.guided-appointments li span { display:block; color:#7a867c; font-size:10px; }
      .guided-appointments { margin-top:12px; }
      .guided-appointments li { display:flex; justify-content:space-between; gap:10px; margin:7px 0; font-size:12px; }
      .guided-footnote { margin:12px 0 0; color:#7b877d; font-size:10px; line-height:1.55; }
      .guided-capture-label { display:flex; flex-direction:column; gap:7px; margin-top:14px; color:#405343; font-size:12px; font-weight:750; }
      .guided-capture-label textarea { width:100%; box-sizing:border-box; min-height:100px; padding:12px; border:1px solid #dce6da; border-radius:10px; background:#fff; color:#26392c; font:inherit; font-size:14px; line-height:1.55; resize:vertical; }
      .guided-actions { display:flex; flex-wrap:wrap; gap:8px; margin-top:12px; }
      .guided-primary,.guided-secondary { min-height:42px; padding:10px 14px; border:1px solid #cbdcc9; border-radius:11px; background:#e7f0e5; color:#203b27; font:inherit; font-size:12px; font-weight:750; cursor:pointer; }
      .guided-secondary { background:#fff; }
      .guided-primary:disabled { opacity:.6; cursor:not-allowed; }
      .guided-outcome { margin-top:16px; padding:14px; border:1px solid #dfe8df; border-radius:12px; background:#fff; }
      .guided-outcome h5 { margin:0 0 12px; }
      .guided-outcome section { padding:10px 0; border-top:1px solid #edf1eb; }
      .guided-outcome h6 { margin:0 0 5px; color:#526653; font-size:11px; text-transform:capitalize; }
      .guided-outcome p { margin:0; color:#34493a; font-size:12px; line-height:1.55; white-space:pre-wrap; }
      .guided-outcome small { display:block; margin-top:4px; color:#7a867c; font-size:10px; }
      .guided-status { margin-top:10px; color:#59705c; font-size:11px; }
      .guided-status span { display:block; color:#9a5c43; margin-top:4px; }
      .guided-details-toggle { margin-top:16px; padding:9px 0; border:0; background:transparent; color:#46654b; font:inherit; font-size:12px; font-weight:750; text-decoration:underline; cursor:pointer; }
      .guided-detailed { margin-top:12px; padding-top:12px; border-top:1px solid #e5ebe2; }
      .guided-detailed > p { color:#718073; font-size:11px; line-height:1.5; }
      @media(max-width:640px) { .guided-columns { grid-template-columns:minmax(0,1fr); } .guided-appointments li { display:block; } .guided-actions button,.guided-primary { width:100%; } .guided-panel { padding:13px; } }
    `}</style>
  </section>
}
