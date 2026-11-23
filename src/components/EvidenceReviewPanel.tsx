import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { ensureAnonymousSession, getJSON, postJSON } from '../api/client'
import { caregiverReadableCaptureText, caregiverSourceText, caregiverSafeAssistantText, caregiverSafeGeneratedText } from '@/lib/caregiver-language'

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
  person_id: string
  evidence_id: string
  supersedes_observation_id?: string | null
  correction_rationale?: string | null
  observation_kind: string
  epistemic_status: string
  subject_label: string
  attribute: string
  value_text?: string | null
  normalized_value?: string | null
  units?: string | null
  context?: string | null
  occurred_at?: string | null
  observed_at?: string | null
  reported_at?: string | null
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
  person_id: string
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
  quality: 'How clear this information is',
  reliability: 'How sure are you about this information?',
  source_confidence: 'Do we know who shared it?',
  freshness: 'Is this still current?',
  completeness: 'Are any details missing?',
}
const reviewStatusLabel = (value: string) => ({
  not_assessed: 'Not checked',
  caregiver_report: 'Caregiver report',
  caregiver_note: 'Caregiver note',
  caregiver_reported_observation: 'Caregiver report',
  blood_pressure_systolic: 'Blood pressure (top number)',
  blood_pressure_diastolic: 'Blood pressure (bottom number)',
  oxygen_saturation: 'Oxygen level',
  heart_rate: 'Heart rate',
  mood: 'Mood',
  pain: 'Pain',
  'daily care form': 'Daily Care',
  same_origin: 'Same original',
  shared_origin: 'Same original',
  same_source: 'Same source',
  duplicate: 'Possible duplicate',
  derived_from: 'Based on another note',
  related_to: 'Related notes or documents',
  independent_source: 'Separate source',
  caregiver_form: 'Entered in Daily Care',
  caregiver_check_in: 'Daily Care check-in',
  daily_care_quick_checkin: 'Daily Care check-in',
  note: 'Care update',
  document: 'Document',
  structured_daily_capture: 'Daily care update',
  daily_care_entry: 'Daily care update',
  daily_capture: 'Daily care update',
  daily_care: 'Daily Care',
  ai_companion: 'Care Assistant',
  companion: 'Care Assistant',
  caregiver: 'Caregiver',
  family_caregiver: 'Family caregiver',
  care_professional: 'Healthcare professional',
  undetermined: 'Not sure',
  unknown: 'Not yet known',
  unverified: 'Not confirmed',
  verified: 'Checked',
  partially_verified: 'Partly checked',
  independent_source_linked: 'A separate report is available',
  copied_or_same_origin: 'Taken from the same original',
  none_linked: 'No other report is available',
  stale: 'May be out of date',
  historical: 'Older information',
  current: 'Still current',
  partial: 'Some details are missing',
  partial_revision_history: 'Only part of the saved history is available',
  missing: 'Missing',
  conflicting: 'Reports disagree',
  specified: 'Recorded',
  adequate: 'Enough detail to review',
  limited: 'Some details are missing',
  insufficient: 'Not enough detail',
  supported: 'Matches the saved note or document',
  contested: 'Other information disagrees',
  complete: 'Complete',
  caregiver_reported: 'Reported by a caregiver',
  inferred: 'Possible explanation',
  contradictory: 'Reports do not match',
  occurred_at: 'When it happened',
  observed_at: 'When it was observed',
  reported_at: 'When it was reported',
  collected_at: 'When it was collected',
  recorded_at: 'When it was saved',
  ingested_at: 'When it was added to SolenOS',
  effective_at: 'When it took effect',
  direct: 'Seen by a caregiver',
  indirect: 'Reported from another source',
  second_hand: 'Reported by someone else',
  document_review: 'Taken from a reviewed document',
  manual: 'Entered by a caregiver',
  upload: 'Uploaded',
  document_upload: 'Uploaded document',
  camera: 'Photo',
  image: 'Photo',
  scan: 'Scanned document',
  scanned_document: 'Scanned document',
  import: 'Imported information',
  device: 'Device reading',
  not_recorded: 'Not recorded',
  not_available: 'Not available',
  not_returned: 'Not available',
}[value] ?? 'Not available')
type HistoricalSnapshotItem = {
  key: string;
  title: string;
  detail: string;
  date: string;
  status: string;
  source: string;
};

type HistoricalSnapshotDetail = {
  label: string;
  total: number;
  items: HistoricalSnapshotItem[];
};

function historicalSnapshotDetails(value: Record<string, unknown> | null): HistoricalSnapshotDetail[] {
  const state = value?.state;
  if (!state || typeof state !== 'object') return [];
  const tables = (state as Record<string, unknown>).tables;
  if (!tables || typeof tables !== 'object') return [];
  const configs = [
    { table: 'care_facts', label: 'Saved care information', title: ['field', 'fact_type', 'title'], detail: ['fact_value', 'value', 'description', 'details'], date: ['recorded_at', 'created_at'], status: ['epistemic_state', 'status'], source: ['source_label', 'source_type'] },
    { table: 'care_assertions', label: 'Caregiver reports', title: ['field', 'subject_type'], detail: ['asserted_value', 'source_text', 'description'], date: ['observed_at', 'recorded_at', 'created_at'], status: ['epistemic_state', 'assertion_status'], source: ['source_label'] },
    { table: 'care_events', label: 'Daily care and other events', title: ['title', 'event_type'], detail: ['description', 'summary', 'details'], date: ['occurred_at', 'recorded_at', 'created_at'], status: ['status'], source: ['source_label', 'source_type'] },
    { table: 'evidence', label: 'Documents and notes', title: ['filename', 'title', 'type'], detail: ['description', 'summary', 'source_text'], date: ['recorded_at', 'created_at', 'uploaded_at'], status: ['review_status', 'status'], source: ['source_label', 'source_type'] },
    { table: 'care_decisions', label: 'Care decisions', title: ['title', 'decision_type'], detail: ['decision_text', 'description', 'rationale'], date: ['decided_at', 'recorded_at', 'created_at'], status: ['decision_status', 'status'], source: ['source_label'] },
    { table: 'caregiver_observations', label: 'Caregiver observations', title: ['observation_type', 'category'], detail: ['description', 'observed_value', 'value'], date: ['observed_at', 'recorded_at', 'created_at'], status: ['epistemic_status', 'status'], source: ['source_label', 'source_type'] },
    { table: 'care_uncertainties', label: 'Items that still need checking', title: ['field', 'subject_type', 'title'], detail: ['question', 'description', 'reason'], date: ['created_at', 'recorded_at'], status: ['status'], source: ['source_label'] },
    { table: 'care_conflicts', label: 'Reports that do not match', title: ['field', 'subject_type'], detail: ['description', 'resolution_status', 'status'], date: ['created_at', 'updated_at'], status: ['resolution_status', 'status'], source: ['source_label'] },
    { table: 'decision_outcomes', label: 'Decision results', title: ['outcome_type', 'title'], detail: ['outcome_text', 'description', 'notes'], date: ['recorded_at', 'created_at'], status: ['status'], source: ['source_label'] },
    { table: 'care_timeline_entries', label: 'Care history entries', title: ['title', 'event_type'], detail: ['description', 'summary'], date: ['occurred_at', 'recorded_at', 'created_at'], status: ['status'], source: ['source_label'] },
  ] as const;
  const pick = (row: Record<string, unknown>, keys: readonly string[]) => {
    for (const key of keys) {
      const raw = row[key];
      if (typeof raw === 'string' && raw.trim()) return raw.trim();
      if (typeof raw === 'number') return String(raw);
    }
    return '';
  };
  const output: HistoricalSnapshotDetail[] = [];
  for (const config of configs) {
    const rows = (tables as Record<string, unknown>)[config.table];
    if (!Array.isArray(rows) || rows.length === 0) continue;
    const items = rows.slice(0, 25).filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object').map((row, index) => {
      const rawDate = pick(row, config.date);
      const parsedDate = rawDate ? new Date(rawDate) : null;
      return {
        key: String(row.id ?? index),
        title: reviewStatusLabel(pick(row, config.title) || config.label),
        detail: (pick(row, config.detail) || 'No extra details were saved.').slice(0, 500),
        date: parsedDate && Number.isFinite(parsedDate.getTime()) ? parsedDate.toLocaleString() : 'Date not recorded',
        status: pick(row, config.status),
        source: pick(row, config.source),
      };
    });
    output.push({ label: config.label, total: rows.length, items });
  }
  return output;
}

function historicalSnapshotSections(value: Record<string, unknown> | null): Array<{ label: string; count: number }> {
  const state = value?.state;
  if (!state || typeof state !== 'object') return [];
  const tables = (state as Record<string, unknown>).tables;
  if (!tables || typeof tables !== 'object') return [];
  const labels: Record<string, string> = {
    care_facts: 'Saved care information',
    care_assertions: 'Caregiver reports',
    care_events: 'Daily care and other events',
    evidence: 'Documents and notes',
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
    care_provenance_records: 'Where the information came from',
    care_uncertainties: 'Items needing clarification',
    care_missing_information: 'Missing information',
    care_conflicts: 'Reports that do not match',
    care_action_outcomes: 'Follow-up results',
    record_provenance: 'Related notes and documents',
    record_provenance_links: 'Links to notes and documents',
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
    care_evidence_revisions: 'Note and document history',
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
}[value] ?? 'Not available')
const panel: CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, padding: 14, marginTop: 12, background: 'var(--surface)' }
const field: CSSProperties = { boxSizing: 'border-box', width: '100%', padding: '9px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }
const button: CSSProperties = { border: '1px solid var(--border)', borderRadius: 7, padding: '8px 11px', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer' }

export default function EvidenceReviewPanel(props?: { personId?: string; evidenceItems?: EvidenceItem[]; showInternalSourceChecks?: boolean }) {
  const expectedPersonId = props?.personId?.trim() || ''
  const showInternalSourceChecks = props?.showInternalSourceChecks === true
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
      setEvidenceError('We couldn’t load your saved notes and documents. They may still be there. Check your connection and try again.')
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
  const pendingReviewRequestRef = useRef<{ key: string; fingerprint: string; storageKey: string } | null>(null)
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
      setFreshnessPolicyError('We couldn’t load the settings for how often this information should be checked. Check your connection and try again.')
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
      if (!Array.isArray(history?.items)) throw new Error('Your review was saved, but earlier reviews could not be loaded. Try again.')
      setFreshnessAssessments(history.items)
      setFreshnessHistoryError('')
    } catch (cause) {
      setFreshnessPolicyError('We couldn’t confirm that this review was saved.')
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
      setFreshnessHistoryError('Earlier reviews are unavailable right now. This does not mean there are no past reviews.')
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
      setRecordSnapshotNotice('A copy of the care record was saved. Choose “Show earlier record” to see what was saved.')
    } catch (error) {
      setRecordHistoryError('The care record copy could not be saved. Try again.')
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
      setRecordHistoryError('No saved copy of your full Care Record is available for that date. This does not mean the record was empty.')
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
      if (!Array.isArray(result) || result.some((item) =>
        item?.person_id !== personId || item?.evidence_id !== selectedId || typeof item?.id !== 'string'
      )) throw new Error('Invalid or incorrectly scoped review response')
      setReviews(result as Review[])
    } catch {
      setReviews([])
      setHistoryUnavailable(true)
      setError('Earlier reviews could not be loaded. Check your connection and try again.')
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
      setSourceIntegrityError('We couldn’t compare the saved wording with its original copy. This does not mean they match. Try again when connected.')
    } finally {
      setSourceIntegrityLoading(false)
    }
  }, [personId, selectedId])

  useEffect(() => { if (showInternalSourceChecks) void loadSourceIntegrity() }, [loadSourceIntegrity, showInternalSourceChecks])

  const reconstructHistoricalState = useCallback(async () => {
    if (!selectedId || !personId || !historyAsOf) {
      setHistoryReconstructionError('Choose a date and time before viewing the earlier care information.')
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
      setHistoryReconstructionError('We couldn’t show the earlier version from that date. This doesn’t mean the information was never saved. Try again or choose another date.')
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
      setRelationshipsError('We couldn’t load related notes and documents. Check your connection and try again.')
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
      setObservationsError('We couldn’t load the saved care details. Check your connection and try again.')
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
    if (!selected || !personId || !rationale.trim()) {
      setError('Select saved information and provide a review note before saving.')
      return
    }
    setSaving(true)
    setError('')
    setNotice('')
    const criteria = [
      { criterion: 'source attribution', result: sourceResult, rationale: 'Check who provided the original information.' },
      { criterion: 'independent corroboration', result: corroborationResult, rationale: 'Check whether another report was made separately.' },
      { criterion: 'temporal context', result: temporalResult, rationale: 'Check whether the dates and times are clear.' },
      { criterion: 'evidence freshness', result: freshnessResult, rationale: 'Check whether the information still applies.' },
      { criterion: 'record completeness', result: completenessResult, rationale: 'Check whether important details are missing.' },
    ]
    const requestPayload = {
      evidence_id: selected.id,
      person_id: personId,
      review_type: reviewType,
      outcome,
      rationale: rationale.trim(),
      policy_version: 'evidence-review-v1',
      criteria,
    }
    const fingerprintSource = [
      requestPayload.evidence_id,
      requestPayload.person_id,
      requestPayload.review_type,
      requestPayload.outcome,
      requestPayload.rationale,
      requestPayload.policy_version,
      sourceResult,
      corroborationResult,
      temporalResult,
      freshnessResult,
      completenessResult,
    ].map((value) => String(value).length + ":" + String(value)).join("")
    let fingerprint = fingerprintSource
    let fingerprintIsHashed = false
    try {
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(fingerprintSource))
      fingerprint = Array.from(new Uint8Array(digest))
        .map((value) => value.toString(16).padStart(2, "0"))
        .join("")
      fingerprintIsHashed = true
    } catch {
      // Do not persist caregiver-entered review text when Web Crypto is unavailable.
      // The in-memory request key still protects retries while this component remains mounted.
    }
    const storageKey = `solenos:evidence-review:${encodeURIComponent(personId)}:${encodeURIComponent(selected.id)}`
    if (!pendingReviewRequestRef.current || pendingReviewRequestRef.current.fingerprint !== fingerprint) {
      let restoredKey: string | null = null
      if (fingerprintIsHashed) {
        try {
          const savedRetry = window.sessionStorage.getItem(storageKey)
          if (savedRetry) {
            const separator = savedRetry.indexOf(":")
            const savedKey = separator > 0 ? savedRetry.slice(0, separator) : ""
            const savedFingerprint = separator > 0 ? savedRetry.slice(separator + 1) : ""
            if (savedFingerprint === fingerprint && savedKey.length >= 8 && savedKey.length <= 128) {
              restoredKey = savedKey
            }
          }
        } catch {
          // Storage may be unavailable in a restricted browser; the in-memory
          // key still protects retries while this component remains mounted.
        }
      }
      const key = restoredKey || crypto.randomUUID()
      pendingReviewRequestRef.current = { key, fingerprint, storageKey }
      if (fingerprintIsHashed) {
        try {
          window.sessionStorage.setItem(storageKey, key + ":" + fingerprint)
        } catch {
          // The API remains idempotent for this mounted component even if the
          // browser blocks session storage.
        }
      }
    }
    const requestKey = pendingReviewRequestRef.current.key
    try {
      const saved = await postJSON(`/care-continuity/evidence/${encodeURIComponent(selected.id)}/reviews`, {
        ...requestPayload,
        request_key: requestKey,
      }) as Review & { idempotent_replay?: boolean; care_continuity_execution?: { stages?: Record<string, string> } | null }
      if (!saved?.id || saved.id.length === 0 || saved.evidence_id !== selected.id || saved.person_id !== personId) {
        throw new Error('The saved review response did not match the selected care information.')
      }

      // Verify the committed review through a separate read before showing it as saved.
      // The same request key remains in memory if this read fails, so a retry cannot
      // append a second review after an ambiguous network result.
      const history = await getJSON(`/care-continuity/evidence/${encodeURIComponent(selected.id)}/reviews`)
      if (!Array.isArray(history) || history.some((item) =>
        item?.person_id !== personId || item?.evidence_id !== selected.id || typeof item?.id !== 'string'
      )) {
        throw new Error('The saved review history could not be verified.')
      }
      const persisted = history.find((item: Review) => item.id === saved.id)
      if (!persisted) throw new Error('The saved review was not returned by the independent history read.')

      setReviews(history as Review[])
      setHistoryUnavailable(false)
      setRationale('')
      if (pendingReviewRequestRef.current) {
        try {
          window.sessionStorage.removeItem(pendingReviewRequestRef.current.storageKey)
        } catch {
          // A completed review is already verified server-side; storage cleanup
          // must not turn a successful save into a reported failure.
        }
      }
      pendingReviewRequestRef.current = null
      setNotice(
        saved.care_continuity_execution?.stages?.reconciliation === 'committed'
          ? 'Your review was saved, and the care information was checked again. The original note or document has not changed. This review does not confirm a medical fact.'
          : 'Your review was saved and loaded from your Care Record. The original note or document has not changed.',
      )
    } catch {
      setError('We couldn’t confirm that your review was saved. Check earlier reviews before trying again.')
    } finally {
      setSaving(false)
    }
  }

  if (!personId && !evidenceLoading && !evidenceError) return null
  return <section style={panel} aria-label="Reviews of saved notes and documents">
    <h3 style={{ fontSize: "calc(16px * var(--solenos-text-scale, 1))", marginTop: 0 }}>Notes and documents behind care information</h3>
    {evidenceError && <p role="alert" style={{ color: 'var(--error)', fontSize: "calc(14px * var(--solenos-text-scale, 1))" }}>{evidenceError} <button type="button" style={button} onClick={() => void loadEvidence()} disabled={evidenceLoading}>Try loading again</button></p>}
    {evidenceLoading && <p role="status" style={{ fontSize: "calc(14px * var(--solenos-text-scale, 1))" }}>Loading your saved notes and documents…</p>}
    <p style={{ fontSize: "calc(14px * var(--solenos-text-scale, 1))", color: 'var(--text-secondary)' }}>Your review is saved separately. The original note or document stays unchanged. A caregiver review does not mean a healthcare professional has confirmed the information.</p>
    <details style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, marginBottom: 12 }}>
      <summary style={{ cursor: 'pointer', fontSize: "calc(16px * var(--solenos-text-scale, 1))", fontWeight: 650 }}>Check whether information is still up to date</summary>
      <p style={{ fontSize: "calc(14px * var(--solenos-text-scale, 1))", color: 'var(--text-secondary)' }}>Choose how often this information should be checked. Different kinds of information may need different check-in times. A review does not prove that information is true or still applies today.</p>
      {freshnessPolicyLoading && <p role="status">Loading your review settings…</p>}
      {freshnessPolicyError && <p role="alert" style={{ color: 'var(--error)', fontSize: "calc(14px * var(--solenos-text-scale, 1))" }}>{freshnessPolicyError} <button type="button" style={button} onClick={() => void loadFreshnessPolicies()} disabled={freshnessPolicyLoading}>Try again</button></p>}
      <label style={{ display: 'block', fontSize: "calc(14px * var(--solenos-text-scale, 1))", marginTop: 10 }}>How often should this information be checked?
        <select style={field} value={freshnessPolicyId} onChange={event => setFreshnessPolicyId(event.target.value)}>
          <option value="">Choose how often to check</option>
          {freshnessPolicies.map(policy => <option key={policy.id} value={policy.id}>{reviewStatusLabel(policy.domain_key)} · {policy.max_age_days == null ? 'No time limit set' : 'Review after ' + policy.max_age_days + ' days'}</option>)}
        </select>
      </label>
      <button type="button" style={{ ...button, marginTop: 8 }} onClick={() => void assessSelectedFreshness()} disabled={!selected || !freshnessPolicyId || freshnessPolicySaving}>{freshnessPolicySaving ? 'Checking…' : 'Check whether this is still current'}</button>
      {freshnessPolicyNotice && <p role="status" style={{ fontSize: "calc(14px * var(--solenos-text-scale, 1))" }}>{freshnessPolicyNotice}</p>}
      <h4 style={{ fontSize: "calc(14px * var(--solenos-text-scale, 1))", marginBottom: 4 }}>Earlier reviews</h4>
      {freshnessHistoryLoading && <p role="status" style={{ fontSize: "calc(14px * var(--solenos-text-scale, 1))" }}>Loading earlier reviews…</p>}
      {freshnessHistoryError && <p role="alert" style={{ fontSize: "calc(14px * var(--solenos-text-scale, 1))", color: 'var(--error)' }}>{freshnessHistoryError} <button type="button" style={button} onClick={() => void loadFreshnessHistory()} disabled={freshnessHistoryLoading}>Retry history</button></p>}
      {!freshnessHistoryLoading && !freshnessHistoryError && freshnessAssessments.length === 0 && <p style={{ fontSize: "calc(14px * var(--solenos-text-scale, 1))" }}>No earlier reviews were found for this information.</p>}
      {freshnessAssessments.map(item => <article key={item.id} style={{ borderTop: '1px solid var(--border)', padding: '7px 0', fontSize: "calc(14px * var(--solenos-text-scale, 1))" }}>
        <strong>{reviewStatusLabel(item.freshness_status)}</strong>
        <div>Reviewed {new Date(item.assessed_at).toLocaleString()} · Date on the original note or document {item.source_time ? new Date(item.source_time).toLocaleString() + ' (' + (reviewStatusLabel(item.source_time_kind || 'not_recorded')) + ')' : 'unknown'} · Days since it was added {item.age_days == null ? 'unknown' : item.age_days + ' days'}</div>
        <p>{caregiverSafeGeneratedText(item.rationale) || 'No further explanation is available.'}</p>
      </article>)}
    </details>
    {!evidenceLoading && !evidenceError && evidenceItems.length === 0 ? <p style={{ fontSize: "calc(16px * var(--solenos-text-scale, 1))", color: 'var(--text-secondary)' }}>No saved notes or documents were found for this Care Record.</p> : evidenceItems.length > 0 ? <>
      <label style={{ display: 'block', fontSize: "calc(14px * var(--solenos-text-scale, 1))", marginBottom: 9 }}>Original note or document
        <select style={field} value={selectedId} onChange={event => setSelectedId(event.target.value)}>
          {evidenceItems.map(item => <option key={item.id} value={item.id}>{reviewStatusLabel(item.type)} · {item.uploaded_at ? new Date(item.uploaded_at).toLocaleDateString() : 'Date not recorded'}</option>)}
        </select>
      </label>
      {selected && <>
        <blockquote style={{ margin: '8px 0 12px', paddingLeft: 10, borderLeft: '2px solid var(--border)', fontSize: "calc(14px * var(--solenos-text-scale, 1))", overflowWrap: 'anywhere', whiteSpace: 'pre-line' }}>{caregiverReadableCaptureText(selected.source_text) || 'Saved care information'}</blockquote>
        <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, margin: '8px 0 12px', fontSize: "calc(14px * var(--solenos-text-scale, 1))" }}>
          <div><dt style={{ color: 'var(--text-secondary)' }}>Type of note or document</dt><dd style={{ margin: 0 }}>{reviewStatusLabel(selected.type || 'not_recorded')}</dd></div>
          <div><dt style={{ color: 'var(--text-secondary)' }}>Shared by</dt><dd style={{ margin: 0 }}>{reviewStatusLabel(selected.reported_by_label || (selected.reported_by_caregiver_id || selected.uploaded_by_caregiver_id ? 'caregiver' : 'not_recorded'))}</dd></div>
          <div><dt style={{ color: 'var(--text-secondary)' }}>When it happened</dt><dd style={{ margin: 0 }}>{selected.occurred_at ? new Date(selected.occurred_at).toLocaleString() : 'Not recorded'}{selected.occurred_at_timezone ? ` · ${selected.occurred_at_timezone}` : ''}</dd></div>
          <div><dt style={{ color: 'var(--text-secondary)' }}>Added to your Care Record</dt><dd style={{ margin: 0 }}>{selected.uploaded_at ? new Date(selected.uploaded_at).toLocaleString() : 'Not recorded'}</dd></div>
          <div><dt style={{ color: 'var(--text-secondary)' }}>How it reached your Care Record</dt><dd style={{ margin: 0 }}>{reviewStatusLabel(selected.origin_channel || selected.evidence_kind || 'not_recorded')}</dd></div>
          <div><dt style={{ color: 'var(--text-secondary)' }}>What we know about this information</dt><dd style={{ margin: 0 }}>{reviewStatusLabel(selected.epistemic_status || 'not_assessed')}</dd></div>
        </dl>
        <details style={{ fontSize: "calc(14px * var(--solenos-text-scale, 1))", marginBottom: 12 }}>
          <summary>More details about this note or document</summary>
          <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, margin: '8px 0 12px' }}>
            <div><dt style={{ color: 'var(--text-secondary)' }}>Originally written by</dt><dd style={{ margin: 0 }}>{caregiverSafeAssistantText(selected.original_author) || 'Not recorded'}</dd></div>
            <div><dt style={{ color: 'var(--text-secondary)' }}>Entered by</dt><dd style={{ margin: 0 }}>{selected.collected_by_caregiver_id ? 'Caregiver' : 'Not recorded'}</dd></div>
            <div><dt style={{ color: 'var(--text-secondary)' }}>When it was entered</dt><dd style={{ margin: 0 }}>{selected.collected_at ? new Date(selected.collected_at).toLocaleString() : 'Not recorded'}</dd></div>
            <div><dt style={{ color: 'var(--text-secondary)' }}>When it was shared</dt><dd style={{ margin: 0 }}>{selected.reported_at ? new Date(selected.reported_at).toLocaleString() : 'Not recorded'}</dd></div>
            <div><dt style={{ color: 'var(--text-secondary)' }}>How it was entered</dt><dd style={{ margin: 0 }}>{reviewStatusLabel(selected.collection_method || selected.evidence_kind || 'not_recorded')}</dd></div>
            <div><dt style={{ color: 'var(--text-secondary)' }}>Device</dt><dd style={{ margin: 0 }}>{selected.origin_device_ref ? 'A device was used' : 'Not recorded'}</dd></div>
            <div><dt style={{ color: 'var(--text-secondary)' }}>Where it came from</dt><dd style={{ margin: 0 }}>{reviewStatusLabel(selected.transfer_source || 'not_recorded')}</dd></div>
            <div><dt style={{ color: 'var(--text-secondary)' }}>Saved on</dt><dd style={{ margin: 0 }}>{selected.ingested_at ? new Date(selected.ingested_at).toLocaleString() : 'Not recorded'}</dd></div>
            <div><dt style={{ color: 'var(--text-secondary)' }}>Related notes or documents</dt><dd style={{ margin: 0 }}>{selected.parent_evidence_id ? 'Another note or document is linked' : 'None recorded'}</dd></div>
          </dl>
        </details>
        <details style={{ fontSize: "calc(14px * var(--solenos-text-scale, 1))", marginBottom: 12 }}>
          <summary>Related notes and documents ({relationships.length})</summary>
          <p>These links help show whether several items came from the same original. They do not confirm whether the information is true. They do not prove that two reports are separate.</p>
          {relationshipsLoading && <p role="status">Loading links to other saved information…</p>}
          {relationshipsError && <p role="alert" style={{ color: 'var(--error)' }}>{relationshipsError} <button type="button" style={button} onClick={() => void loadRelationships()} disabled={relationshipsLoading}>Retry</button></p>}
          {!relationshipsLoading && !relationshipsError && relationships.length === 0 && <p>No other notes or documents are linked to this item yet.</p>}
          {relationships.map(item => <article key={item.id} style={{ borderTop: '1px solid var(--border)', padding: '8px 0' }}>
            <strong>{reviewStatusLabel(item.relationship_type)}</strong>
            <div>This information is connected to another saved item.</div>
            <div>Were these shared separately? {reviewStatusLabel(item.source_independence_status)}</div>
            {item.source_independence_status === 'shared_origin' && (
              <p>These items came from the same original. They should not be counted as separate reports.</p>
            )}
            {item.origin_group_key && <p>These entries came from the same original.</p>}
            <p>{caregiverSafeGeneratedText(item.rationale) || 'No further explanation is available.'}</p>
            <small style={{ fontSize: "calc(14px * var(--solenos-text-scale, 1))" }}>{item.reviewed_by_caregiver_id ? "Checked by a caregiver" : "Reviewer not recorded"} · {new Date(item.created_at).toLocaleString()}</small>
          </article>)}
        </details>
        <details style={{ fontSize: "calc(14px * var(--solenos-text-scale, 1))", marginBottom: 12 }}>
          <summary>Details recorded from this information ({observations.length})</summary>
          <p>Each detail keeps the exact words from the original note or document and stays linked to what was shared. A report stays labelled as a report; it is not treated as a confirmed medical fact.</p>
          {observationsLoading && <p role="status">Loading recorded details…</p>}
          {observationsError && <p role="alert" style={{ color: 'var(--error)' }}>{observationsError} <button type="button" style={button} onClick={() => void loadObservations()} disabled={observationsLoading}>Retry</button></p>}
          {!observationsLoading && !observationsError && observations.length === 0 && <p>No separate details are available yet.</p>}
          {observations.slice().sort((a, b) => a.source_span_start - b.source_span_start).map(item => <article key={item.id} style={{ borderTop: '1px solid var(--border)', padding: '8px 0' }}>
            <strong>{reviewStatusLabel(item.attribute)} · {reviewStatusLabel(item.epistemic_status)}</strong>
            <div>{reviewStatusLabel(item.observation_kind)} · {item.subject_label}</div>
            <blockquote style={{ margin: '6px 0', paddingLeft: 9, borderLeft: '2px solid var(--border)', overflowWrap: 'anywhere', whiteSpace: 'pre-line' }}>{caregiverSourceText(item.source_passage) || 'Original wording is not available.'}</blockquote>
            {item.normalized_value && <div>Care detail: {caregiverSafeAssistantText(item.normalized_value)}</div>}
            {item.observation_method !== 'Daily Care form' && (
              <div>What was recorded: {item.value_text ?? 'Not established'}{item.units ? ` ${item.units}` : ''}</div>
            )}
            {item.context && <p>{caregiverSafeAssistantText(item.context)}</p>}
            {item.supersedes_observation_id && <div>Corrects an earlier saved detail: {item.correction_rationale || 'No correction rationale recorded'}</div>}
            {item.negated !== null && item.negated !== undefined && <div>Was this reported as not happening? {item.negated ? 'yes' : 'no'}</div>}
            {item.hedge_marker && <div>Words that show the report may be uncertain: {item.hedge_marker}</div>}
            {item.ambiguity_note && <div>What still needs clarification: {item.ambiguity_note}</div>}
            {item.observer_label && <div>Who shared this information: {item.observer_label}{item.observation_method ? ` · ${reviewStatusLabel(item.observation_method)}` : ''}</div>}
            <small style={{ fontSize: "calc(14px * var(--solenos-text-scale, 1))" }}>Happened: {item.occurred_at ? new Date(item.occurred_at).toLocaleString() : 'Not recorded'}</small>
            {item.observed_at && <small style={{ fontSize: "calc(14px * var(--solenos-text-scale, 1))" }}>Observed: {new Date(item.observed_at).toLocaleString()}</small>}
            <small style={{ fontSize: "calc(14px * var(--solenos-text-scale, 1))" }}>Reported: {item.reported_at ? new Date(item.reported_at).toLocaleString() : 'Not recorded'}</small>
            <small style={{ fontSize: "calc(14px * var(--solenos-text-scale, 1))" }}>Saved: {item.recorded_at ? new Date(item.recorded_at).toLocaleString() : 'Not recorded'}</small>
          </article>)}
        </details>

        <details style={{ fontSize: "calc(14px * var(--solenos-text-scale, 1))", marginBottom: 12 }}>
          <summary>See what the record said earlier</summary>
          <p>Shows the saved care information from the date you choose. Changes made after that copy are not included.</p>
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
          {recordSnapshotNotice && <p role="status" aria-live="polite">{recordSnapshotNotice}</p>}
          <button type="button" style={{ ...button, marginTop: 8 }} onClick={() => void reconstructRecordHistory()} disabled={recordHistoryLoading || !personId || !recordHistoryAsOf}>
            {recordHistoryLoading ? 'Loading earlier care information…' : 'Show earlier record'}
          </button>
          {recordHistoryError && <p role="alert" style={{ color: 'var(--error)' }}>{recordHistoryError}</p>}
          {recordHistory && <div role="status" style={{ marginTop: 8 }}>
            <p><strong>Saved copy from:</strong> {recordHistory.snapshot_as_of ? new Date(String(recordHistory.snapshot_as_of)).toLocaleString() : 'Time not recorded'}</p>
            <p><strong>Saved information:</strong></p>
            {historicalSnapshotDetails(recordHistory).map(section => (
              <details key={section.label} style={{ margin: '8px 0' }}>
                <summary>{caregiverSafeAssistantText(section.label) || "Saved care information"} ({section.total})</summary>
                <ul style={{ margin: '6px 0', paddingLeft: 20 }}>
                  {section.items.map(item => (
                    <li key={item.key} style={{ marginBottom: 8 }}>
                      <strong>{caregiverSafeAssistantText(item.title) || "Saved care detail"}</strong>
                      <p>{caregiverSafeAssistantText(item.detail) || "The saved details could not be displayed in a readable form."}</p>
                      <small style={{ fontSize: "calc(14px * var(--solenos-text-scale, 1))" }}>{item.date}{item.status ? ` · ${reviewStatusLabel(item.status)}` : ''}{item.source ? ` · From: ${reviewStatusLabel(item.source)}` : ''}</small>
                    </li>
                  ))}
                </ul>
                {section.total > section.items.length && <p>Showing {section.items.length} of {section.total} saved items.</p>}
              </details>
            ))}
            {historicalSnapshotSections(recordHistory).filter(section => !['Saved care information', 'Caregiver reports', 'Daily care and other events', 'Documents and notes', 'Care decisions', 'Caregiver observations', 'Items that still need checking', 'Reports that do not match', 'Decision results', 'Care history entries'].includes(section.label)).reduce((total, section) => total + section.count, 0) > 0 && (
              <p>Other saved care details: {historicalSnapshotSections(recordHistory).filter(section => !['Saved care information', 'Caregiver reports', 'Daily care and other events', 'Documents and notes', 'Care decisions', 'Caregiver observations', 'Items that still need checking', 'Reports that do not match', 'Decision results', 'Care history entries'].includes(section.label)).reduce((total, section) => total + section.count, 0)} saved item(s).</p>
            )}
            <p>This saved copy may not include every care update. Information added after this date is not shown.</p>
          </div>}
        </details>

        <details style={{ fontSize: "calc(14px * var(--solenos-text-scale, 1))", marginBottom: 12 }}>
          <summary>See information saved earlier</summary>
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
        {showInternalSourceChecks && (
        <details style={{ fontSize: "calc(14px * var(--solenos-text-scale, 1))", marginBottom: 12 }}>
          <summary>Check that the saved copy matches the original</summary>
          {sourceIntegrityLoading && <p role="status">Checking the saved wording…</p>}
          {sourceIntegrityError && <p role="alert" style={{ color: 'var(--error)' }}>{sourceIntegrityError} <button type="button" style={button} onClick={() => void loadSourceIntegrity()} disabled={sourceIntegrityLoading}>Try again</button></p>}
          {!sourceIntegrityLoading && !sourceIntegrityError && sourceIntegrity && <>
            <p><strong>Saved wording:</strong> {sourceIntegrity.source_text_integrity_status === 'match' ? 'Matches the original saved copy' : sourceIntegrity.source_text_integrity_status === 'mismatch' ? 'Does not match the original saved copy' : 'Comparison is not available'}</p>
            <p><strong>Original file:</strong> {sourceIntegrity.original_binary_status === 'match' ? 'Matches the saved copy' : sourceIntegrity.original_binary_status === 'mismatch' ? 'Does not match the saved copy' : sourceIntegrity.original_binary_available === false ? 'Cannot be opened' : 'Not checked'}</p>
            {sourceIntegrity.original_binary_status === 'match' && (
              <p>The original document matches the copy first saved.</p>
            )}
            {sourceIntegrity.original_binary_status === 'mismatch' && (
              <p role="alert">The original document differs from the copy first saved.</p>
            )}
            <p><strong>Other notes with exactly the same wording:</strong> {sourceIntegrity.exact_source_text_duplicate_candidate_ids.length
              ? sourceIntegrity.exact_source_text_duplicate_candidate_ids.length + ' possible match(es)'
              : 'No exact wording match was found. Similar wording has not been checked.'}</p>
            <p><strong>Other copies of this file:</strong> {sourceIntegrity.exact_binary_duplicate_candidate_ids.length
              ? sourceIntegrity.exact_binary_duplicate_candidate_ids.length + ' possible match(es)'
              : 'No identical original file was found.'}</p>
            <p><strong>Check for similar wording:</strong> {sourceIntegrity.near_duplicate_comparison_status === 'complete' ? 'Finished' : sourceIntegrity.near_duplicate_comparison_status === 'not_run' ? 'Not checked' : 'Could not be completed'}</p>
            {sourceIntegrity.near_duplicate_candidate_groups.map((group, index) => (
              <p key={group.evidence_ids.join(':') + index}>
                Similar wording appears in {group.evidence_ids.filter(id => id !== selectedId).length} other saved record(s). {caregiverSafeGeneratedText(group.interpretation) || 'We do not yet know how these notes or documents are related.'}
              </p>
            ))}
            <p>{caregiverSafeGeneratedText(sourceIntegrity.near_duplicate_interpretation_limit) || 'We cannot yet explain how similar records are related.'}</p>
            <p><strong>How recent it is:</strong> {reviewStatusLabel(sourceIntegrity.freshness_status)} · <strong>How much information is included:</strong> {reviewStatusLabel(sourceIntegrity.completeness_status)}</p>
            <p><strong>Original document or link:</strong> {sourceIntegrity.external_source_reference ? 'An original reference is saved' : 'Not provided'} · {sourceIntegrity.external_source_reference_access_status === 'not_checked' ? 'Not checked' : 'Not available'}</p>
            <p>A matching file check only shows that the saved copy has not changed. It does not prove who created it.</p>
          </>}
          {!sourceIntegrityLoading && !sourceIntegrityError && !sourceIntegrity && <p>The saved wording has not been checked yet.</p>}
          <small style={{ fontSize: "calc(14px * var(--solenos-text-scale, 1))" }}>This check compares the saved wording and file. It does not prove who created the original.</small>
        </details>
        )}
      </>}
      <details style={{ fontSize: "calc(14px * var(--solenos-text-scale, 1))", marginBottom: 12 }}>
        <summary>Review or correct this information</summary>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 9 }}>
        <label style={{ fontSize: "calc(14px * var(--solenos-text-scale, 1))" }}>What would you like to check?
          <select style={field} value={reviewType} onChange={event => changeReviewType(event.target.value as ReviewType)}>
            {(Object.keys(labels) as ReviewType[]).map(key => <option key={key} value={key}>{labels[key]}</option>)}
          </select>
        </label>
        <label style={{ fontSize: "calc(14px * var(--solenos-text-scale, 1))" }}>What do you think?
          <select style={field} value={outcome} onChange={event => setOutcome(event.target.value)}>
            {outcomes[reviewType].map(value => <option key={value} value={value}>{reviewStatusLabel(value)}</option>)}
          </select>
        </label>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 9, marginTop: 9 }}>
        <label style={{ fontSize: "calc(14px * var(--solenos-text-scale, 1))" }}>Do we know who shared this?
          <select style={field} value={sourceResult} onChange={event => setSourceResult(event.target.value)}>
            <option value="not_assessed">Not checked</option><option value="present">Identified</option><option value="incomplete">Partly identified</option><option value="unverified">Not confirmed</option>
          </select>
        </label>
        <label style={{ fontSize: "calc(14px * var(--solenos-text-scale, 1))" }}>Was this shared separately?
          <select style={field} value={corroborationResult} onChange={event => setCorroborationResult(event.target.value)}>
            <option value="not_assessed">Not checked</option><option value="independent_source_linked">A separate report is linked</option><option value="copied_or_same_origin">Copied from the same original</option><option value="none_linked">No other report is linked</option>
          </select>
        </label>
        <label style={{ fontSize: "calc(14px * var(--solenos-text-scale, 1))" }}>Is the timing clear?
          <select style={field} value={temporalResult} onChange={event => setTemporalResult(event.target.value)}>
            <option value="not_assessed">Not checked</option><option value="specified">Recorded</option><option value="partial">Partly recorded</option><option value="missing">Missing</option><option value="conflicting">Reports disagree</option>
          </select>
        </label>
        <label style={{ fontSize: "calc(14px * var(--solenos-text-scale, 1))" }}>Is this still current?
          <select style={field} value={freshnessResult} onChange={event => setFreshnessResult(event.target.value)}>
            <option value="not_assessed">Not checked</option><option value="current">Still current</option><option value="stale">May be out of date</option><option value="historical">Older information</option><option value="undetermined">Not sure</option>
          </select>
        </label>
        <label style={{ fontSize: "calc(14px * var(--solenos-text-scale, 1))" }}>Are any details missing?
          <select style={field} value={completenessResult} onChange={event => setCompletenessResult(event.target.value)}>
            <option value="not_assessed">Not checked</option><option value="complete">Complete</option><option value="partial">Some details are missing</option><option value="missing">Missing</option><option value="undetermined">Not sure</option>
          </select>
        </label>
      </div>
      <label style={{ display: 'block', fontSize: "calc(14px * var(--solenos-text-scale, 1))", marginTop: 9 }}>Add a note (optional)
        <textarea style={{ ...field, minHeight: 70 }} value={rationale} onChange={event => setRationale(event.target.value)} />
      </label>
      <button type="button" style={{ ...button, marginTop: 9 }} onClick={() => void submit()} disabled={saving || loading || !selected}>{saving ? 'Saving…' : 'Save your review'}</button>
      <button type="button" style={{ ...button, marginTop: 9, marginLeft: 8 }} onClick={() => void loadReviews()} disabled={loading}>{loading ? 'Loading…' : 'Show earlier reviews'}</button>
      {error && <p role="alert" style={{ color: 'var(--error)', fontSize: "calc(14px * var(--solenos-text-scale, 1))" }}>{error}</p>}
      {notice && <p role="status" style={{ fontSize: "calc(14px * var(--solenos-text-scale, 1))" }}>{notice}</p>}
      <h4 style={{ fontSize: "calc(16px * var(--solenos-text-scale, 1))", marginBottom: 5 }}>Earlier reviews</h4>
      {historyUnavailable ? <p role="status" style={{ fontSize: "calc(14px * var(--solenos-text-scale, 1))", color: 'var(--text-secondary)' }}>Past reviews could not be loaded. Try again; a failed load does not mean there are no reviews.</p> : reviews.length === 0 ? <p style={{ fontSize: "calc(14px * var(--solenos-text-scale, 1))", color: 'var(--text-secondary)' }}>No earlier reviews were found.</p> : reviews.map(review => <article key={review.id} style={{ borderTop: '1px solid var(--border)', padding: '9px 0', fontSize: "calc(14px * var(--solenos-text-scale, 1))" }}>
        <strong>{labels[review.review_type] || 'Saved review'}: {reviewStatusLabel(review.outcome)}</strong>
        <div>{new Date(review.created_at).toLocaleString()}</div>
        <p>{caregiverSafeGeneratedText(review.rationale) || 'No further explanation is available.'}</p>
        <ul>{review.criteria.map((criterion, index) => <li key={index}>{reviewCriterionLabel(criterion.criterion)}: {reviewStatusLabel(criterion.result)} — {caregiverSafeGeneratedText(criterion.rationale) || 'No further explanation is available.'}</li>)}</ul>

      </article>)}
      </details>
    </> : null}
  </section>
}
