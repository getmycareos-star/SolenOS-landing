import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { ensureAnonymousSession, getJSON, postJSON } from '../api/client'

type EvidenceItem = {
  id: string
  type: string
  evidence_kind?: string | null
  epistemic_status?: string | null
  source_text: string
  uploaded_at: string
  uploaded_by_caregiver_id?: string | null
  original_author?: string | null
  reported_by_label?: string | null
  reported_by_caregiver_id?: string | null
  collected_by_caregiver_id?: string | null
  collected_at?: string | null
  occurred_at?: string | null
  occurred_at_timezone?: string | null
  origin_channel?: string | null
  original_source_reference?: string | null
  parent_evidence_id?: string | null
  source_text_sha256?: string | null
  ingested_at?: string | null
  reported_at?: string | null
  collection_method?: string | null
  origin_device_ref?: string | null
  transfer_source?: string | null
  transfer_reference?: string | null
}
type ReviewType = 'quality' | 'reliability' | 'source_confidence' | 'freshness' | 'completeness'
type SourceIntegrity = {
  evidence_id: string
  person_id: string
  source_text_integrity_status: 'match' | 'mismatch' | 'unavailable'
  stored_source_text_sha256: string | null
  recomputed_source_text_sha256: string | null
  hash_scope: string
  original_binary_status: 'not_applicable' | 'missing' | 'match' | 'mismatch'
  original_binary_available: boolean | null
  original_binary_stored_sha256: string | null
  original_binary_recomputed_sha256: string | null
  binary_hash_scope: string
  exact_source_text_duplicate_candidate_ids: string[]
  exact_binary_duplicate_candidate_ids: string[]
  duplicate_candidate_status: string
  near_duplicate_comparison_status: string
  near_duplicate_algorithm_version: string
  near_duplicate_candidate_groups: Array<{ evidence_ids: string[]; candidate_basis: string; interpretation: string }>
  near_duplicate_interpretation_limit: string
  freshness_status: string
  freshness_assessment_id: string | null
  completeness_status: string
  completeness_assessment_id: string | null
  external_source_reference: string | null
  external_source_reference_access_status: 'not_checked' | 'not_provided'
  original_file_authenticity_verified: false
}
type Observation = {
  id: string
  evidence_id: string
  supersedes_observation_id?: string | null
  correction_rationale?: string | null
  observation_kind: string
  epistemic_status: string
  subject_label: string
  attribute: string
  value_text?: string | null
  units?: string | null
  source_passage: string
  source_span_start: number
  source_span_end: number
  negated?: boolean | null
  hedge_marker?: string | null
  ambiguity_note?: string | null
  observer_label?: string | null
  observation_method?: string | null
  recorded_at: string
}
type SourceRelationship = {
  id: string
  source_evidence_id: string
  related_evidence_id: string
  relationship_type: string
  source_independence_status: string
  origin_group_key?: string | null
  rationale: string
  reviewed_by_caregiver_id?: string | null
  created_at: string
}
type FreshnessPolicy = { id: string; person_id: string; domain_key: string; policy_version: string; max_age_days: number | null; historical_after_days: number | null; rationale: string; created_at: string | null }
type FreshnessAssessment = { id: string; evidence_id: string; policy_id: string; policy_version: string; freshness_status: string; source_time: string | null; source_time_kind?: string | null; assessed_at: string; age_days: number | null; rationale: string }
type Review = {
  id: string
  evidence_id: string
  review_type: ReviewType
  outcome: string
  rationale: string
  criteria: Array<{ criterion: string; result: string; rationale: string }>
  policy_version: string
  source_attribution: Record<string, unknown>
  reviewed_by_caregiver_id?: string | null
  created_at: string
}

const outcomes: Record<ReviewType, string[]> = {
  quality: ['adequate', 'limited', 'insufficient', 'undetermined'],
  reliability: ['supported', 'contested', 'unverified', 'undetermined'],
  source_confidence: ['verified', 'partially_verified', 'unverified', 'unknown'],
  freshness: ['current', 'stale', 'historical', 'undetermined'],
  completeness: ['complete', 'partial', 'missing', 'undetermined'],
}
const labels: Record<ReviewType, string> = {
  quality: 'Information quality',
  reliability: 'How reliable the source is',
  source_confidence: 'Who provided the information',
  freshness: 'How recent it is',
  completeness: 'How complete it is',
}
const reviewStatusLabel = (value: string) => ({
  not_assessed: 'Not checked',
  undetermined: 'Not sure',
  unknown: 'Not yet known',
  unverified: 'Not confirmed',
  verified: 'Checked',
  partially_verified: 'Partly checked',
  independent_source_linked: 'A separate report is linked',
  copied_or_same_origin: 'Copied from the same original source',
  none_linked: 'No other report is linked',
  stale: 'May be out of date',
  historical: 'Older information',
  current: 'Still current',
  partial: 'Some details are missing',
  partial_revision_history: 'Only part of the saved history is available',
  missing: 'Missing',
  conflicting: 'Reports disagree',
  specified: 'Recorded',
  adequate: 'Enough detail',
  limited: 'Limited detail',
  insufficient: 'Not enough detail',
  supported: 'Matches the saved source',
  contested: 'Other information disagrees',
  complete: 'Complete',
  caregiver_reported: 'Reported by a caregiver',
  inferred: 'Possible interpretation',
  contradictory: 'Reports disagree',
  occurred_at: 'When it happened',
  observed_at: 'When it was observed',
  reported_at: 'When it was reported',
  collected_at: 'When it was collected',
  recorded_at: 'When it was saved',
  ingested_at: 'When it was added to SolenOS',
  effective_at: 'When it took effect',
}[value] ?? value.replaceAll('_', ' '))
function historicalSnapshotSections(value: Record<string, unknown> | null): Array<{ label: string; count: number }> {
  const state = value?.state;
  if (!state || typeof state !== 'object') return [];
  const tables = (state as Record<string, unknown>).tables;
  if (!tables || typeof tables !== 'object') return [];
  const labels: Record<string, string> = {
    care_facts: 'Saved care information',
    care_assertions: 'Caregiver reports',
    care_events: 'Daily care and other events',
    evidence: 'Documents and other sources',
    changes: 'Recorded changes',
    situations: 'Care situations',
    care_state_revisions: 'Earlier saved changes',
    care_delta_runs: 'Change reviews',
    care_delta_items: 'Change details',
    care_decisions: 'Care decisions',
    decision_outcomes: 'Decision results',
    care_timeline_entries: 'Care history entries',
    care_follow_up_links: 'Follow-ups',
    care_review_decisions: 'Review decisions',
    care_provenance_records: 'Source details',
    care_uncertainties: 'Items needing clarification',
    care_missing_information: 'Missing information',
    care_conflicts: 'Reports that do not match',
    care_action_outcomes: 'Follow-up results',
    record_provenance: 'Source records',
    record_provenance_links: 'Links to sources',
    care_record_change_sets: 'Saved record changes',
    care_record_change_items: 'Details of record changes',
    care_corrections: 'Corrections',
    record_amendments: 'Record updates',
    record_amendment_items: 'Updated details',
    care_record_audit_log: 'Record activity',
    care_record_identifiers: 'Record identifiers',
    care_record_sections: 'Saved record sections',
    care_record_links: 'Linked care records',
    care_record_status_history: 'Record status history',
    care_fact_revisions: 'Care information history',
    care_assertion_revisions: 'Report history',
    care_decision_revisions: 'Decision history',
    care_event_revisions: 'Event history',
    care_observation_revisions: 'Observation history',
    care_change_revisions: 'Change history',
    care_situation_revisions: 'Care situation history',
    care_evidence_revisions: 'Source history',
    care_record_retractions: 'Removed record items',
    care_record_restorations: 'Restored record items',
    caregiver_contexts: 'Caregiver context',
    caregiver_perspectives: 'Caregiver perspectives',
    caregiver_observations: 'Caregiver observations',
  };
  return Object.entries(tables as Record<string, unknown>)
    .filter((entry): entry is [string, unknown[]] => Array.isArray(entry[1]) && entry[1].length > 0)
    .map(([key, rows]) => ({ label: labels[key] ?? 'Other saved information', count: rows.length }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

const reviewCriterionLabel = (value: string) => ({
  'source attribution': 'Who provided it',
  'independent corroboration': 'Whether there are separate reports',
  'temporal context': 'When it happened',
  'evidence freshness': 'Whether it is still current',
  'record completeness': 'Whether details are missing',
}[value] ?? value.replaceAll('_', ' '))
const panel: CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, padding: 14, marginTop: 12, background: 'var(--surface)' }
const field: CSSProperties = { boxSizing: 'border-box', width: '100%', padding: '9px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }
const button: CSSProperties = { border: '1px solid var(--border)', borderRadius: 7, padding: '8px 11px', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer' }

export default function EvidenceReviewPanel(props?: { personId?: string; evidenceItems?: EvidenceItem[] }) {
  const expectedPersonId = props?.personId?.trim() || ''
  const [personId, setPersonId] = useState('')
  const [evidenceItems, setEvidenceItems] = useState<EvidenceItem[]>([])
  const [evidenceLoading, setEvidenceLoading] = useState(true)
  const [evidenceError, setEvidenceError] = useState('')
  const [sourceIntegrity, setSourceIntegrity] = useState<SourceIntegrity | null>(null)
  const [sourceIntegrityError, setSourceIntegrityError] = useState('')
  const [sourceIntegrityLoading, setSourceIntegrityLoading] = useState(false)
  const [historyAsOf, setHistoryAsOf] = useState('')
  const [reconstructedHistory, setReconstructedHistory] = useState<Record<string, unknown> | null>(null)
  const [historyReconstructionLoading, setHistoryReconstructionLoading] = useState(false)
  const [historyReconstructionError, setHistoryReconstructionError] = useState('')
  const [recordHistoryAsOf, setRecordHistoryAsOf] = useState('')
  const [recordHistory, setRecordHistory] = useState<Record<string, unknown> | null>(null)
  const [recordHistoryLoading, setRecordHistoryLoading] = useState(false)
  const [recordHistoryError, setRecordHistoryError] = useState('')
  const [recordSnapshotSaving, setRecordSnapshotSaving] = useState(false)
  const [recordSnapshotNotice, setRecordSnapshotNotice] = useState('')
  const [relationships, setRelationships] = useState<SourceRelationship[]>([])
  const [relationshipsLoading, setRelationshipsLoading] = useState(false)
  const [relationshipsError, setRelationshipsError] = useState('')
  const [observations, setObservations] = useState<Observation[]>([])
  const [observationsLoading, setObservationsLoading] = useState(false)
  const [observationsError, setObservationsError] = useState('')

  const loadEvidence = useCallback(async () => {
    setEvidenceLoading(true)
    setEvidenceError('')
    try {
      const session = await ensureAnonymousSession()
      if (!session.person?.id) throw new Error('Missing scoped person identity')
      if (expectedPersonId && expectedPersonId !== session.person.id) {
        throw new Error('The requested LCR person does not match the authenticated session')
      }
      const result = await getJSON('/care-continuity/evidence?limit=100')
      if (!Array.isArray(result) || result.some((item) => item?.person_id !== session.person.id || typeof item?.id !== 'string' || typeof item?.source_text !== 'string')) {
        throw new Error('Evidence response is not valid for this care record')
      }
      setPersonId(session.person.id)
      setEvidenceItems(result as EvidenceItem[])
    } catch {
      setPersonId('')
      setEvidenceItems([])
      setEvidenceError('Evidence records could not be loaded from the care record. No evidence list is assumed; retry when the connection is available.')
    } finally {
      setEvidenceLoading(false)
    }
  }, [expectedPersonId])

  useEffect(() => { void loadEvidence() }, [loadEvidence])
  const [selectedId, setSelectedId] = useState('')
  const [reviewType, setReviewType] = useState<ReviewType>('reliability')
  const [outcome, setOutcome] = useState('unverified')
  const [rationale, setRationale] = useState('')
  const [sourceResult, setSourceResult] = useState('not_assessed')
  const [corroborationResult, setCorroborationResult] = useState('not_assessed')
  const [temporalResult, setTemporalResult] = useState('not_assessed')
  const [freshnessResult, setFreshnessResult] = useState('not_assessed')
  const [completenessResult, setCompletenessResult] = useState('not_assessed')
  const [reviews, setReviews] = useState<Review[]>([])
  const [historyUnavailable, setHistoryUnavailable] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [freshnessPolicies, setFreshnessPolicies] = useState<FreshnessPolicy[]>([])
  const [freshnessPolicyId, setFreshnessPolicyId] = useState('')
  const [freshnessPolicyLoading, setFreshnessPolicyLoading] = useState(false)
  const [freshnessPolicySaving, setFreshnessPolicySaving] = useState(false)
  const [freshnessPolicyError, setFreshnessPolicyError] = useState('')
  const [freshnessPolicyNotice, setFreshnessPolicyNotice] = useState('')
  const [freshnessAssessments, setFreshnessAssessments] = useState<FreshnessAssessment[]>([])
  const [freshnessHistoryLoading, setFreshnessHistoryLoading] = useState(false)
  const [freshnessHistoryError, setFreshnessHistoryError] = useState('')
  const selected = useMemo(() => evidenceItems.find(item => item.id === selectedId), [evidenceItems, selectedId])

  const loadFreshnessPolicies = useCallback(async () => {
    if (!personId) { setFreshnessPolicies([]); return }
    setFreshnessPolicyLoading(true)
    setFreshnessPolicyError('')
    try {
      const result = await getJSON('/care-continuity/evidence-freshness/policies') as { items?: FreshnessPolicy[] }
      if (!Array.isArray(result?.items) || result.items.some(item => item.person_id !== personId || typeof item.id !== 'string')) {
        throw new Error('Invalid review rule response')
      }
      setFreshnessPolicies(result.items)
      if (freshnessPolicyId && !result.items.some(item => item.id === freshnessPolicyId)) setFreshnessPolicyId('')
    } catch {
      setFreshnessPolicies([])
      setFreshnessPolicyError('Review rules for how recent this information should be could not be loaded. Try again when connected.')
    } finally {
      setFreshnessPolicyLoading(false)
    }
  }, [personId, freshnessPolicyId])

  useEffect(() => { void loadFreshnessPolicies() }, [loadFreshnessPolicies])

  const assessSelectedFreshness = useCallback(async () => {
    if (!selectedId || !freshnessPolicyId) {
      setFreshnessPolicyError('Choose a source and a saved review rule before checking how recent it is.')
      return
    }
    setFreshnessPolicySaving(true)
    setFreshnessPolicyError('')
    setFreshnessPolicyNotice('')
    try {
      const saved = await postJSON('/care-continuity/evidence-freshness/assessments', {
        evidence_id: selectedId,
        policy_id: freshnessPolicyId,
      }) as FreshnessAssessment & { person_id?: string }
      if (!saved?.id || saved.evidence_id !== selectedId || saved.person_id !== personId || saved.policy_id !== freshnessPolicyId) {
        throw new Error('The review result did not match the selected source and review rule.')
      }
      setFreshnessPolicyNotice('Review saved: ' + reviewStatusLabel(saved.freshness_status) + '. This does not prove the information is true.')
      const history = await getJSON('/care-continuity/evidence-freshness/assessments/' + encodeURIComponent(selectedId)) as { items?: FreshnessAssessment[] }
      if (!Array.isArray(history?.items)) throw new Error('The review was saved, but its history could not be checked. Try loading past reviews again.')
      setFreshnessAssessments(history.items)
      setFreshnessHistoryError('')
    } catch (cause) {
      setFreshnessPolicyError(cause instanceof Error ? cause.message : 'The review could not be confirmed as saved.')
    } finally {
      setFreshnessPolicySaving(false)
    }
  }, [selectedId, freshnessPolicyId, personId])

  const loadFreshnessHistory = useCallback(async () => {
    if (!selectedId || !personId) { setFreshnessAssessments([]); return }
    setFreshnessHistoryLoading(true)
    setFreshnessHistoryError('')
    try {
      const result = await getJSON('/care-continuity/evidence-freshness/assessments/' + encodeURIComponent(selectedId)) as { items?: FreshnessAssessment[] }
      if (!Array.isArray(result?.items)) throw new Error('Invalid review of how recent this information is history')
      setFreshnessAssessments(result.items)
    } catch {
      setFreshnessAssessments([])
      setFreshnessHistoryError('Past reviews are unavailable. This does not mean there are no past reviews.')
    } finally {
      setFreshnessHistoryLoading(false)
    }
  }, [selectedId, personId])

  useEffect(() => { void loadFreshnessHistory() }, [loadFreshnessHistory])

  useEffect(() => {
    setReconstructedHistory(null)
    setHistoryReconstructionError('')
    setHistoryAsOf('')
  }, [selectedId])

  useEffect(() => {
    if (!selectedId && evidenceItems.length) setSelectedId(evidenceItems[0].id)
    if (selectedId && !evidenceItems.some(item => item.id === selectedId)) setSelectedId(evidenceItems[0]?.id || '')
  }, [evidenceItems, selectedId])



  const saveCurrentRecordSnapshot = useCallback(async () => {
    setRecordSnapshotSaving(true)
    setRecordSnapshotNotice('')
    setRecordHistoryError('')
    try {
      if (!personId) throw new Error('The current care record could not be identified')
      let records = await getJSON('/care-continuity/living-records?limit=2')
      if (!Array.isArray(records)) throw new Error('The saved care record list could not be read')
      if (records.length === 0) {
        const created = await postJSON('/care-continuity/living-records', {
          record_status: 'active',
          schema_version: 'lcr.v1',
        })
        if (!created || typeof created !== 'object' || (created as Record<string, unknown>).person_id !== personId) {
          throw new Error('The care record could not be created for this session')
        }
        records = [created]
      }
      if (records.length !== 1 || typeof records[0]?.id !== 'string') {
        throw new Error('The care record could not be identified safely')
      }
      const saved = await postJSON('/care-continuity/record-versions', {
        care_record_id: records[0].id,
        reason: 'Caregiver saved a point-in-time copy from the care history screen',
      })
      if (!saved || typeof saved !== 'object' || typeof (saved as Record<string, unknown>).captured_at !== 'string') {
        throw new Error('The saved copy could not be confirmed')
      }
      const capturedAt = new Date(String((saved as Record<string, unknown>).captured_at))
      if (!Number.isFinite(capturedAt.getTime())) throw new Error('The saved copy returned an invalid date')
      const localValue = new Date(capturedAt.getTime() - capturedAt.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
      setRecordHistoryAsOf(localValue)
      setRecordSnapshotNotice('A copy of the care record was saved. Choose “Show earlier record” to review it.')
    } catch (error) {
      setRecordHistoryError(error instanceof Error ? error.message : 'The care record copy could not be saved. Try again.')
    } finally {
      setRecordSnapshotSaving(false)
    }
  }, [personId])

  const reconstructRecordHistory = useCallback(async () => {
    if (!personId || !recordHistoryAsOf) {
      setRecordHistoryError('Choose a date and time before viewing the earlier care record.')
      return
    }
    setRecordHistoryLoading(true)
    setRecordHistoryError('')
    setRecordHistory(null)
    try {
      const asOf = new Date(recordHistoryAsOf)
      if (!Number.isFinite(asOf.getTime())) throw new Error('Invalid historical instant')
      const result = await getJSON(
        `/care-continuity/record-snapshots/as-of?as_of=${encodeURIComponent(asOf.toISOString())}`
      )
      if (!result || typeof result !== 'object' || (result as Record<string, unknown>).person_id !== personId ||
          (result as Record<string, unknown>).coverage_status !== 'saved_snapshot_only' ||
          (result as Record<string, unknown>).integrity_status !== 'verified' ||
          historicalSnapshotSections(result as Record<string, unknown>).length === 0) {
        throw new Error('No verified saved record copy is available for this date')
      }
      setRecordHistory(result as Record<string, unknown>)
    } catch {
      setRecordHistoryError('No verified saved copy of the full care record is available for that date. This does not mean the record was empty.')
    } finally {
      setRecordHistoryLoading(false)
    }
  }, [personId, recordHistoryAsOf])

  const loadReviews = useCallback(async () => {
    if (!selectedId || !personId) { setReviews([]); return }
    setLoading(true)
    setError('')
    setHistoryUnavailable(false)
    try {
      const result = await getJSON(`/care-continuity/evidence/${encodeURIComponent(selectedId)}/reviews`)
      if (!Array.isArray(result)) throw new Error('Invalid review response')
      setReviews(result as Review[])
    } catch {
      setReviews([])
      setHistoryUnavailable(true)
      setError('Saved evidence reviews could not be loaded. Check the connection and retry; no review history is assumed.')
    } finally {
      setLoading(false)
    }
  }, [personId, selectedId])

  useEffect(() => { void loadReviews() }, [loadReviews])

  const loadSourceIntegrity = useCallback(async () => {
    if (!selectedId || !personId) {
      setSourceIntegrity(null)
      setSourceIntegrityError('')
      return
    }
    setSourceIntegrityLoading(true)
    setSourceIntegrity(null)
    setSourceIntegrityError('')
    try {
      const result = await getJSON(`/care-continuity/evidence/${encodeURIComponent(selectedId)}/integrity`)
      if (!result || result.evidence_id !== selectedId || result.person_id !== personId ||
          !['match', 'mismatch', 'unavailable'].includes(result.source_text_integrity_status) ||
          !['not_applicable', 'missing', 'match', 'mismatch'].includes(result.original_binary_status) ||
          !Array.isArray(result.exact_source_text_duplicate_candidate_ids) ||
          !Array.isArray(result.exact_binary_duplicate_candidate_ids) ||
          !Array.isArray(result.near_duplicate_candidate_groups) ||
          typeof result.near_duplicate_comparison_status !== 'string' ||
          typeof result.near_duplicate_interpretation_limit !== 'string' ||
          !['not_checked', 'not_provided'].includes(result.external_source_reference_access_status) ||
          typeof result.freshness_status !== 'string' ||
          typeof result.completeness_status !== 'string' ||
          typeof result.hash_scope !== 'string' || result.original_file_authenticity_verified !== false) {
        throw new Error('Invalid source-integrity response')
      }
      setSourceIntegrity(result as SourceIntegrity)
    } catch {
      setSourceIntegrity(null)
      setSourceIntegrityError('Source-text integrity could not be checked. This is not evidence of a match; retry when connected.')
    } finally {
      setSourceIntegrityLoading(false)
    }
  }, [personId, selectedId])

  useEffect(() => { void loadSourceIntegrity() }, [loadSourceIntegrity])

  const reconstructHistoricalState = useCallback(async () => {
    if (!selectedId || !personId || !historyAsOf) {
      setHistoryReconstructionError('Choose a date and time before viewing the earlier source information.')
      return
    }
    setHistoryReconstructionLoading(true)
    setHistoryReconstructionError('')
    setReconstructedHistory(null)
    try {
      const asOf = new Date(historyAsOf)
      if (Number.isNaN(asOf.getTime())) throw new Error('The selected date and time is invalid.')
      const result = await getJSON(
        `/care-continuity/state-revisions/evidence/${encodeURIComponent(selectedId)}/as-of?as_of=${encodeURIComponent(asOf.toISOString())}`
      )
      if (!result || result.person_id !== personId || result.target_type !== 'evidence' ||
          result.target_id !== selectedId || result.historical_state_source !== 'persisted_care_state_revision' ||
          typeof result.interpretation_limit !== 'string') {
        throw new Error('The earlier information did not match the selected source and care record.')
      }
      setReconstructedHistory(result as Record<string, unknown>)
    } catch {
      setHistoryReconstructionError('An earlier saved version could not be shown for that time. This does not establish that the evidence did not exist. A missing historical revision is not proof that the source was absent; try again or choose another date.')
    } finally {
      setHistoryReconstructionLoading(false)
    }
  }, [historyAsOf, personId, selectedId])

  const loadRelationships = useCallback(async () => {
    if (!selectedId || !personId) {
      setRelationships([])
      setRelationshipsError('')
      return
    }
    setRelationshipsLoading(true)
    setRelationshipsError('')
    try {
      const result = await getJSON(`/care-continuity/evidence/${encodeURIComponent(selectedId)}/relationships`)
      if (!Array.isArray(result) || result.some((item) =>
        item?.person_id !== personId || typeof item?.id !== 'string' ||
        ![selectedId].includes(item?.source_evidence_id) && ![selectedId].includes(item?.related_evidence_id))) {
        throw new Error('Invalid evidence relationship response')
      }
      setRelationships(result as SourceRelationship[])
    } catch {
      setRelationships([])
      setRelationshipsError('Links to other sources could not be loaded. No list is assumed; try again when connected.')
    } finally {
      setRelationshipsLoading(false)
    }
  }, [personId, selectedId])

  useEffect(() => { void loadRelationships() }, [loadRelationships])

  const loadObservations = useCallback(async () => {
    if (!selectedId || !personId) {
      setObservations([])
      setObservationsError('')
      return
    }
    setObservationsLoading(true)
    setObservationsError('')
    try {
      const result = await getJSON(`/care-continuity/evidence/${encodeURIComponent(selectedId)}/observations`)
      if (!Array.isArray(result) || result.some(item =>
        item?.person_id !== personId || item?.evidence_id !== selectedId ||
        typeof item?.source_passage !== 'string' || typeof item?.source_span_start !== 'number' ||
        typeof item?.source_span_end !== 'number')) throw new Error('Invalid observation response')
      setObservations(result as Observation[])
    } catch {
      setObservations([])
      setObservationsError('Recorded details could not be loaded. No observation list is assumed; retry when connected.')
    } finally {
      setObservationsLoading(false)
    }
  }, [personId, selectedId])

  useEffect(() => { void loadObservations() }, [loadObservations])

  function changeReviewType(next: ReviewType) {
    setReviewType(next)
    setOutcome(outcomes[next][0])
  }

  async function submit() {
    if (!selected || !rationale.trim()) {
      setError('Select evidence and provide a review rationale before saving.')
      return
    }
    setSaving(true)
    setError('')
    setNotice('')
    try {
      await postJSON(`/care-continuity/evidence/${encodeURIComponent(selected.id)}/reviews`, {
        review_type: reviewType,
        outcome,
        rationale: rationale.trim(),
        policy_version: 'evidence-review-v1',
        criteria: [
          { criterion: 'source attribution', result: sourceResult, rationale: 'Check who provided the original information.' },
          { criterion: 'independent corroboration', result: corroborationResult, rationale: 'Check whether another report was made separately.' },
          { criterion: 'temporal context', result: temporalResult, rationale: 'Check whether the dates and times are clear.' },
          { criterion: 'evidence freshness', result: freshnessResult, rationale: 'Check whether the information still applies.' },
          { criterion: 'record completeness', result: completenessResult, rationale: 'Check whether important details are missing.' },
        ],
      })
      setRationale('')
      setNotice('Review saved. The original source is unchanged, and this review does not confirm a medical fact.')
      await loadReviews()
    } catch {
      setError('The review was not confirmed as saved. Check the connection and retry; the source evidence remains unchanged.')
    } finally {
      setSaving(false)
    }
  }

  if (!personId && !evidenceLoading && !evidenceError) return null
  return <section style={panel} aria-label="Saved source reviews">
    <h3 style={{ fontSize: 15, marginTop: 0 }}>Sources and supporting information</h3>
    {evidenceError && <p role="alert" style={{ color: 'var(--error)', fontSize: 12 }}>{evidenceError} <button type="button" style={button} onClick={() => void loadEvidence()} disabled={evidenceLoading}>Retry evidence load</button></p>}
    {evidenceLoading && <p role="status" style={{ fontSize: 12 }}>Loading saved source information…</p>}
    <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Reviews are saved with the reason and date. They do not turn a caregiver report into an independently confirmed fact.</p>
    <details style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, marginBottom: 12 }}>
      <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 650 }}>Check whether information is still up to date</summary>
      <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Choose a review rule set by the caregiver. There is no single time limit for every kind of information. A review does not prove that information is true or still applies today.</p>
      {freshnessPolicyLoading && <p role="status">Loading saved review rules…</p>}
      {freshnessPolicyError && <p role="alert" style={{ color: 'var(--error)', fontSize: 12 }}>{freshnessPolicyError} <button type="button" style={button} onClick={() => void loadFreshnessPolicies()} disabled={freshnessPolicyLoading}>Retry review rules</button></p>}
      <label style={{ display: 'block', fontSize: 12, marginTop: 10 }}>Choose a saved review rule
        <select style={field} value={freshnessPolicyId} onChange={event => setFreshnessPolicyId(event.target.value)}>
          <option value="">Choose a review rule</option>
          {freshnessPolicies.map(policy => <option key={policy.id} value={policy.id}>{policy.domain_key.replaceAll('_', ' ')} · {policy.max_age_days == null ? 'No time limit set' : 'Review after ' + policy.max_age_days + ' days'}</option>)}
        </select>
      </label>
      <button type="button" style={{ ...button, marginTop: 8 }} onClick={() => void assessSelectedFreshness()} disabled={!selected || !freshnessPolicyId || freshnessPolicySaving}>{freshnessPolicySaving ? 'Reviewing…' : 'Review this information'}</button>
      {freshnessPolicyNotice && <p role="status" style={{ fontSize: 12 }}>{freshnessPolicyNotice}</p>}
      <h4 style={{ fontSize: 12, marginBottom: 4 }}>Past reviews of how current this information is</h4>
      {freshnessHistoryLoading && <p role="status" style={{ fontSize: 12 }}>Loading past reviews…</p>}
      {freshnessHistoryError && <p role="alert" style={{ fontSize: 12, color: 'var(--error)' }}>{freshnessHistoryError} <button type="button" style={button} onClick={() => void loadFreshnessHistory()} disabled={freshnessHistoryLoading}>Retry history</button></p>}
      {!freshnessHistoryLoading && !freshnessHistoryError && freshnessAssessments.length === 0 && <p style={{ fontSize: 12 }}>No earlier reviews were found for this information.</p>}
      {freshnessAssessments.map(item => <article key={item.id} style={{ borderTop: '1px solid var(--border)', padding: '7px 0', fontSize: 12 }}>
        <strong>{reviewStatusLabel(item.freshness_status)}</strong>
        <div>Reviewed {new Date(item.assessed_at).toLocaleString()} · information date {item.source_time ? new Date(item.source_time).toLocaleString() + ' (' + (item.source_time_kind || 'time kind unknown').replaceAll('_', ' ') + ')' : 'unknown'} · time since it was recorded {item.age_days == null ? 'unknown' : item.age_days + ' days'}</div>
        <p>{item.rationale}</p>
      </article>)}
    </details>
    {!evidenceLoading && !evidenceError && evidenceItems.length === 0 ? <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No saved source information was found for this care record.</p> : evidenceItems.length > 0 ? <>
      <label style={{ display: 'block', fontSize: 12, marginBottom: 9 }}>Original information
        <select style={field} value={selectedId} onChange={event => setSelectedId(event.target.value)}>
          {evidenceItems.map(item => <option key={item.id} value={item.id}>{item.type.replaceAll('_', ' ')} · {item.uploaded_at ? new Date(item.uploaded_at).toLocaleDateString() : 'Date not recorded'}</option>)}
        </select>
      </label>
      {selected && <>
        <blockquote style={{ margin: '8px 0 12px', paddingLeft: 10, borderLeft: '2px solid var(--border)', fontSize: 12, overflowWrap: 'anywhere' }}>{selected.source_text}</blockquote>
        <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, margin: '8px 0 12px', fontSize: 12 }}>
          <div><dt style={{ color: 'var(--text-secondary)' }}>Type of source</dt><dd style={{ margin: 0 }}>{selected.type || 'Not recorded'}</dd></div>
          <div><dt style={{ color: 'var(--text-secondary)' }}>How it was collected</dt><dd style={{ margin: 0 }}>{reviewStatusLabel(selected.evidence_kind || 'not_assessed')}</dd></div>
          <div><dt style={{ color: 'var(--text-secondary)' }}>How sure we are about this information</dt><dd style={{ margin: 0 }}>{reviewStatusLabel(selected.epistemic_status || 'not_assessed')}</dd></div>
          <div><dt style={{ color: 'var(--text-secondary)' }}>Added by</dt><dd style={{ margin: 0, overflowWrap: 'anywhere' }}>{selected.uploaded_by_caregiver_id ? 'Caregiver' : 'Not recorded'}</dd></div>
          <div><dt style={{ color: 'var(--text-secondary)' }}>Original author</dt><dd style={{ margin: 0, overflowWrap: 'anywhere' }}>{selected.original_author || 'Not recorded'}</dd></div>
          <div><dt style={{ color: 'var(--text-secondary)' }}>Reported by</dt><dd style={{ margin: 0, overflowWrap: 'anywhere' }}>{[selected.reported_by_label, selected.reported_by_caregiver_id ? 'Caregiver' : null].filter(Boolean).join(' · ') || 'Not recorded'}</dd></div>
          <div><dt style={{ color: 'var(--text-secondary)' }}>Collected by</dt><dd style={{ margin: 0, overflowWrap: 'anywhere' }}>{selected.collected_by_caregiver_id ? 'Caregiver' : 'Not recorded'}</dd></div>
          <div><dt style={{ color: 'var(--text-secondary)' }}>When it happened</dt><dd style={{ margin: 0 }}>{selected.occurred_at ? new Date(selected.occurred_at).toLocaleString() : 'Not recorded'}{selected.occurred_at_timezone ? ` · ${selected.occurred_at_timezone}` : ''}</dd></div>
          <div><dt style={{ color: 'var(--text-secondary)' }}>When it was collected</dt><dd style={{ margin: 0 }}>{selected.collected_at ? new Date(selected.collected_at).toLocaleString() : 'Not recorded'}</dd></div>
          <div><dt style={{ color: 'var(--text-secondary)' }}>When it was reported</dt><dd style={{ margin: 0 }}>{selected.reported_at ? new Date(selected.reported_at).toLocaleString() : 'Not recorded'}</dd></div>
          <div><dt style={{ color: 'var(--text-secondary)' }}>How it was collected</dt><dd style={{ margin: 0 }}>{selected.collection_method || 'Not recorded'}</dd></div>
          <div><dt style={{ color: 'var(--text-secondary)' }}>Device used</dt><dd style={{ margin: 0, overflowWrap: 'anywhere' }}>{selected.origin_device_ref || 'Not recorded'}</dd></div>
          <div><dt style={{ color: 'var(--text-secondary)' }}>Where it came from</dt><dd style={{ margin: 0 }}>{selected.transfer_source || 'Not recorded'}</dd></div>
          <div><dt style={{ color: 'var(--text-secondary)' }}>Original reference</dt><dd style={{ margin: 0, overflowWrap: 'anywhere' }}>{selected.transfer_reference ? 'Recorded' : 'Not recorded'}</dd></div>
          <div><dt style={{ color: 'var(--text-secondary)' }}>Date added</dt><dd style={{ margin: 0 }}>{selected.uploaded_at ? new Date(selected.uploaded_at).toLocaleString() : 'Not recorded'}</dd></div>
          <div><dt style={{ color: 'var(--text-secondary)' }}>Date saved</dt><dd style={{ margin: 0 }}>{selected.ingested_at ? new Date(selected.ingested_at).toLocaleString() : 'Not recorded'}</dd></div>
          <div><dt style={{ color: 'var(--text-secondary)' }}>How it was added</dt><dd style={{ margin: 0 }}>{selected.origin_channel || 'Not recorded'}</dd></div>
          <div><dt style={{ color: 'var(--text-secondary)' }}>Original reference</dt><dd style={{ margin: 0, overflowWrap: 'anywhere' }}>{selected.original_source_reference || 'Not recorded'}</dd></div>
          <div><dt style={{ color: 'var(--text-secondary)' }}>Related original source</dt><dd style={{ margin: 0, overflowWrap: 'anywhere' }}>{selected.parent_evidence_id ? 'Another source is linked' : 'None recorded'}</dd></div>
        </dl>
        <details style={{ fontSize: 12, marginBottom: 12 }}>
          <summary>How this source is linked to other saved information ({relationships.length})</summary>
          <p>These links show how sources are connected. They do not prove that two reports are separate or that a statement is true.</p>
          {relationshipsLoading && <p role="status">Loading links to other saved information…</p>}
          {relationshipsError && <p role="alert" style={{ color: 'var(--error)' }}>{relationshipsError} <button type="button" style={button} onClick={() => void loadRelationships()} disabled={relationshipsLoading}>Retry</button></p>}
          {!relationshipsLoading && !relationshipsError && relationships.length === 0 && <p>No links to other saved sources are recorded for this item yet.</p>}
          {relationships.map(item => <article key={item.id} style={{ borderTop: '1px solid var(--border)', padding: '8px 0' }}>
            <strong>{item.relationship_type.replaceAll('_', ' ')}</strong>
            <div>This source is linked to another saved source.</div>
            <div>Were these reports separate? {reviewStatusLabel(item.source_independence_status)}</div>
            {item.source_independence_status === 'shared_origin' && (
              <p>This source and the linked source share an underlying origin. They must not be counted as independent corroboration.</p>
            )}
            {item.origin_group_key && <p>Shared source grouping is recorded.</p>}
            <p>{item.rationale}</p>
            <small>Reviewed by {item.reviewed_by_caregiver_id ? 'caregiver' : 'an unavailable identity'} · {new Date(item.created_at).toLocaleString()}</small>
          </article>)}
        </details>
        <details style={{ fontSize: 12, marginBottom: 12 }}>
          <summary>Details in this source ({observations.length})</summary>
          <p>Each detail keeps the exact words from the original source. A report stays labelled as a report; an interpretation is not shown as something someone directly saw.</p>
          {observationsLoading && <p role="status">Loading recorded details…</p>}
          {observationsError && <p role="alert" style={{ color: 'var(--error)' }}>{observationsError} <button type="button" style={button} onClick={() => void loadObservations()} disabled={observationsLoading}>Retry</button></p>}
          {!observationsLoading && !observationsError && observations.length === 0 && <p>No extracted details are available for this source yet.</p>}
          {observations.map(item => <article key={item.id} style={{ borderTop: '1px solid var(--border)', padding: '8px 0' }}>
            <strong>{item.attribute.replaceAll('_', ' ')} · {reviewStatusLabel(item.epistemic_status)}</strong>
            <div>{item.observation_kind.replaceAll('_', ' ')} · {item.subject_label}</div>
            <blockquote style={{ margin: '6px 0', paddingLeft: 9, borderLeft: '2px solid var(--border)', overflowWrap: 'anywhere' }}>{item.source_passage}</blockquote>
            <div>Value: {item.value_text ?? 'Not established'}{item.units ? ` ${item.units}` : ''}</div>
            {item.supersedes_observation_id && <div>Corrects an earlier saved detail: {item.correction_rationale || 'No correction rationale recorded'}</div>}
            {item.negated !== null && item.negated !== undefined && <div>Does the source say this did not happen? {item.negated ? 'yes' : 'no'}</div>}
            {item.hedge_marker && <div>Uncertain wording: {item.hedge_marker}</div>}
            {item.ambiguity_note && <div>What is unclear: {item.ambiguity_note}</div>}
            {item.observer_label && <div>Observer: {item.observer_label}{item.observation_method ? ` · ${item.observation_method}` : ''}</div>}
            <small>Recorded {new Date(item.recorded_at).toLocaleString()}</small>
          </article>)}
        </details>

        <details style={{ fontSize: 12, marginBottom: 12 }}>
          <summary>See what the record said earlier</summary>
          <p>Shows the latest saved copy of the care record from the date you choose. Changes made after that copy are not included.</p>
          <label style={{ display: 'block', marginTop: 8 }}>
            Date and time
            <input
              style={field}
              type="datetime-local"
              value={recordHistoryAsOf}
              onChange={event => { setRecordHistoryAsOf(event.target.value); setRecordHistory(null); setRecordHistoryError('') }}
            />
          </label>
          <p>Save a copy now to keep a dated version you can review later.</p>
          <button type="button" style={{ ...button, marginTop: 8 }} onClick={() => void saveCurrentRecordSnapshot()} disabled={recordSnapshotSaving || !personId}>
            {recordSnapshotSaving ? 'Saving a copy…' : 'Save a copy now'}
          </button>
          {recordSnapshotNotice && <p role="status">{recordSnapshotNotice}</p>}
          <button type="button" style={{ ...button, marginTop: 8 }} onClick={() => void reconstructRecordHistory()} disabled={recordHistoryLoading || !personId || !recordHistoryAsOf}>
            {recordHistoryLoading ? 'Loading earlier care information…' : 'Show earlier record'}
          </button>
          {recordHistoryError && <p role="alert" style={{ color: 'var(--error)' }}>{recordHistoryError}</p>}
          {recordHistory && <div role="status" style={{ marginTop: 8 }}>
            <p><strong>Saved copy from:</strong> {recordHistory.snapshot_as_of ? new Date(String(recordHistory.snapshot_as_of)).toLocaleString() : 'Time not recorded'}</p>
            <p><strong>Information areas with saved entries:</strong> {historicalSnapshotSections(recordHistory).length}</p>
            <ul style={{ margin: '6px 0', paddingLeft: 20 }}>
              {historicalSnapshotSections(recordHistory).map(section => <li key={section.label}>{section.label}: {section.count}</li>)}
            </ul>
            <p>This is a saved copy, not a guarantee that every care update was captured. Information added after this date is not shown.</p>
          </div>}
        </details>

        <details style={{ fontSize: 12, marginBottom: 12 }}>
          <summary>See source information from an earlier date</summary>
          <p>Choose a date and time to see the latest saved version from then. This does not prove the statement was true.</p>
          <label style={{ display: 'block', marginTop: 8 }}>Date and time
            <input style={field} type="datetime-local" value={historyAsOf} onChange={event => { setHistoryAsOf(event.target.value); setReconstructedHistory(null); setHistoryReconstructionError('') }} />
          </label>
          <button type="button" style={{ ...button, marginTop: 8 }} onClick={() => void reconstructHistoricalState()} disabled={historyReconstructionLoading || !selectedId || !historyAsOf}>
            {historyReconstructionLoading ? 'Loading earlier care information…' : 'Show earlier version'}
          </button>
          {historyReconstructionError && <p role="alert" style={{ color: 'var(--error)' }}>{historyReconstructionError}</p>}
          {reconstructedHistory && <div role="status" style={{ marginTop: 8 }}>
            <p><strong>Saved version:</strong> {String(reconstructedHistory.recorded_change_at || 'Time not recorded')}</p>
            <p><strong>Chosen date and time:</strong> {String(reconstructedHistory.requested_as_of)}</p>
            <p>An earlier saved version is available. This does not prove the statement was true.</p>
          </div>}
        </details>
        <details style={{ fontSize: 12, marginBottom: 12 }}>
          <summary>Check whether the saved wording has changed</summary>
          {sourceIntegrityLoading && <p role="status">Checking saved wording…</p>}
          {sourceIntegrityError && <p role="alert" style={{ color: 'var(--error)' }}>{sourceIntegrityError} <button type="button" style={button} onClick={() => void loadSourceIntegrity()} disabled={sourceIntegrityLoading}>Try again</button></p>}
          {!sourceIntegrityLoading && !sourceIntegrityError && sourceIntegrity && <>
            <p><strong>Saved wording:</strong> {sourceIntegrity.source_text_integrity_status === 'match' ? 'Matches the original saved copy' : sourceIntegrity.source_text_integrity_status === 'mismatch' ? 'Does not match the original saved copy' : 'Comparison is not available'}</p>
            <p><strong>Original uploaded file:</strong> {sourceIntegrity.original_binary_status === 'match' ? 'Matches the saved copy' : sourceIntegrity.original_binary_status === 'mismatch' ? 'Does not match the saved copy' : sourceIntegrity.original_binary_available === false ? 'Cannot be opened' : 'Not checked'}</p>
            {sourceIntegrity.original_binary_status === 'match' && (
              <p>The original file matches the copy first saved.</p>
            )}
            {sourceIntegrity.original_binary_status === 'mismatch' && (
              <p role="alert">The original file differs from the copy first saved.</p>
            )}
            <p><strong>Other records with exactly the same wording:</strong> {sourceIntegrity.exact_source_text_duplicate_candidate_ids.length
              ? sourceIntegrity.exact_source_text_duplicate_candidate_ids.length + ' possible match(es)'
              : 'No exact wording match was found. Similar wording has not been checked.'}</p>
            <p><strong>Other records with the same original file:</strong> {sourceIntegrity.exact_binary_duplicate_candidate_ids.length
              ? sourceIntegrity.exact_binary_duplicate_candidate_ids.length + ' possible match(es)'
              : 'No identical original file was found.'}</p>
            <p><strong>Similar wording check:</strong> {sourceIntegrity.near_duplicate_comparison_status === 'complete' ? 'Finished' : sourceIntegrity.near_duplicate_comparison_status === 'not_run' ? 'Not checked' : 'Could not be completed'}</p>
            {sourceIntegrity.near_duplicate_candidate_groups.map((group, index) => (
              <p key={group.evidence_ids.join(':') + index}>
                Similar wording appears in {group.evidence_ids.filter(id => id !== selectedId).length} other saved record(s). {group.interpretation}
              </p>
            ))}
            <p>{sourceIntegrity.near_duplicate_interpretation_limit}</p>
            <p><strong>How recent it is:</strong> {reviewStatusLabel(sourceIntegrity.freshness_status)} · <strong>How complete it is:</strong> {reviewStatusLabel(sourceIntegrity.completeness_status)}</p>
            <p><strong>Original reference:</strong> {sourceIntegrity.external_source_reference || 'Not provided'} · {sourceIntegrity.external_source_reference_access_status === 'not_checked' ? 'Not checked' : 'Not available'}</p>
            <p>A matching file check only shows that the saved copy has not changed. It does not prove who created it.</p>
          </>}
          {!sourceIntegrityLoading && !sourceIntegrityError && !sourceIntegrity && <p>The saved wording has not been checked yet.</p>}
          <small>This check compares the saved wording and file. It does not prove who created the original.</small>
        </details>
      </>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 9 }}>
        <label style={{ fontSize: 12 }}>What are you reviewing?
          <select style={field} value={reviewType} onChange={event => changeReviewType(event.target.value as ReviewType)}>
            {(Object.keys(labels) as ReviewType[]).map(key => <option key={key} value={key}>{labels[key]}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 12 }}>Your review
          <select style={field} value={outcome} onChange={event => setOutcome(event.target.value)}>
            {outcomes[reviewType].map(value => <option key={value} value={value}>{reviewStatusLabel(value)}</option>)}
          </select>
        </label>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 9, marginTop: 9 }}>
        <label style={{ fontSize: 12 }}>Who provided this information?
          <select style={field} value={sourceResult} onChange={event => setSourceResult(event.target.value)}>
            <option value="not_assessed">Not checked</option><option value="present">Recorded</option><option value="incomplete">Incomplete</option><option value="unverified">Not confirmed</option>
          </select>
        </label>
        <label style={{ fontSize: 12 }}>Was this reported separately?
          <select style={field} value={corroborationResult} onChange={event => setCorroborationResult(event.target.value)}>
            <option value="not_assessed">Not checked</option><option value="independent_source_linked">A separate report is linked</option><option value="copied_or_same_origin">Copied from the same original source</option><option value="none_linked">No other report is linked</option>
          </select>
        </label>
        <label style={{ fontSize: 12 }}>When did it happen?
          <select style={field} value={temporalResult} onChange={event => setTemporalResult(event.target.value)}>
            <option value="not_assessed">Not checked</option><option value="specified">Recorded</option><option value="partial">Partly recorded</option><option value="missing">Missing</option><option value="conflicting">Reports disagree</option>
          </select>
        </label>
        <label style={{ fontSize: 12 }}>Does this information still apply?
          <select style={field} value={freshnessResult} onChange={event => setFreshnessResult(event.target.value)}>
            <option value="not_assessed">Not checked</option><option value="current">Still current</option><option value="stale">May be out of date</option><option value="historical">Older information</option><option value="undetermined">Not sure</option>
          </select>
        </label>
        <label style={{ fontSize: 12 }}>Is anything missing?
          <select style={field} value={completenessResult} onChange={event => setCompletenessResult(event.target.value)}>
            <option value="not_assessed">Not checked</option><option value="complete">Complete</option><option value="partial">Some details are missing</option><option value="missing">Missing</option><option value="undetermined">Not sure</option>
          </select>
        </label>
      </div>
      <label style={{ display: 'block', fontSize: 12, marginTop: 9 }}>Why are you making this review?
        <textarea style={{ ...field, minHeight: 70 }} value={rationale} onChange={event => setRationale(event.target.value)} />
      </label>
      <button type="button" style={{ ...button, marginTop: 9 }} onClick={() => void submit()} disabled={saving || loading || !selected}>{saving ? 'Saving…' : 'Save review'}</button>
      <button type="button" style={{ ...button, marginTop: 9, marginLeft: 8 }} onClick={() => void loadReviews()} disabled={loading}>{loading ? 'Loading…' : 'Refresh past reviews'}</button>
      {error && <p role="alert" style={{ color: 'var(--error)', fontSize: 12 }}>{error}</p>}
      {notice && <p role="status" style={{ fontSize: 12 }}>{notice}</p>}
      <h4 style={{ fontSize: 13, marginBottom: 5 }}>Past reviews</h4>
      {historyUnavailable ? <p role="status" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Past reviews could not be loaded. Try again; a failed load does not mean there are no reviews.</p> : reviews.length === 0 ? <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>No past reviews were found.</p> : reviews.map(review => <article key={review.id} style={{ borderTop: '1px solid var(--border)', padding: '9px 0', fontSize: 12 }}>
        <strong>{labels[review.review_type] || 'Saved review'}: {reviewStatusLabel(review.outcome)}</strong>
        <div>{new Date(review.created_at).toLocaleString()}</div>
        <p>{review.rationale}</p>
        <ul>{review.criteria.map((criterion, index) => <li key={index}>{reviewCriterionLabel(criterion.criterion)}: {reviewStatusLabel(criterion.result)} — {criterion.rationale}</li>)}</ul>

      </article>)}
    </> : null}
  </section>
}
