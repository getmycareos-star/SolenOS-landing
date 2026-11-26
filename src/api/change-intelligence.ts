import { getJSON, getPersonId, postJSON } from "./client";

export type CoverageStatus = "covered" | "partial" | "uncovered" | "unknown";

export type ObservationCoverageRecord = {
  id: string;
  person_id: string;
  subject_type: string;
  window_start: string;
  window_end: string;
  coverage_status: CoverageStatus;
  source_evidence_ids: string[];
  rationale: string;
  recorded_by_caregiver_id: string;
  created_at: string;
};

export type CoverageAssessment = {
  person_id: string;
  subject_type: string;
  window_start: string;
  window_end: string;
  coverage_status: CoverageStatus;
  covered_seconds: number;
  window_seconds: number;
  coverage_fraction: number | null;
  records: ObservationCoverageRecord[];
  limitations: string[];
};

export type PersistedChange = {
  id: string;
  person_id: string;
  subject_type: string;
  subject_id: string;
  change_type: string;
  change_direction: string;
  previous_state: string | null;
  current_state: string | null;
  comparison_window_start: string | null;
  comparison_window_end: string | null;
  confidence: number | null;
  significance_verdict?: "meaningful_candidate" | "not_meaningful" | "insufficient_evidence" | null;
  attention_candidate?: boolean;
  follow_up_candidate?: boolean;
  baseline_coverage_status?: CoverageStatus | null;
  current_coverage_status?: CoverageStatus | null;
  baseline_coverage_fraction?: number | null;
  current_coverage_fraction?: number | null;
  evidence_ids: string[];
  explanation: string | null;
  confirmation_status: string;
  is_active: boolean;
};

export type PersistedPattern = {
  id: string;
  person_id: string;
  subject_type: string;
  subject_id: string;
  pattern_type: string;
  pattern_strength: string;
  event_ids: string[];
  change_ids: string[] | null;
  temporal_start: string;
  temporal_end: string;
  confidence: number | null;
  alternative_interpretations: Array<string | Record<string, unknown>> | null;
  pattern_metrics?: Record<string, unknown> | null;
  is_active: boolean;
};

export type PersistedSituation = {
  id: string;
  person_id: string;
  situation_type: string;
  state: string;
  title: string;
  description: string | null;
  explanation: string | null;
  signal_ids: string[];
  signal_types: string[];
  temporal_start: string;
  temporal_end: string;
  pattern_ids: string[] | null;
  change_ids: string[] | null;
  context: Record<string, unknown> | null;
  is_active: boolean;
  superseded_by_situation_id: string | null;
};

export type SituationTrajectoryState = "active" | "worsening" | "improving" | "resolved" | "unknown";
export type SituationSourceRecord = {
  id: string;
  source_type: string;
  title: string;
  excerpt: string | null;
  occurred_at: string | null;
  recorded_at: string | null;
  time_provenance?: string | null;
  source_label: string | null;
  status: string | null;
  evidence_ids: string[];
  epistemic_status: string | null;
  negated: boolean | null;
  hedge_marker: string | null;
  ambiguity_note: string | null;
};

export type SituationDetail = {
  situation: PersistedSituation;
  source_records: SituationSourceRecord[];
  state_history: Array<Record<string, unknown>>;
};
function requirePersonId(requestedPersonId?: string): string {
  const activePersonId = getPersonId();
  if (!activePersonId) {
    throw new Error("A server-issued SolenOS care session is required before loading change intelligence.");
  }
  if (requestedPersonId !== undefined && requestedPersonId !== activePersonId) {
    throw new Error("The requested care record does not match the active caregiver session.");
  }
  return requestedPersonId ?? activePersonId;
}

export async function listPersistedChanges(
  subjectType?: string,
  limit = 100,
  offset = 0,
  requestedPersonId?: string,
): Promise<PersistedChange[]> {
  const personId = encodeURIComponent(requirePersonId(requestedPersonId));
  const query = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (subjectType) query.set("subject_type", subjectType);
  return await getJSON(`/change/changes/${personId}?${query.toString()}`) as PersistedChange[];
}

export async function listPersistedPatterns(
  subjectType?: string,
  limit = 100,
  offset = 0,
  requestedPersonId?: string,
): Promise<PersistedPattern[]> {
  const personId = encodeURIComponent(requirePersonId(requestedPersonId));
  const query = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (subjectType) query.set("subject_type", subjectType);
  return await getJSON(`/change/patterns/${personId}?${query.toString()}`) as PersistedPattern[];
}

export async function listPersistedSituations(requestedPersonId?: string): Promise<PersistedSituation[]> {
  const personId = encodeURIComponent(requirePersonId(requestedPersonId));
  return await getJSON(`/change/situations/${personId}`) as PersistedSituation[];
}

export async function getPersistedSituationDetail(situationId: string, requestedPersonId?: string): Promise<SituationDetail> {
  const personId = encodeURIComponent(requirePersonId(requestedPersonId));
  return await getJSON(`/change/situations/${personId}/${encodeURIComponent(situationId)}/detail`) as SituationDetail;
}

export async function transitionSituationState(
  situationId: string,
  state: SituationTrajectoryState,
  reason: string,
  evidenceIds: string[],
  requestedPersonId?: string,
): Promise<{ situation: PersistedSituation; previous_state: string; new_state: string }> {
  const personId = encodeURIComponent(requirePersonId(requestedPersonId));
  return await postJSON(
    `/change/situations/${personId}/${encodeURIComponent(situationId)}/state`,
    { state, reason, evidence_ids: evidenceIds },
  ) as { situation: PersistedSituation; previous_state: string; new_state: string };
}

export async function assessObservationCoverage(
  subjectType: string,
  windowStart: string,
  windowEnd: string,
): Promise<CoverageAssessment> {
  const personId = encodeURIComponent(requirePersonId());
  const query = new URLSearchParams({
    subject_type: subjectType,
    window_start: windowStart,
    window_end: windowEnd,
  });
  return await getJSON(`/change/coverage/${personId}?${query.toString()}`) as CoverageAssessment;
}

export async function recordObservationCoverage(input: {
  subject_type: string;
  window_start: string;
  window_end: string;
  coverage_status: CoverageStatus;
  source_evidence_ids?: string[];
  rationale: string;
}): Promise<ObservationCoverageRecord> {
  return await postJSON("/change/coverage", {
    person_id: requirePersonId(),
    source_evidence_ids: [],
    ...input,
  }) as ObservationCoverageRecord;
}

export type ChangeEvidence = {
  id: string;
  event_type: string;
  status: string;
  occurred_at: string;
  recorded_at: string | null;
  title: string;
  description: string | null;
  time_provenance: string | null;
  location_provenance: string | null;
};

export type ChangeAssertionEvidence = {
  id: string;
  subject_type: string;
  subject_id: string;
  field: string;
  assertion_kind: string;
  asserted_value: string;
  source_label: string;
  source_text: string | null;
  epistemic_state: string;
  assertion_status: string;
  observed_at: string | null;
  recorded_at: string;
  evidence_ids: string[];
};

export type ChangeObservationEvidence = {
  id: string;
  evidence_id: string;
  observation_kind: string;
  epistemic_status: string;
  subject_label: string;
  attribute: string;
  value_text: string | null;
  normalized_value: string | null;
  units: string | null;
  observed_at: string | null;
  occurred_at: string | null;
  source_passage: string;
  negated: boolean | null;
  hedge_marker: string | null;
  ambiguity_note: string | null;
};

export type ChangeDetail = {
  change: PersistedChange;
  evidence: ChangeEvidence[];
  assertions: ChangeAssertionEvidence[];
  observations: ChangeObservationEvidence[];
  confirmation_history: Array<{
    id: string;
    previous_status: string;
    new_status: string;
    actor_caregiver_id: string;
    reason: string | null;
    evidence_ids: string[];
    created_at: string;
  }>;
};

export async function getPersistedChangeDetail(changeId: string, requestedPersonId?: string): Promise<ChangeDetail> {
  const personId = encodeURIComponent(requirePersonId(requestedPersonId));
  return await getJSON(`/change/changes/${personId}/${encodeURIComponent(changeId)}`) as ChangeDetail;
}

/** Recompute persisted change/pattern assessments from the care record's actual stored events. */
export async function reassessPersistedChangeIntelligence(requestedPersonId?: string): Promise<PersistedChange[]> {
  const personId = encodeURIComponent(requirePersonId(requestedPersonId));
  return await postJSON(`/change/changes/reassess?person_id=${personId}`, {}) as PersistedChange[];
}

export type ChangeConfirmationStatus = "awaiting_confirmation" | "confirmed" | "rejected" | "inconclusive" | "resolved";

export async function transitionChangeConfirmation(
  changeId: string,
  status: ChangeConfirmationStatus,
  reason?: string,
  evidence_ids: string[] = [],
  requestedPersonId?: string,
): Promise<{ change: PersistedChange; transition_id: string; previous_status: string; new_status: string }> {
  const personId = encodeURIComponent(requirePersonId(requestedPersonId));
  return await postJSON(
    `/change/changes/${personId}/${encodeURIComponent(changeId)}/confirmation`,
    { status, reason: reason?.trim() || null, evidence_ids },
  ) as { change: PersistedChange; transition_id: string; previous_status: string; new_status: string };
}


export type PatternDetail = {
  pattern: PersistedPattern;
  events: Array<{
    id: string;
    event_type: string;
    status: string;
    occurred_at: string;
    recorded_at: string | null;
    title: string;
    description: string | null;
    evidence_ids: string[];
    time_provenance: string | null;
  }>;
  changes: Array<{
    id: string;
    change_type: string;
    change_direction: string;
    previous_state: string | null;
    current_state: string | null;
    explanation: string | null;
    evidence_ids: string[];
    confirmation_status: string;
  }>;
};

export async function getPersistedPatternDetail(patternId: string, requestedPersonId?: string): Promise<PatternDetail> {
  const personId = encodeURIComponent(requirePersonId(requestedPersonId));
  return await getJSON(
    `/change/patterns/${personId}/${encodeURIComponent(patternId)}`,
  ) as PatternDetail;
}
