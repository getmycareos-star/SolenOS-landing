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
  is_active: boolean;
};

function requirePersonId(): string {
  const personId = getPersonId();
  if (!personId) {
    throw new Error("A server-issued SolenOS care session is required before loading change intelligence.");
  }
  return personId;
}

export async function listPersistedChanges(subjectType?: string): Promise<PersistedChange[]> {
  const personId = encodeURIComponent(requirePersonId());
  const query = subjectType ? `?subject_type=${encodeURIComponent(subjectType)}` : "";
  return await getJSON(`/change/changes/${personId}${query}`) as PersistedChange[];
}

export async function listPersistedPatterns(subjectType?: string): Promise<PersistedPattern[]> {
  const personId = encodeURIComponent(requirePersonId());
  const query = subjectType ? `?subject_type=${encodeURIComponent(subjectType)}` : "";
  return await getJSON(`/change/patterns/${personId}${query}`) as PersistedPattern[];
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
  assertion_status: string;
  observed_at: string | null;
  recorded_at: string;
  evidence_ids: string[];
};

export type ChangeDetail = {
  change: PersistedChange;
  evidence: ChangeEvidence[];
  assertions: ChangeAssertionEvidence[];
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

export async function getPersistedChangeDetail(changeId: string): Promise<ChangeDetail> {
  const personId = encodeURIComponent(requirePersonId());
  return await getJSON(`/change/changes/${personId}/${encodeURIComponent(changeId)}`) as ChangeDetail;
}

/** Recompute persisted change/pattern assessments from the care record's actual stored events. */
export async function reassessPersistedChangeIntelligence(): Promise<PersistedChange[]> {
  const personId = encodeURIComponent(requirePersonId());
  return await postJSON(`/change/changes/reassess?person_id=${personId}`, {}) as PersistedChange[];
}

export type ChangeConfirmationStatus = "awaiting_confirmation" | "confirmed" | "rejected" | "inconclusive";

export async function transitionChangeConfirmation(
  changeId: string,
  status: ChangeConfirmationStatus,
  reason?: string,
  evidence_ids: string[] = [],
): Promise<{ change: PersistedChange; transition_id: string; previous_status: string; new_status: string }> {
  const personId = encodeURIComponent(requirePersonId());
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

export async function getPersistedPatternDetail(patternId: string): Promise<PatternDetail> {
  const personId = encodeURIComponent(requirePersonId());
  return await getJSON(
    `/change/patterns/${personId}/${encodeURIComponent(patternId)}`,
  ) as PatternDetail;
}
