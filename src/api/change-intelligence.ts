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
