"use client";

import Link from "next/link";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AlertCircle, RefreshCw } from "lucide-react";
import { ApiResponseError, ensureAnonymousSession, getJSON, postJSON, patchJSON } from "@/api/client";
import { selectDeferredItems, selectImmediatePriorities, selectWatchChanges } from "@/components/mvp-workspace/attention-now";
import { caregiverFieldLabel, caregiverInformationLabel, caregiverReadableCaptureText, caregiverSourceText, caregiverSafeAssistantText, caregiverSafeChangeText, caregiverSafeGeneratedText, caregiverStatusLabel } from "@/lib/caregiver-language";
import { RecordState } from "@/components/ui/RecordState";
// Advanced review panels are code-split so they do not block the first caregiver view.
const CareContinuityIntegrityPanel = dynamic(() => import("@/components/CareContinuityIntegrityPanel"), { ssr: false, loading: () => <p role="status">Loading care information…</p> });
const DementiaCareProfilePanel = dynamic(() => import("@/components/mvp-workspace/DementiaCareProfilePanel"), { ssr: false, loading: () => <p role="status">Loading care profile…</p> });
const DementiaObservationPanel = dynamic(() => import("@/components/mvp-workspace/DementiaObservationPanel"), { ssr: false, loading: () => <p role="status">Loading observations…</p> });
const EvidenceReviewPanel = dynamic(() => import("@/components/EvidenceReviewPanel"), { ssr: false, loading: () => <RecordState kind="loading" title="Loading your care information" /> });
const ClaimAssessmentPanel = dynamic(() => import("@/components/ClaimAssessmentPanel"), { ssr: false, loading: () => <RecordState kind="loading" title="Loading your care information" /> });
const ConflictResolutionPanel = dynamic(() => import("@/components/ConflictResolutionPanel"), { ssr: false, loading: () => <p role="status">Loading conflict review…</p> });
const ClarificationWorkflowPanel = dynamic(() => import("@/components/ClarificationWorkflowPanel"), { ssr: false, loading: () => <p role="status">Loading information that may need checking…</p> });

let workspaceLoadSequence = 0;


type AssignableCaregiver = { caregiver_id: string; name: string; role: string };

type RegisteredAction = {
  id: string;
  person_id: string;
  suggestion_id: string;
  source_evidence_id: string;
  source_evidence_ids?: string[] | null;
  responsible_caregiver_id?: string | null;
  created_by_caregiver_id?: string | null;
  normalized_action: string;
  original_text: string;
  action_type: string;
  status: "approved" | "in_progress" | "completed" | "cancelled" | "deferred" | "needs_clarification" | string;
  deadline?: string | null;
  approved_at?: string | null;
  completed_at?: string | null;
  deferred_until?: string | null;
  linked_reminder_due_at?: string | null;
  linked_reminder_status?: string | null;
  created_at?: string | null;
  version: number;
};

type RegisteredActionAudit = {
  id: string;
  actor_caregiver_id: string;
  previous_status?: string | null;
  new_status: string;
  reason?: string | null;
  evidence_ids: string[];
  created_at: string;
};

type CurrentCareItem = {
  id: string;
  kind: string;
  title: string;
  description?: string;
  status: string;
  epistemic_status: string;
  source_collection: string;
  source_type: string;
  source_label: string;
  reported_by_caregiver_id?: string | null;
  related_record_type?: string | null;
  related_record_id?: string | null;
  source_context?: {
    kind?: string;
    authority?: string;
    document_candidate?: {
      source_attribution?: string;
      negation_status?: string;
      modality?: string;
      conditionality?: string;
      temporal_context?: string;
      statement_kind?: string;
    };
  } | null;
  occurred_at?: string | null;
  reported_at?: string | null;
  recorded_at?: string | null;
  time_provenance?: string | null;
  evidence_ids: string[];
  evidence_link_validation?: string;
  source_span_start?: number | null;
  source_span_end?: number | null;
  source_passage?: string | null;
  supersedes_observation_id?: string | null;
  correction_rationale?: string | null;
  negated?: boolean | null;
  hedge_marker?: string | null;
  ambiguity_note?: string | null;
  extraction_method?: string | null;
  derived_observations?: Array<{
    id: string;
    observation_kind?: string | null;
    epistemic_status?: string | null;
    subject_label?: string | null;
    attribute?: string | null;
    value_text?: string | null;
    normalized_value?: string | null;
    units?: string | null;
    context?: unknown;
    observer_label?: string | null;
    observer_caregiver_id?: string | null;
    observation_method?: string | null;
    observed_at?: string | null;
    reported_at?: string | null;
    recorded_at?: string | null;
    source_span_start?: number | null;
    source_span_end?: number | null;
    source_passage?: string | null;
    negated?: boolean | null;
    hedge_marker?: string | null;
    ambiguity_note?: string | null;
    extraction_method?: string | null;
    extraction_version?: string | null;
    correction_rationale?: string | null;
  }>;
  claim_count: number;
  evidence_assessment_coverage?: string;
  evidence_assessments?: Array<{
    evidence_id: string;
    review_type: string;
    outcome: string;
    rationale: string;
    policy_version: string;
    reviewed_at?: string | null;
  }>;
};

type CareAttentionEvidenceRef = {
  source: string;
  record_id: string;
  title: string;
  occurred_at?: string | null;
  recorded_at?: string | null;
  time_provenance?: string | null;
  evidence_ids: string[];
};

type CareAttentionDecision = {
  id?: string;
  source?: string;
  record_id?: string;
  title: string;
  category: string;
  reason?: string;
  priority_basis?: string[];
  evidence_ids?: string[];
  occurred_at?: string | null;
  recorded_at?: string | null;
  time_provenance?: string | null;
  due_at?: string | null;
  review_at?: string | null;
  evidence_status?: string;
  history_completeness?: string;
  action_status?: string;
  linked_follow_up_outcome_status?: string;
  significance_assessment_status?: string;
  records?: CareAttentionEvidenceRef[];
};

type CareAttentionAssessment = {
  schema_version: string;
  status: string;
  needs_attention_now: CareAttentionDecision[];
  important_to_address: CareAttentionDecision[];
  can_wait_with_documented_basis: CareAttentionDecision[];
  needs_clarification: CareAttentionDecision[];
  counts: Record<string, number>;
  source_coverage: Record<string, unknown>;
  limitations: string[];
};

type SituationAssessment = {
  schema_version: string;
  person_id: string;
  as_of?: string | null;
  schema_status: string;
  history_coverage: string;
  coverage: {
    sources_examined: number;
    sources_with_records: number;
    records_examined: number;
    distinct_linked_evidence_ids: number;
    is_complete: boolean;
  };
  domains: Record<string, { source_names: string[]; record_count: number; evidence_state: string }>;
  cross_domain_source_links?: {
    groups: Array<{
      evidence_id: string;
      domains: string[];
      records: Array<{
        source: string;
        record_id: string;
        title: string;
        epistemic_status: string;
        event_time?: string | null;
        record_time?: string | null;
      }>;
      record_count: number;
      has_more_records: boolean;
      link_type: string;
      interpretation_limit: string;
    }>;
    count: number;
    has_more: boolean;
    source_of_truth: string;
    relationship_policy: string;
  };
  capabilities: Record<string, { source_names: string[]; record_count: number; evidence_state: string; unavailable_sources: string[] }>;
  assessment_quality?: {
    status: string;
    dimensions: Array<{ dimension: string; status: string; basis: Record<string, unknown> }>;
    blocking_limitations: string[];
    high_impact_conclusion_gate: string;
    assessment_use_status?: string;
    numeric_confidence: string;
    interpretation_policy: string;
  };
  freshness_assessment?: {
    sources: Record<string, {
      status: string;
      record_count: number;
      records_with_record_time: number;
      records_with_event_time: number;
      latest_recorded_at?: string | null;
      latest_event_at?: string | null;
      staleness_assessment: string;
      interpretation_limit: string;
    }>;
    policy: string;
  };
  priorities: Array<{ id: string; source: string; title: string; status: string; epistemic_status: string; occurred_at?: string | null; recorded_at?: string | null; time_provenance?: string | null; evidence_ids: string[] }>;
  situation_trajectory?: {
    entries: Array<{
      source: string;
      domain?: string;
      record_id: string;
      title: string;
      epistemic_status: string;
      event_time?: string | null;
      recorded_at?: string | null;
      reported_at?: string | null;
      temporal_basis: string;
      context?: unknown;
      location?: string | null;
      observer_label?: string | null;
      observation_method?: string | null;
      negated?: boolean | null;
      hedge_marker?: string | null;
      ambiguity_note?: string | null;
      evidence_ids: string[];
      interpretation_limit: string;
      window_end?: string | null;
      coverage_status?: string;
      supersedes_observation_id?: string | null;
      correction_rationale?: string | null;
    }>;
    count: number;
    has_more: boolean;
    ordering: string;
    causal_inference: string;
    source_of_truth: string;
  };
  observation_coverage?: {
    items: Array<{
      id: string;
      subject_type: string;
      window_start: string;
      window_end: string;
      coverage_status: string;
      rationale: string;
      recorded_at?: string | null;
      interpretation_limit?: string;
    }>;
    count: number;
    has_more: boolean;
    status: string;
    absence_rule: string;
    source_of_truth: string;
  };
  open_loops?: {
    items: Array<{
      id: string;
      source: string;
      version?: number | null;
      title: string;
      status: string;
      loop_type: string;
      description?: string;
      owner?: string | null;
      due_at?: string | null;
      recorded_status: string;
      status_confidence: string;
      epistemic_status: string;
      occurred_at?: string | null;
      recorded_at?: string | null;
      time_provenance?: string | null;
      evidence_ids: string[];
      priority?: string | null;
      priority_reasons?: string[];
      deferred_reason?: string | null;
      review_at?: string | null;
      deadline_source?: string | null;
      consequence_of_delay?: string | null;
      request_text?: string | null;
      verification_rule?: string | null;
      outcome_status?: string | null;
    }>;
    count: number;
    has_more: boolean;
    notice: string;
  };
  uncertainties_and_conflicts: Array<{
    id: string;
    source: string;
    title: string;
    status: string;
    epistemic_status: string;
    gap_reason?: string | null;
    subject_type?: string | null;
    subject_id?: string | null;
    field?: string | null;
    occurred_at?: string | null;
    recorded_at?: string | null;
    time_provenance?: string | null;
    evidence_ids: string[];
  }>;
  baseline_assessment?: {
    status: string;
    items: Array<{
      id: string;
      source: string;
      title: string;
      status: string;
      epistemic_status: string;
      occurred_at?: string | null;
      recorded_at?: string | null;
      time_provenance?: string | null;
      evidence_ids: string[];
      baseline_basis?: string;
      interpretation_limit?: string;
    }>;
    count: number;
    has_more: boolean;
    source_of_truth: string;
    limitation: string;
  };
  missing_information: Array<{
    id: string;
    source: string;
    title: string;
    status: string;
    epistemic_status: string;
    gap_reason?: string | null;
    description?: string | null;
    expected_by?: string | null;
    resolution_date?: string | null;
    occurred_at?: string | null;
    recorded_at?: string | null;
    time_provenance?: string | null;
    evidence_ids: string[];
  }>;
  confidence_assessment: { overall: string; limitations: string[] };
  evolution_since_previous_assessment?: {
    comparison_available: boolean;
    previous_assessment_id: string | null;
    change_count: number;
    changes: Array<{ change_type: string; source: string; record_id: string; current: Record<string, unknown> | null; previous: Record<string, unknown> | null }>;
    interpretation_limit: string;
  };
  care_attention?: CareAttentionAssessment;
  notice: string;
};

type SourceFreshness = {
  status: string;
  reassessment_recommended: boolean;
  source_of_truth: string;
  scope: string;
  read_only: boolean;
  limitation: string;
};

type SituationAssessmentResponse = {
  status: "available" | "not_assessed" | "created" | "unchanged";
  assessment_id?: string;
  assessment: SituationAssessment | null;
  source_freshness?: SourceFreshness;
};

type ChangeEvidence = {
  id: string;
  event_type: string;
  status: string;
  occurred_at: string;
  occurred_at_timezone?: string | null;
  recorded_at?: string | null;
  title: string;
  description?: string | null;
  time_provenance?: string | null;
  location_provenance?: string | null;
};

type ChangeAssertionEvidence = {
  id: string;
  subject_type: string;
  subject_id: string;
  field: string;
  assertion_kind: string;
  asserted_value: string;
  source_event_id?: string | null;
  source_label: string;
  source_text?: string | null;
  epistemic_state: string;
  assertion_status: string;
  observed_at?: string | null;
  recorded_at: string;
  time_provenance?: string | null;
  evidence_ids: string[];
};

type ChangeObservationEvidence = {
  id: string;
  evidence_id: string;
  observation_kind: string;
  epistemic_status: string;
  subject_label: string;
  attribute: string;
  value_text?: string | null;
  normalized_value?: string | null;
  units?: string | null;
  observed_at?: string | null;
  occurred_at?: string | null;
  reported_at?: string | null;
  recorded_at?: string | null;
  time_provenance?: string | null;
  observer_label?: string | null;
  observation_method?: string | null;
  source_passage: string;
};

type ChangeSourceEvidence = {
  id: string;
  type: string;
  evidence_kind?: string | null;
  epistemic_status?: string | null;
  source_text?: string | null;
  occurred_at?: string | null;
  uploaded_at?: string | null;
  ingested_at?: string | null;
  time_provenance?: string | null;
  reported_at?: string | null;
  collection_method?: string | null;
  origin_channel?: string | null;
  reported_by_label?: string | null;
  original_author?: string | null;
};

type ChangeConfirmationHistoryItem = {
  id: string;
  previous_status: string;
  new_status: string;
  actor_caregiver_id: string;
  reason?: string | null;
  evidence_ids: string[];
  created_at: string;
};

type ChangeDetail = {
  change: PersistedChange;
  evidence: ChangeEvidence[];
  assertions: ChangeAssertionEvidence[];
  observations?: ChangeObservationEvidence[];
  source_evidence?: ChangeSourceEvidence[];
  confirmation_history: ChangeConfirmationHistoryItem[];
};

type PersistedChange = {
  id: string;
  person_id: string;
  subject_type: string;
  subject_id: string;
  change_type: string;
  change_direction: string;
  previous_state?: string | null;
  current_state?: string | null;
  magnitude?: number | null;
  previous_count?: number | null;
  current_count?: number | null;
  comparison_window_start?: string | null;
  comparison_window_end?: string | null;
  persistence_days?: number | null;
  is_persistent?: boolean | null;
  confidence?: number | null;
  evidence_ids: string[];
  explanation?: string | null;
  significance_verdict?: string | null;
  attention_candidate: boolean;
  follow_up_candidate: boolean;
  confirmation_status?: string;
  is_active?: boolean;
  superseded_by_change_id?: string | null;
  created_at: string;
};

type PersistedPattern = {
  id: string;
  person_id: string;
  subject_type: string;
  subject_id: string;
  pattern_type: string;
  pattern_strength: string;
  event_ids: string[];
  change_ids?: string[] | null;
  temporal_start: string;
  temporal_end: string;
  frequency?: number | null;
  rate_per_period?: number | null;
  direction?: string | null;
  confidence?: number | null;
  evidence_count: number;
  alternative_interpretations?: unknown[] | null;
  is_active: boolean;
  superseded_by_pattern_id?: string | null;
};

type CurrentCareProjection = {
  person_id: string;
  as_of?: string | null;
  projection_type: string;
  read_only: boolean;
  history_coverage: string;
  schema_status: string;
  missing_required_sources: string[];
  missing_optional_sources: string[];
  items: CurrentCareItem[];
  item_count: number;
  has_more: boolean;
  outcomes?: CurrentCareItem[];
  outcomes_has_more?: boolean;
  source_coverage?: Record<string, {
    status?: string;
    returned_count?: number;
    candidate_count?: number;
    has_more?: boolean;
    limit?: number;
    offset?: number;
    next_offset?: number | null;
    returned_history_complete?: boolean;
    error_code?: string | null;
    required?: boolean;
  }>;
  requested_sources?: string[];
  failed_sources?: string[];
  notice: string;
};

type EvidenceIntegrity = {
  fact_id: string;
  linked_evidence_count: number;
  distinct_nonempty_content_count: number;
  duplicate_content_candidates: Array<{ fingerprint: string; evidence_ids: string[]; interpretation: string }>;
  near_duplicate_analysis?: {
    status: string;
    algorithm_version: string;
    candidate_groups: Array<{ evidence_ids: string[]; candidate_basis: string; interpretation: string }>;
    records_considered: number;
    records_available: number;
    interpretation_limit: string;
  };
  independent_corroboration_status: string;
  interpretation_limit: string;
};

const DOCUMENT_ASSERTION_LABELS: Record<string, string> = {
  document_medication_statement: "Medication information from document",
  document_allergy_statement: "Allergy information from document",
  document_diagnosis_statement: "Diagnosis information from document",
  document_appointment_statement: "Appointment information from document",
  document_care_event_statement: "Care event from document",
  document_observation_statement: "Observation from document",
}

const CURRENT_CARE_TITLE_LABELS: Readonly<Record<string, string>> = {
  "structured daily capture": "Daily care update",
  "daily care entry": "Daily care note",
  "daily capture": "Daily care update",
};

function documentStatementContextLabels(item: CurrentCareItem): string[] {
  if (item.source_collection !== "assertions") return [];
  const candidate = item.source_context?.document_candidate;
  if (!candidate) return [];
  const labels: string[] = [];
  if (candidate.source_attribution === "patient_reported") labels.push("Reported by the patient");
  if (candidate.source_attribution === "caregiver_reported") labels.push("Reported by a family caregiver");
  if (candidate.source_attribution === "professional_observed") labels.push("Observed by a care professional");
  if (candidate.source_attribution === "professional_documented") labels.push("Documented by a care professional");
  if (candidate.negation_status === "explicitly_negated") labels.push("Says this did not happen");
  if (candidate.modality === "tentative") labels.push("Not certain");
  if (candidate.conditionality === "conditional") labels.push("Only applies in some situations");
  if (candidate.temporal_context === "historical") labels.push("Historical information");
  if (candidate.temporal_context === "changed_over_time") labels.push("Describes a change from an earlier state");
  if (candidate.statement_kind === "recommendation") labels.push("A recommendation; no result has been recorded yet.");
  return labels;
}

function displayCurrentCareTitle(item: CurrentCareItem): string {
  const title = item.title?.trim().toLowerCase() || "";
  return DOCUMENT_ASSERTION_LABELS[item.title || ""] ||
    CURRENT_CARE_TITLE_LABELS[title] ||
    caregiverSourceText(item.title) ||
    caregiverLabel(item.kind) ||
    "Saved care detail";
}

function isMedicationObservation(attribute?: string | null): boolean {
  return /medication|medicine|drug|prescription|dose|strength/i.test(attribute || "");
}

function displayCurrentCareObservationValue(attribute?: string | null, rawValue?: unknown): string | null {
  const value = caregiverSafeAssistantText(rawValue);
  if (!value) return null;
  const field = (attribute || "").trim().toLowerCase();
  if (field === "medication_status") {
    const normalized = value.trim().toLowerCase();
    if (["active", "current", "currently active"].includes(normalized)) return "Reported as current";
    if (["inactive", "discontinued", "stopped", "no longer taking"].includes(normalized)) return "Reported as no longer current";
    if (["unknown", "uncertain", "not confirmed"].includes(normalized)) return "Not confirmed";
    return "Reported status: " + value;
  }
  // A medication name or amount extracted from a caregiver note is not a
  // verified prescription. Label the value as reported at the point where it
  // is displayed, rather than relying only on a disclaimer above the list.
  if (isMedicationObservation(field)) {
    if (/dose|strength|amount/i.test(field)) return "Reported amount: " + value;
    if (/name|drug/i.test(field)) return "Reported medication: " + value;
    return "Reported medication detail: " + value;
  }
  return value;
}
function displayCurrentCareDescription(item: CurrentCareItem): string | null {
  if (!item.description?.trim()) return null;
  const original = item.description.trim().toLowerCase();
  const originalTitle = item.title?.trim().toLowerCase() || "";
  if (original && originalTitle && original === originalTitle) return null;
  const description = displayDescription(item.description);
  const normalizedDescription = description.trim().toLowerCase();
  if (["no description was recorded.", "saved care information"].includes(normalizedDescription)) return null;
  return normalizedDescription === displayCurrentCareTitle(item).trim().toLowerCase()
    ? null
    : description;
}

function displayDescription(value?: string | null): string {
  if (!value?.trim()) return "No description was recorded.";
  return caregiverReadableCaptureText(value) || "Saved care information";
}

function formatWhen(value?: string | null): string {
  if (!value) return "Time not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Time not recorded"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function eventTimeLabel(value?: string | null, provenance?: string | null): string {
  if (provenance === "server_recorded_at" || provenance === "entry_time_defaulted") return "Not provided";
  return formatWhen(value);
}

const CAREGIVER_LABELS: Record<string, string> = {
  unknown: "Not yet known",
  not_assessed: "Not checked yet",
  not_recorded: "Not recorded",
  inferred: "Possible explanation",
  onset: "First reported",
  cessation: "No longer reported",
  increase: "Increase recorded",
  decrease: "Decrease recorded",
  transition: "Changed",
  persistence: "Continued over time",
  fluctuation: "Changed over time",
  stabilization: "More steady over time",
  recovery: "Recorded as improving",
  disappearance: "No longer recorded",
  trend: "Change over time",
  acceleration: "Changing faster",
  clustering: "Several care updates close together",
  instability: "Changes over time",
  deviation: "Different from usual",
  convergence: "Similar changes in different areas",
  divergence: "Different changes in different areas",
  emerging: "Early sign",
  established: "Seen more than once",
  weak: "Limited information",
  none: "No clear repeated change",
  meaningful_candidate: "May be important",
  not_meaningful: "No clear importance found",
  insufficient_evidence: "Not enough information to tell",
  increasing: "Increasing",
  decreasing: "Decreasing",
  stable: "No change recorded",
  fluctuating: "Changing over time",
  missing: "Not recorded",
  unverified: "Not confirmed",
  uncertain: "Still unclear",
  caregiver_reported: "Reported by a caregiver",
  reported: "Reported",
  observed: "Observed",
  confirmed: "Confirmed",
  disputed: "Reports do not match",
  needs_clarification: "Needs checking",
  awaiting_confirmation: "Needs review",
  detected: "Found in saved information",
  inconclusive: "Could not be confirmed",
  accepted: "Reviewed",
  rejected: "Not supported",
  superseded: "Replaced by a newer review",
  active: "Current",
  inactive: "No longer current",
  emergence: "First recorded",
  frequency_increase: "Recorded more often",
  frequency_decrease: "Recorded less often",
  recurrence: "Repeated",
  temporal_clustering: "Several care updates close together",
  medication: "Medication",
  mobility: "Movement",
  care_recipient: "Person receiving care",
  daily_care: "Daily care",
  structured_daily_capture: "Daily care update",
  daily_care_entry: "Daily care note",
  daily_capture: "Daily care update",
};

function caregiverLabel(value?: string | null): string {
  if (!value?.trim()) return "Not recorded";
  const normalized = value.trim().toLowerCase();
  return CAREGIVER_LABELS[normalized] ?? caregiverStatusLabel(normalized) ?? "Care information";
}

const HISTORY_SOURCE_LABELS: Record<string, string> = {
  events: "Daily Care",
  care_events: "Care updates",
  evidence: "Notes and documents",
  documents: "Documents",
  document_extractions: "Document details",
  facts: "Saved care details",
  care_facts: "Saved care details",
  assertions: "Caregiver reports",
  care_assertions: "Caregiver reports",
  caregiver_observations: "What caregivers noticed",
  professional_reports: "Healthcare professional reports",
  appointments: "Appointments",
  handoffs: "Care updates shared with another caregiver",
  decisions: "Care decisions",
  decision_outcomes: "What happened after a decision",
  action_outcomes: "Follow-up results",
  open_loop_records: "Follow-ups",
  open_loop_events: "Follow-up history",
  open_loop_occurrences: "Repeated follow-ups",
  follow_up_links: "Follow-up results",
  information_gaps: "Information still needed",
  uncertainty_assessments: "Details that need checking",
  conflicts: "Reports that do not match",
  reconciliations: "Information checked against other reports",
};

function historySourceLabel(source: string): string {
  return HISTORY_SOURCE_LABELS[source] ?? "Care information";
}

function missingInformationReasonLabel(reason?: string | null, epistemicStatus?: string | null): string {
  const normalizedReason = String(reason ?? "").trim().toLowerCase();
  if (normalizedReason) {
    switch (normalizedReason) {
      case "not_provided": return "Not provided";
      case "not_documented": return "Not recorded";
      case "not_assessed": return "Not checked yet";
      case "absent": return "Recorded as absent";
      case "not_yet_observed": return "Not observed yet";
      case "ambiguous": return "Unclear";
      case "conflicting": return "Reports do not match";
      case "low_quality": return "Source needs checking";
      case "outdated": return "May be out of date";
      case "missing_context": return "More context needed";
      case "expected_but_unavailable": return "Expected information unavailable";
      case "insufficient_evidence": return "Not enough information to confirm";
      case "inaccessible": return "Source unavailable";
    }
  }
  switch (String(epistemicStatus ?? "").trim().toLowerCase()) {
    case "unknown": return "Unknown";
    case "not_assessed": return "Not checked yet";
    case "not_documented": return "Not recorded";
    case "not_verified":
    case "unverified": return "Not verified";
    case "partially_known": return "Partly known";
    case "ambiguous": return "Unclear";
    case "conflicting": return "Reports do not match";
    case "stale": return "May be out of date";
    default: return "Needs checking";
  }
}

export function LCRCurrentUnderstanding({ showNextStep = false, viewMode = "complete" }: { showNextStep?: boolean; viewMode?: "today" | "complete" } = {}) {
  const [personId, setPersonId] = useState("");
  const personIdRef = useRef("");
  const caregiverIdRef = useRef("");
  const [currentCaregiverId, setCurrentCaregiverId] = useState("");
  const [assignableCaregivers, setAssignableCaregivers] = useState<AssignableCaregiver[]>([]);
  const [responsibleCaregiverId, setResponsibleCaregiverId] = useState("");
  const [registeredActions, setRegisteredActions] = useState<RegisteredAction[]>([]);
  const [registeredActionsError, setRegisteredActionsError] = useState<string | null>(null);
  const [reviewingSuggestionId, setReviewingSuggestionId] = useState<string | null>(null);
  const [actionApprovalLoadingId, setActionApprovalLoadingId] = useState<string | null>(null);
  const [actionApprovalError, setActionApprovalError] = useState<string | null>(null);
  const [suggestionDispositionReasons, setSuggestionDispositionReasons] = useState<Record<string, string>>({});
  const [createReminderForSuggestion, setCreateReminderForSuggestion] = useState(false);
  const [reminderDueInput, setReminderDueInput] = useState("");
  const [actionTransitionReasons, setActionTransitionReasons] = useState<Record<string, string>>({});
  const [actionDeferredUntil, setActionDeferredUntil] = useState<Record<string, string>>({});
  const [actionTransitionLoadingId, setActionTransitionLoadingId] = useState<string | null>(null);
  const [actionTransitionErrors, setActionTransitionErrors] = useState<Record<string, string>>({});
  const [actionHistory, setActionHistory] = useState<Record<string, RegisteredActionAudit[]>>({});
  const [actionHistoryErrors, setActionHistoryErrors] = useState<Record<string, string>>({});
  const [projection, setProjection] = useState<CurrentCareProjection | null>(null);
  const [sourceRetrying, setSourceRetrying] = useState<string | null>(null);
  const [evidenceReviewOpen, setEvidenceReviewOpen] = useState(false);
  const [claimAssessmentOpen, setClaimAssessmentOpen] = useState(false);
  const [conflictReviewOpen, setConflictReviewOpen] = useState(false);
  const [recordHistoryOpen, setRecordHistoryOpen] = useState(false);
  const [dementiaProfileOpen, setDementiaProfileOpen] = useState(false);
  const evidenceReviewDetailsRef = useRef<HTMLDetailsElement | null>(null);
  const claimAssessmentDetailsRef = useRef<HTMLDetailsElement | null>(null);
  const conflictReviewDetailsRef = useRef<HTMLDetailsElement | null>(null);
  const recordHistoryDetailsRef = useRef<HTMLDetailsElement | null>(null);
  const [clarificationOpen, setClarificationOpen] = useState(false);
  const clarificationDetailsRef = useRef<HTMLDetailsElement | null>(null);
  const openClarification = useCallback(() => {
    if (clarificationDetailsRef.current) clarificationDetailsRef.current.open = true;
    setClarificationOpen(true);
  }, []);
  useEffect(() => {
    // Preserve native disclosures opened before React finishes hydrating.
    // Without this sync, a fast first click can leave a visible section empty.
    if (evidenceReviewDetailsRef.current?.open) setEvidenceReviewOpen(true);
    if (claimAssessmentDetailsRef.current?.open) setClaimAssessmentOpen(true);
    if (conflictReviewDetailsRef.current?.open) setConflictReviewOpen(true);
    if (recordHistoryDetailsRef.current?.open) setRecordHistoryOpen(true);
    if (clarificationDetailsRef.current?.open) setClarificationOpen(true);
  }, []);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assessment, setAssessment] = useState<SituationAssessment | null>(null);
  const [sourceFreshness, setSourceFreshness] = useState<SourceFreshness | null>(null);
  const [assessmentLoading, setAssessmentLoading] = useState(false);
  const [assessmentError, setAssessmentError] = useState<string | null>(null);
  const [changes, setChanges] = useState<PersistedChange[]>([]);
  const [changesLoading, setChangesLoading] = useState(false);
  const [changesError, setChangesError] = useState<string | null>(null);
  const [patterns, setPatterns] = useState<PersistedPattern[]>([]);
  const [patternsError, setPatternsError] = useState<string | null>(null);
  const [expandedChangeId, setExpandedChangeId] = useState<string | null>(null);
  const [changeEvidence, setChangeEvidence] = useState<Record<string, {
    evidence: ChangeEvidence[];
    assertions: ChangeAssertionEvidence[];
    observations: ChangeObservationEvidence[];
    source_evidence: ChangeSourceEvidence[];
    confirmation_history: ChangeConfirmationHistoryItem[];
    missing_source_count?: number;
    error?: string;
  }>>({});
  const [evidenceLoadingId, setEvidenceLoadingId] = useState<string | null>(null);
  const [confirmationReason, setConfirmationReason] = useState<Record<string, string>>({});
  const [confirmationError, setConfirmationError] = useState<Record<string, string>>({});
  const [confirmationLoadingId, setConfirmationLoadingId] = useState<string | null>(null);
  const [evidenceIntegrityByFact, setEvidenceIntegrityByFact] = useState<Record<string, EvidenceIntegrity>>({});
  const [evidenceIntegrityLoadingId, setEvidenceIntegrityLoadingId] = useState<string | null>(null);
  const [evidenceIntegrityErrors, setEvidenceIntegrityErrors] = useState<Record<string, string>>({});

  const loadEvidenceIntegrity = useCallback(async (factId: string) => {
    setEvidenceIntegrityLoadingId(factId);
    setEvidenceIntegrityErrors(current => ({ ...current, [factId]: "" }));
    try {
      const result = await getJSON(`/care-continuity/facts/${encodeURIComponent(factId)}/evidence-integrity`);
      if (!result || result.fact_id !== factId || !Array.isArray(result.duplicate_content_candidates) ||
          typeof result.independent_corroboration_status !== "string") {
        throw new Error("Invalid evidence-integrity response");
      }
      setEvidenceIntegrityByFact(current => ({ ...current, [factId]: result as EvidenceIntegrity }));
    } catch {
      setEvidenceIntegrityErrors(current => ({ ...current, [factId]: "Related information could not be loaded. SolenOS has not assumed that the reports are separate. Try again when you have a connection." }));
    } finally {
      setEvidenceIntegrityLoadingId(current => current === factId ? null : current);
    }
  }, []);

  const refreshSituationAssessment = useCallback(async (): Promise<boolean> => {
    setAssessmentLoading(true);
    setAssessmentError(null);
    try {
      const session = await ensureAnonymousSession();
      const scopedPersonId = session.person?.id;
      if (!scopedPersonId) {
        throw new Error("The active record could not be confirmed.");
      }
      const current = await postJSON(
        "/care-continuity/situation-understanding/reassess",
        {},
      ) as SituationAssessmentResponse;
      if (current.assessment?.person_id === scopedPersonId) {
        setAssessment(current.assessment);
        setSourceFreshness(current.source_freshness ?? null);
        setAssessmentError(null);
        return true;
      } else {
        throw new Error("The refreshed care summary did not match the active care record.");
      }
    } catch {
      setAssessmentError("The latest care summary could not be refreshed. The last saved view is shown and may be out of date.");
      return false;
    } finally {
      setAssessmentLoading(false);
    }
  }, []);

  const retryHistorySource = useCallback(async (sourceName: string) => {
    setSourceRetrying(sourceName);
    try {
      const session = await ensureAnonymousSession();
      const scopedPersonId = session.person?.id;
      if (!scopedPersonId) throw new Error("The active care record could not be confirmed.");
      const response = await getJSON(
        `/care-continuity/current-care?limit_per_source=12&source=${encodeURIComponent(sourceName)}`,
      ) as CurrentCareProjection;
      const refreshedCoverage = response.source_coverage?.[sourceName];
      if (
        response.person_id !== scopedPersonId ||
        response.read_only !== true ||
        !Array.isArray(response.items) ||
        response.requested_sources?.length !== 1 ||
        response.requested_sources[0] !== sourceName ||
        !refreshedCoverage
      ) {
        throw new Error("The refreshed care-history source did not match this care record.");
      }
      setProjection((current) => {
        if (!current || current.person_id !== scopedPersonId) return current;
        const retained = current.items.filter((item) => item.source_collection !== sourceName);
        const merged = new Map<string, CurrentCareItem>();
        for (const item of [...retained, ...response.items]) {
          merged.set(`${item.source_collection}:${item.id}`, item);
        }
        const coverage = {
          ...(current.source_coverage ?? {}),
          [sourceName]: refreshedCoverage,
        };
        const sourceStatus = refreshedCoverage.status;
        const failed = new Set(current.failed_sources ?? []);
        if (["failed", "partial", "unsearchable", "unavailable_schema", "unavailable_scope"].includes(sourceStatus ?? "")) {
          failed.add(sourceName);
        } else {
          failed.delete(sourceName);
        }
        const missingRequired = new Set(current.missing_required_sources);
        const missingOptional = new Set(current.missing_optional_sources);
        if (sourceStatus === "unavailable_schema" || sourceStatus === "unavailable_scope") {
          if (refreshedCoverage.required) missingRequired.add(sourceName);
          else missingOptional.add(sourceName);
        } else {
          missingRequired.delete(sourceName);
          missingOptional.delete(sourceName);
        }
        return {
          ...current,
          items: [...merged.values()].slice(0, 12),
          item_count: Math.min(merged.size, 12),
          has_more: current.has_more || response.has_more,
          source_coverage: coverage,
          failed_sources: [...failed],
          missing_required_sources: [...missingRequired],
          missing_optional_sources: [...missingOptional],
        };
      });
    } catch {
      setProjection((current) => {
        if (!current) return current;
        return {
          ...current,
          failed_sources: [...new Set([...(current.failed_sources ?? []), sourceName])],
          source_coverage: {
            ...(current.source_coverage ?? {}),
            [sourceName]: {
              ...(current.source_coverage?.[sourceName] ?? {}),
              status: current.source_coverage?.[sourceName]?.returned_count
                ? "stale"
                : "failed",
              error_code: "retry_failed",
            },
          },
        };
      });
    } finally {
      setSourceRetrying((current) => current === sourceName ? null : current);
    }
  }, []);

  const load = useCallback(async (manual = false) => {
    const timingId = ++workspaceLoadSequence;
    const isCurrentRequest = () => timingId === workspaceLoadSequence;
    const timingStart = `solenos-workspace-start-${timingId}`;
    const timingReady = `solenos-workspace-ready-${timingId}`;
    if (typeof performance !== "undefined" && typeof performance.mark === "function") {
      try { performance.mark(timingStart); } catch { /* Instrumentation is optional. */ }
    }
    if (manual) setRefreshing(true);
    else {
      setLoading(true);
      setRegisteredActions([]);
      setProjection(null);
      setChanges([]);
      setPatterns([]);
      setAssessment(null);
      setSourceFreshness(null);
    }
    setError(null);
    setRegisteredActionsError(null);
    setChangesLoading(true);
    setAssessmentLoading(true);
    setChangesError(null);
    setPatternsError(null);
    setAssessmentError(null);
    let backgroundStarted = false;
    let sessionConfirmed = false;

    try {
      const session = await ensureAnonymousSession();
      if (!isCurrentRequest()) return;
      if (!session.access_token || !session.person?.id) {
        throw new Error("Your care information is not available right now. Refresh the page and try again.");
      }
      sessionConfirmed = true;
      const scopedPersonId = session.person.id;
      if (personIdRef.current && (personIdRef.current !== scopedPersonId || caregiverIdRef.current !== session.caregiver.id)) {
        setProjection(null);
        setRegisteredActions([]);
        setChanges([]);
        setPatterns([]);
        setAssessment(null);
        setSourceFreshness(null);
        setActionHistory({});
        setChangeEvidence({});
        setEvidenceIntegrityByFact({});
        setEvidenceIntegrityErrors({});
        setEvidenceIntegrityLoadingId(null);
        setExpandedChangeId(null);
        setEvidenceLoadingId(null);
        setConfirmationReason({});
        setConfirmationError({});
        setConfirmationLoadingId(null);
      }
      personIdRef.current = scopedPersonId;
      caregiverIdRef.current = session.caregiver.id;
      setPersonId(scopedPersonId);
      setCurrentCaregiverId(session.caregiver.id);
      setResponsibleCaregiverId(session.caregiver.id);

      // The caregiver's first useful screen depends only on this scoped,
      // read-only projection. No secondary query or write blocks its display.
      const currentCare = await getJSON("/care-continuity/current-care?limit_per_source=12");
      if (!isCurrentRequest()) return;
      if (!currentCare || currentCare.read_only !== true || !Array.isArray(currentCare.items) ||
          typeof currentCare.schema_status !== "string" || typeof currentCare.projection_type !== "string" ||
          currentCare.person_id !== scopedPersonId) {
        throw new Error("The current-care response did not match this session's record contract. No care state has been assumed.");
      }
      setProjection(currentCare as CurrentCareProjection);
      if (typeof performance !== "undefined" && typeof performance.mark === "function") {
        try {
          performance.mark(timingReady);
          performance.measure("solenos.workspace.first-care-ready", { start: timingStart, end: timingReady });
          if (performance.getEntriesByName("solenos.journey.landing-cta", "mark").length > 0) {
            performance.measure("solenos.journey.landing-to-first-care", {
              start: "solenos.journey.landing-cta",
              end: timingReady,
            });
            performance.clearMarks("solenos.journey.landing-cta");
          }
          performance.clearMarks(timingStart);
          performance.clearMarks(timingReady);
        } catch {
          // Local timing instrumentation must never affect care-record loading.
        }
      }
      setLoading(false);
      backgroundStarted = true;

      // Initial hydration is read-only. Reassessment is a caregiver-triggered
      // action, never an automatic write every time the workspace is opened.
      const backgroundTasks = [
        ...(viewMode === "complete" ? [
          (async () => {
            try {
              const members = await getJSON("/caregiver-access/assignable-members");
              if (!isCurrentRequest()) return;
              if (!Array.isArray(members) || members.some((member) => !member?.caregiver_id || !member?.name)) {
                throw new Error("Assignable caregiver response was invalid.");
              }
              setAssignableCaregivers(members as AssignableCaregiver[]);
            } catch {
              if (!isCurrentRequest()) return;
              setAssignableCaregivers([]);
              setResponsibleCaregiverId(session.caregiver.id);
            }
          })(),
          (async () => {
            try {
              const savedActions = await getJSON(`/registered-actions/${encodeURIComponent(scopedPersonId)}`);
              if (!isCurrentRequest()) return;
              if (!Array.isArray(savedActions) || savedActions.some((item) => item?.person_id !== scopedPersonId)) {
                throw new Error("Saved actions did not match this care record.");
              }
              setRegisteredActions(savedActions as RegisteredAction[]);
              setRegisteredActionsError(null);
            } catch {
              if (!isCurrentRequest()) return;
              setRegisteredActionsError("Agreed actions could not be loaded. Please try again.");
            }
          })(),
        ] : []),
        (async () => {
          const validateChanges = (value: unknown): PersistedChange[] => {
            if (!Array.isArray(value) || value.some((item) => item?.person_id !== scopedPersonId)) {
              throw new Error("The saved change history does not match this care record.");
            }
            return value as PersistedChange[];
          };
          try {
            const savedChanges = await getJSON(`/change/changes/${encodeURIComponent(scopedPersonId)}`);
            if (!isCurrentRequest()) return;
            setChanges(validateChanges(savedChanges));
            setChangesError(null);
          } catch {
            if (!isCurrentRequest()) return;
            setChangesError("Saved care changes could not be loaded. Please try again.");
          } finally {
            if (isCurrentRequest()) setChangesLoading(false);
          }
        })(),
        ...(viewMode === "complete" ? [
          (async () => {
            try {
              const persistedPatterns = await getJSON(`/change/patterns/${encodeURIComponent(scopedPersonId)}`);
              if (!isCurrentRequest()) return;
              if (!Array.isArray(persistedPatterns) || persistedPatterns.some((item) => item?.person_id !== scopedPersonId)) {
                throw new Error("The saved repeated-change information did not match the active care record.");
              }
              setPatterns(persistedPatterns as PersistedPattern[]);
              setPatternsError(null);
            } catch {
              if (!isCurrentRequest()) return;
              setPatternsError("Repeated changes could not be loaded. Please try again.");
            }
          })(),
        ] : []),
        (async () => {
          try {
            const saved = await getJSON("/care-continuity/situation-understanding") as SituationAssessmentResponse;
            if (!isCurrentRequest()) return;
            const savedNeedsReassessment = saved.source_freshness?.reassessment_recommended === true;
            const savedBelongsToPerson = saved.assessment?.person_id === scopedPersonId;
            if (savedBelongsToPerson) {
              setAssessment(saved.assessment);
              setSourceFreshness(saved.source_freshness ?? null);
              if (savedNeedsReassessment) {
                // Hydration remains read-only; the caregiver can request a refresh explicitly.
              }
              setAssessmentError(null);
            } else if (saved.status === "not_assessed" && !saved.assessment) {
              setAssessment(null);
              setSourceFreshness(saved.source_freshness ?? null);
              setAssessmentError(null);
            } else {
              setAssessment(null);
              setSourceFreshness(null);
              setAssessmentError("The saved care summary could not be loaded. Some care information may be missing.");
            }
          } catch {
            if (!isCurrentRequest()) return;
            setAssessmentError("The saved care summary could not be loaded. Please try again.");
          } finally {
            if (isCurrentRequest()) setAssessmentLoading(false);
          }
        })(),
      ];
      const backgroundWork = Promise.allSettled(backgroundTasks).finally(() => { if (isCurrentRequest()) setRefreshing(false); });
      if (manual) await backgroundWork;
      else void backgroundWork;
    } catch {
      if (!isCurrentRequest()) return;
      if (!sessionConfirmed) {
        const accessMessage = "We couldn't confirm your access to the Care Record. Refresh the page and try again.";
        setPersonId("");
        setCurrentCaregiverId("");
        setAssignableCaregivers([]);
        setResponsibleCaregiverId("");
        setRegisteredActions([]);
        setRegisteredActionsError(accessMessage);
        setReviewingSuggestionId(null);
        setActionApprovalLoadingId(null);
        setActionApprovalError(null);
        setSuggestionDispositionReasons({});
        setCreateReminderForSuggestion(false);
        setReminderDueInput("");
        setActionTransitionReasons({});
        setActionDeferredUntil({});
        setActionTransitionLoadingId(null);
        setActionTransitionErrors({});
        setActionHistory({});
        setActionHistoryErrors({});
        setProjection(null);
        setSourceRetrying(null);
        setAssessment(null);
        setSourceFreshness(null);
        setAssessmentError(null);
        setChanges([]);
        setChangesError(null);
        setPatterns([]);
        setPatternsError(null);
        setExpandedChangeId(null);
        setChangeEvidence({});
        setEvidenceLoadingId(null);
        setConfirmationReason({});
        setConfirmationError({});
        setConfirmationLoadingId(null);
        setEvidenceIntegrityByFact({});
        setEvidenceIntegrityLoadingId(null);
        setEvidenceIntegrityErrors({});
        setEvidenceReviewOpen(false);
        setClaimAssessmentOpen(false);
        setConflictReviewOpen(false);
        setRecordHistoryOpen(false);
        setDementiaProfileOpen(false);
        setClarificationOpen(false);
        personIdRef.current = "";
        caregiverIdRef.current = "";
        setError(accessMessage);
      } else {
        if (!manual) {
          setPersonId("");
          setCurrentCaregiverId("");
          setProjection(null);
          setRegisteredActions([]);
          setChanges([]);
          setPatterns([]);
          setAssessment(null);
          setSourceFreshness(null);
          personIdRef.current = "";
          caregiverIdRef.current = "";
        }
        setError("The care history could not be loaded. Your previously saved information is still shown when available. Please try again.");
      }
    } finally {
      if (isCurrentRequest()) {
        setLoading(false);
        if (!backgroundStarted) {
          setChangesLoading(false);
          setAssessmentLoading(false);
          setRefreshing(false);
        }
      }
    }
  }, [viewMode]);

  const transitionConfirmation = useCallback(async (
    change: PersistedChange,
    status: "awaiting_confirmation" | "confirmed" | "rejected" | "inconclusive",
  ) => {
    setConfirmationLoadingId(change.id);
    setConfirmationError((previous) => ({ ...previous, [change.id]: "" }));
    try {
      const session = await ensureAnonymousSession();
      if (!session.person?.id || session.person.id !== change.person_id) {
        throw new Error("The selected change does not belong to the active care-record session.");
      }
      const enteredReason = (confirmationReason[change.id] || "").trim();
      if ((status === "rejected" || status === "inconclusive") && !enteredReason) {
        throw new Error("Add a note before disputing this change or saying you cannot confirm it.");
      }
      if (status === "confirmed" && (!Array.isArray(change.evidence_ids) || change.evidence_ids.length === 0)) {
        throw new Error("This change has no linked saved information to review yet.");
      }
      // The API requires an auditable rationale for a confirmation. When the
      // caregiver chooses Confirm without adding a note, record the action itself
      // rather than forcing another piece of work onto the caregiver.
      const reason = enteredReason || (status === "confirmed"
        ? "Caregiver selected Confirm after reviewing the available saved information."
        : "");
      const saved = await postJSON(
        `/change/changes/${encodeURIComponent(session.person.id)}/${encodeURIComponent(change.id)}/confirmation`,
        { status, reason: reason || null, evidence_ids: change.evidence_ids },
      ) as { change?: PersistedChange; new_status?: string };
      if (!saved?.change || saved.change.id !== change.id ||
          saved.change.person_id !== session.person.id ||
          saved.change.confirmation_status !== status || saved.new_status !== status) {
        throw new Error("The saved review could not be verified.");
      }
      // The write response is authoritative for this operation. Reflect it before
      // attempting a separate history refresh, so a refresh outage cannot turn a
      // successful save into a false "could not save" message.
      setChanges((previous) => {
        const found = previous.some((item) => item.id === change.id);
        return found
          ? previous.map((item) => item.id === change.id ? saved.change! : item)
          : [saved.change!, ...previous];
      });
      try {
        const refreshed = await getJSON(
          `/change/changes/${encodeURIComponent(session.person.id)}`
        ) as PersistedChange[];
        if (!Array.isArray(refreshed) || refreshed.some((item) => item.person_id !== session.person.id)) {
          throw new Error("The refreshed change history did not match the active care-record session.");
        }
        setChanges(refreshed);
      } catch {
        setConfirmationError((previous) => ({
          ...previous,
          [change.id]: "Your review was saved, but the care history could not be refreshed. Refresh the page to see the latest information.",
        }));
      }
    } catch (cause) {
      const status = cause && typeof cause === "object" && "status" in cause &&
        typeof (cause as { status?: unknown }).status === "number"
        ? (cause as { status: number }).status
        : null;
      const message = status === 401 || status === 403
        ? "Your access needs to be refreshed. Reopen your record and try again."
        : status === 404
          ? "This possible change is no longer available in this care record. Refresh your care history."
          : status === 409
            ? "This possible change has already been updated. Refresh your care history and review the latest information."
            : status === 422
              ? "The review was not accepted. Check the saved information and any note you entered, then try again."
              : "We couldn’t confirm whether your review was saved. Refresh your care history before trying again. If the review appears there, you do not need to submit it again.";
      setConfirmationError((previous) => ({
        ...previous,
        [change.id]: message,
      }));
    } finally {
      setConfirmationLoadingId(null);
    }
  }, [confirmationReason]);

  const loadChangeEvidence = useCallback(async (change: PersistedChange) => {
    if (expandedChangeId === change.id) {
      setExpandedChangeId(null);
      return;
    }
    setExpandedChangeId(change.id);
    const cached = changeEvidence[change.id];
    if (cached) return;
    setEvidenceLoadingId(change.id);
    try {
      const session = await ensureAnonymousSession();
      if (!session.person?.id || session.person.id !== change.person_id) {
        throw new Error("The selected change does not belong to the active care-record session.");
      }
      const result = await getJSON(
        `/change/changes/${encodeURIComponent(session.person.id)}/${encodeURIComponent(change.id)}`
      ) as ChangeDetail;
      if (!result?.change || result.change.id !== change.id ||
          result.change.person_id !== session.person.id || !Array.isArray(result.evidence) ||
          !Array.isArray(result.assertions) || !Array.isArray(result.confirmation_history)) {
        throw new Error("The returned source information did not match the saved change review.");
      }
      const observations = Array.isArray(result.observations) ? result.observations : [];
      const sourceEvidence = Array.isArray(result.source_evidence) ? result.source_evidence : [];
      const returnedSourceIds = [
        ...result.evidence.map((item) => item.id),
        ...result.assertions.map((item) => item.id),
        ...observations.map((item) => item.id),
        ...sourceEvidence.map((item) => item.id),
      ];
      if (returnedSourceIds.some((id) => !change.evidence_ids.includes(id))) {
        throw new Error("The returned source information did not match the saved change review.");
      }
      const returnedSourceIdSet = new Set(returnedSourceIds);
      const missingSourceCount = change.evidence_ids.filter((id) => !returnedSourceIdSet.has(id)).length;
      setChangeEvidence((previous) => ({
        ...previous,
        [change.id]: {
          evidence: result.evidence,
          assertions: result.assertions,
          observations,
          source_evidence: sourceEvidence,
          confirmation_history: result.confirmation_history,
          missing_source_count: missingSourceCount,
        },
      }));
    } catch (cause) {
      setChangeEvidence((previous) => ({
        ...previous,
        [change.id]: {
          evidence: [],
          assertions: [],
          observations: [],
          source_evidence: [],
          confirmation_history: [],
          missing_source_count: change.evidence_ids.length,
          error: "Supporting information could not be loaded.",
        },
      }));
    } finally {
      setEvidenceLoadingId(null);
    }
  }, [changeEvidence, expandedChangeId]);

  const refreshWholeRecord = useCallback(async () => {
    const assessmentUpdated = await refreshSituationAssessment();
    await load(true);
    if (!assessmentUpdated) {
      setAssessmentError("The latest care summary could not be refreshed. The last saved view is shown and may be out of date.");
    }
  }, [refreshSituationAssessment, load]);

  useEffect(() => {
    void load();
    const refreshAfterCareRecordWrite = () => {
      void (async () => {
        await refreshWholeRecord();
      })();
    };
    const refreshAfterSessionChange = () => { void load(); };
    window.addEventListener("careRecordUpdated", refreshAfterCareRecordWrite);
    window.addEventListener("personIdChanged", refreshAfterSessionChange);
    return () => {
      window.removeEventListener("careRecordUpdated", refreshAfterCareRecordWrite);
      window.removeEventListener("personIdChanged", refreshAfterSessionChange);
    };
  }, [load, refreshWholeRecord]);

  const openLoopItems = assessment?.open_loops?.items ?? [];
  const careAttention = assessment?.care_attention;
  // Use persisted care-attention decisions returned by the existing assessment.
  const immediateCareDecisions = careAttention?.needs_attention_now ?? [];
  const importantCareDecisions = careAttention?.important_to_address ?? [];
  const clarificationCareDecisions = careAttention?.needs_clarification ?? [];
  const contextualNextDecision =
    immediateCareDecisions[0] ??
    clarificationCareDecisions[0] ??
    importantCareDecisions[0] ??
    null;
  const findAttentionLoop = (decision: CareAttentionDecision) =>
    openLoopItems.find((item) => item.id === decision.record_id && item.source === decision.source);
  const needsAttentionNow = careAttention
    ? careAttention.needs_attention_now.map(findAttentionLoop).filter((item): item is (typeof openLoopItems)[number] => Boolean(item))
    : selectImmediatePriorities(openLoopItems);
  const canWaitItems = careAttention
    ? careAttention.can_wait_with_documented_basis.map(findAttentionLoop).filter((item): item is (typeof openLoopItems)[number] => Boolean(item))
    : selectDeferredItems(openLoopItems);
  // Capture wrappers are source records, not changes in the person's care.
  // The original caregiver report remains available in care history.
  const internalCaptureRecordTypes = new Set(["structured_daily_capture", "daily_care_entry", "daily_capture"]);
  const internalCaptureEventType = /\b(?:structured_daily_capture|daily_care_entry|daily_capture)\b/i;
  const watchChanges = selectWatchChanges(changes).filter((change) =>
    !internalCaptureRecordTypes.has(change.subject_type.trim().toLowerCase()) &&
    !internalCaptureEventType.test(change.explanation || "")
  );
  const closedCareInformationStatuses = new Set([
    "resolved", "closed", "completed", "answered", "reconciled",
    "withdrawn", "retracted", "superseded", "cancelled",
    "dismissed", "not_applicable", "known",
  ]);
  const isUnresolvedCareInformation = (item: { status?: string | null }) =>
    !closedCareInformationStatuses.has(String(item.status ?? "").trim().toLowerCase());
  const watchUncertainties = (assessment?.uncertainties_and_conflicts ?? []).filter(isUnresolvedCareInformation);
  const isMedicationConflict = (item: (typeof watchUncertainties)[number]) => {
    const subjectType = item.subject_type?.trim().toLowerCase();
    const field = item.field?.trim().toLowerCase();
    return subjectType === "medication" || subjectType === "medications" || Boolean(field?.includes("medication"));
  };
  const medicationConflicts = watchUncertainties.filter((item) =>
    (item.source === "conflicts" || item.source === "reconciliations") && isMedicationConflict(item)
  );
  const careConflicts = watchUncertainties.filter((item) =>
    item.source === "conflicts" || item.source === "reconciliations"
  );
  const otherUncertainties = watchUncertainties.filter((item) =>
    item.source !== "conflicts" && item.source !== "reconciliations"
  );
  const watchPriorityCandidates = assessment?.priorities ?? [];
  const watchMissingInformation = (assessment?.missing_information ?? []).filter(isUnresolvedCareInformation);
  const watchOpenLoops = openLoopItems.filter((item) =>
    !needsAttentionNow.some((candidate) => candidate.id === item.id && candidate.source === item.source) &&
    !canWaitItems.some((candidate) => candidate.id === item.id && candidate.source === item.source) &&
    item.source === "open_loop_records"
  );
  const baselineItems = assessment?.baseline_assessment?.items ?? [];
  const activeWatchPatterns = patterns.filter((pattern) =>
    pattern.is_active && !pattern.superseded_by_pattern_id
  );
  const sourceForLoop = (loop: (typeof openLoopItems)[number]) =>
    projection?.items.find((item) =>
      item.id === loop.id && item.source_collection === loop.source
    );
  const suggestionReference = (item: (typeof openLoopItems)[number]) => `${item.source}:${item.id}`;
  const actionForSuggestion = (item: (typeof openLoopItems)[number]) =>
    registeredActions.find((action) => action.suggestion_id === suggestionReference(item));
  const sourceCoverage = projection?.source_coverage;
  const requestedSources = projection?.requested_sources ?? [];
  const hasCompleteSourceCoverage = Boolean(
    sourceCoverage &&
    requestedSources.length > 0 &&
    requestedSources.every((sourceName) => {
      const status = sourceCoverage[sourceName]?.status;
      return status === "available" || status === "empty";
    })
  );
  const hasConfirmedEmptyRecord = Boolean(
    projection &&
    projection.items.length === 0 &&
    projection.schema_status === "complete" &&
    projection.missing_required_sources.length === 0 &&
    projection.missing_optional_sources.length === 0 &&
    (projection.failed_sources?.length ?? 0) === 0 &&
    hasCompleteSourceCoverage
  );

  const hasIncompleteProjection = Boolean(
    projection &&
    !hasConfirmedEmptyRecord &&
    (
      projection.schema_status !== "complete" ||
      !hasCompleteSourceCoverage ||
      projection.missing_required_sources.length > 0 ||
      projection.missing_optional_sources.length > 0 ||
      (projection.failed_sources?.length ?? 0) > 0
    )
  );

  const approveFollowUp = async (item: (typeof openLoopItems)[number]) => {
    if (item.source !== "open_loop_records") {
      setActionApprovalError("Only a saved follow-up with a current version can be approved here. Refresh the Care Record and review the latest details.");
      return;
    }
    const suggestionId = suggestionReference(item);
    setActionApprovalLoadingId(suggestionId);
    setActionApprovalError(null);
    try {
      const session = await ensureAnonymousSession();
      if (personIdRef.current !== personId) return;
      if (!session.person?.id || session.person.id !== personId) {
        throw new Error("The suggestion does not belong to the active care-record session.");
      }
      if (item.source === "open_loop_records" && (!Number.isInteger(item.version) || (item.version ?? 0) < 1)) {
        throw new Error("This follow-up is missing its saved version. Refresh the care record before approving it.");
      }
      if (!item.request_text?.trim() || item.evidence_ids.length === 0) {
        throw new Error("This candidate cannot be registered safely: an explicit follow-up request and linked evidence are both required.");
      }
      if (createReminderForSuggestion && !reminderDueInput) {
        throw new Error("Choose a reminder date and time, or leave reminder creation disabled.");
      }
      const idempotencyKey = `lcr-approval-${suggestionId}`.replace(/[^a-zA-Z0-9:_-]/g, "-").slice(0, 128);
      const saved = await postJSON(
        `/registered-actions/${encodeURIComponent(session.person.id)}/approve`,
        {
          explicit_approval: true,
          idempotency_key: idempotencyKey,
          suggestion_id: suggestionId.slice(0, 160),
          ...(item.source === "open_loop_records" ? { suggestion_version: item.version } : {}),
          title: item.request_text.trim(),
          action_type: "follow_up",
          rationale: (item.priority_reasons ?? []).join("; ") || item.description || "A follow-up request is saved in the care record.",
          limitations: `What we know: ${caregiverLabel(item.epistemic_status)}. Saving this suggestion does not confirm it or tell us how urgent it is.`,
          evidence_ids: item.evidence_ids,
          responsible_caregiver_id: responsibleCaregiverId || session.caregiver.id,
          create_reminder: createReminderForSuggestion,
          ...(createReminderForSuggestion ? { reminder_due_at: new Date(reminderDueInput).toISOString() } : {}),
        },
      ) as RegisteredAction;
      if (personIdRef.current !== personId) return;
      if (!saved?.id || saved.person_id !== session.person.id || saved.suggestion_id !== suggestionId.slice(0, 160)) {
        throw new Error("The backend response did not confirm the expected registered action. Refresh before retrying.");
      }
      setRegisteredActions((current) => current.some((action) => action.id === saved.id)
        ? current.map((action) => action.id === saved.id ? saved : action)
        : [saved, ...current]);
      setReviewingSuggestionId(null);
      setCreateReminderForSuggestion(false);
      setReminderDueInput("");
    } catch (cause) {
      if (personIdRef.current !== personId) return;
      if (cause instanceof ApiResponseError && cause.status === 409) {
        setActionApprovalError("This follow-up changed after it was shown. The care record is refreshing; review the latest details before approving it.");
        void load(true);
      } else {
        setActionApprovalError("We couldn't save this as an agreed next step.");
      }
    } finally {
      if (personIdRef.current === personId) setActionApprovalLoadingId(null);
    }
  };

  const deferSuggestion = async (item: (typeof openLoopItems)[number]) => {
    if (item.source !== "open_loop_records") {
      setActionApprovalError("This item cannot be changed here. It is shown for information only; no change was made.");
      return;
    }
    const reason = (suggestionDispositionReasons[suggestionReference(item)] || "").trim();
    if (!reason) {
      setActionApprovalError("Add a reason before postponing this suggestion.");
      return;
    }
    setActionApprovalLoadingId(suggestionReference(item));
    setActionApprovalError(null);
    try {
      const session = await ensureAnonymousSession();
      if (personIdRef.current !== personId) return;
      if (session.person?.id !== personId) {
        throw new Error("The selected follow-up does not belong to the active care-record session.");
      }
      if (!Number.isInteger(item.version) || (item.version ?? 0) < 1) {
        throw new Error("This follow-up is missing its saved version. Refresh the care record before postponing it.");
      }
      const updatedLoop = await patchJSON(`/open-loops/${encodeURIComponent(item.id)}`, {
        status: "deferred",
        expected_version: item.version,
        deferred_reason: reason,
        reason,
        idempotency_key: `lcr-defer-${item.id}-v${item.version}-${reason}`.slice(0, 160),
      });
      if (personIdRef.current !== personId) return;
      if (!updatedLoop || updatedLoop.id !== item.id || updatedLoop.status !== "deferred") {
        throw new Error("The backend did not confirm the requested deferral. The suggestion remains unchanged.");
      }
      setReviewingSuggestionId(null);
      await load(true);
    } catch (cause) {
      if (personIdRef.current !== personId) return;
      if (cause instanceof ApiResponseError && cause.status === 409) {
        setActionApprovalError("This follow-up changed after it was shown. The care record is refreshing; review the latest details before postponing it.");
        void load(true);
      } else {
        setActionApprovalError("We couldn't postpone this suggestion. Please try again.");
      }
    } finally {
      if (personIdRef.current === personId) setActionApprovalLoadingId(null);
    }
  };

  const transitionRegisteredAction = async (
    action: RegisteredAction,
    status: "approved" | "in_progress" | "completed" | "cancelled" | "deferred" | "needs_clarification",
  ) => {
    const reason = (actionTransitionReasons[action.id] || "").trim();
    if (["cancelled", "deferred", "needs_clarification", "completed"].includes(status) && !reason) {
      setActionTransitionErrors((current) => ({ ...current, [action.id]: status === "completed" ? "Record what happened before completing this follow-up." : "Enter a reason before this status change." }));
      return;
    }
    setActionTransitionLoadingId(action.id);
    setActionTransitionErrors((current) => ({ ...current, [action.id]: "" }));
    try {
      const updated = await patchJSON(
        `/registered-actions/${encodeURIComponent(action.id)}/status`,
        {
          status,
          expected_version: action.version,
          explicit_completion_confirmation: status === "completed",
          completion_outcome: status === "completed" ? reason : undefined,
          reason: reason || undefined,
          ...(status === "deferred" && actionDeferredUntil[action.id] ? { deferred_until: new Date(actionDeferredUntil[action.id]).toISOString() } : {}),
        },
      ) as RegisteredAction;
      if (!updated?.id || updated.id !== action.id || updated.person_id !== personId) {
        throw new Error("The backend did not confirm the expected action update. Refresh before retrying.");
      }
      setRegisteredActions((current) => current.map((item) => item.id === updated.id ? updated : item));
      if (status === "completed") {
        // Completion writes a canonical LCR outcome; refresh the shared
        // projection so the caregiver sees the persisted outcome, not only
        // the updated action status.
        await load(true);
      }
    } catch {
      // A network failure can happen after the backend committed the transition.
      // Re-read the scoped action before telling the caregiver it failed, so a
      // retry cannot accidentally create confusion about a saved outcome.
      if (status === "completed") {
        try {
          const savedActions = await getJSON(`/registered-actions/${encodeURIComponent(personId)}`);
          if (Array.isArray(savedActions) && savedActions.every((item) => item?.person_id === personId)) {
            const persisted = savedActions.find((item) => item?.id === action.id) as RegisteredAction | undefined;
            setRegisteredActions(savedActions as RegisteredAction[]);
            if (persisted?.status === "completed") {
              await load(true);
              setActionTransitionErrors((current) => ({
                ...current,
                [action.id]: "Completion was saved, but the response was interrupted. The care record was refreshed; review the recorded outcome before retrying.",
              }));
              return;
            }
          }
        } catch {
          // Fall through to a fail-closed message; no successful write is assumed.
        }
      }
      setActionTransitionErrors((current) => ({
        ...current,
        [action.id]: "The action status could not be confirmed. Refresh the care record before retrying.",
      }));
    } finally {
      setActionTransitionLoadingId(null);
    }
  };

  const loadActionHistory = async (action: RegisteredAction) => {
    setActionHistoryErrors((current) => ({ ...current, [action.id]: "" }));
    try {
      const history = await getJSON(`/registered-actions/${encodeURIComponent(action.id)}/history`);
      if (!Array.isArray(history) || history.some((entry) => !entry?.id || !entry?.actor_caregiver_id)) {
        throw new Error("The action history response was incomplete.");
      }
      setActionHistory((current) => ({ ...current, [action.id]: history as RegisteredActionAudit[] }));
    } catch (cause) {
      setActionHistoryErrors((current) => ({
        ...current,
        [action.id]: "Action history could not be loaded.",
      }));
    }
  };

  const sourceRecoveryPanel = projection && Object.entries(projection.source_coverage ?? {})
    .filter(([, coverage]) => ["failed", "partial", "stale", "unsearchable", "unavailable_schema", "unavailable_scope"].includes(coverage.status ?? ""))
    .map(([sourceName, coverage]) => (
      <div key={sourceName} className="lcr-entry-status" role="status">
        <span>
          {historySourceLabel(sourceName)}: {coverage.status === "failed"
            ? "couldn’t be loaded"
            : coverage.status === "partial"
              ? "only partly available"
              : coverage.status === "stale"
                ? "couldn’t be refreshed; previously saved details remain available"
                : coverage.status === "unsearchable"
                  ? "couldn’t be searched for this question; no conclusion can be drawn from this source"
                  : "not available in this care-record setup"}
          {coverage.returned_count ? ` — ${coverage.returned_count} saved details are still available.` : ""}
        </span>
        <button
          type="button"
          className="lcr-text-action"
          onClick={() => void retryHistorySource(sourceName)}
          disabled={sourceRetrying !== null}
        >
          {sourceRetrying === sourceName ? "Retrying…" : "Retry"}
        </button>
      </div>
    ));

  return (
    <section className="lcr-record-section" aria-labelledby="lcr-current-understanding-heading">
      <div className="lcr-section-heading">
        <div>
          <p className="lcr-eyebrow">YOUR CARE</p>
          <h2 id="lcr-current-understanding-heading">{viewMode === "today" ? "Current care picture" : "Your Care Record"}</h2>
          <p className="lcr-record-introduction">This record reflects the care information saved here. It may not include everything happening in care.</p>
        </div>
        <button type="button" className="lcr-text-action" onClick={() => void refreshWholeRecord()} disabled={loading || refreshing || assessmentLoading} aria-label="Refresh care summary">
          <RefreshCw size={16} aria-hidden="true" /> {refreshing || assessmentLoading ? "Refreshing…" : "Refresh care summary"}
        </button>
      </div>

      <section className="lcr-first-screen-summary" aria-label="Care at a glance">
        <div className="lcr-first-screen-card">
          <h3>Your care information</h3>
          {loading ? (
            <RecordState kind="loading" title="Loading your care information" />
          ) : error ? (
            <RecordState kind="error" description="We couldn’t load your care information. Please try again." onAction={() => void load(true)} />
          ) : projection?.items.length ? (
            <>
              <p>
                {projection.schema_status !== "complete" || projection.missing_required_sources.length > 0 || projection.missing_optional_sources.length > 0 || (projection.failed_sources?.length ?? 0) > 0
                  ? "This summary uses the care information saved here so far and may be incomplete."
                  : "These are the details currently saved. They do not replace advice from a healthcare professional."}
                {projection.as_of ? ` Updated ${formatWhen(projection.as_of)}.` : ""}
              </p>
              {sourceRecoveryPanel}
              <ul className="lcr-first-screen-list">
                {projection.items.slice(0, 2).map((item) => (
                  <li key={item.source_collection + ":" + item.id}>
                    <strong>{displayCurrentCareTitle(item)}</strong>
                    {displayCurrentCareDescription(item) && <p>{displayCurrentCareDescription(item)}</p>}
                    <small>
                      {caregiverLabel(item.epistemic_status)} · Shared by {item.reported_by_caregiver_id ? (item.reported_by_caregiver_id === currentCaregiverId ? "you" : "another caregiver") : caregiverSafeGeneratedText(item.source_label) || "Not recorded"}
                      {item.time_provenance === "server_recorded_at" || item.time_provenance === "entry_time_defaulted" || !item.occurred_at ? " · Event time not provided" : ` · Happened ${formatWhen(item.occurred_at)}`}
                      {item.reported_at ? ` · Reported ${formatWhen(item.reported_at)}` : ""}
                      {item.recorded_at ? ` · Saved ${formatWhen(item.recorded_at)}` : ""}
                    </small>
                    {documentStatementContextLabels(item).length > 0 && <small>{documentStatementContextLabels(item).join(" · ")}</small>}
                    <a className="lcr-text-action" href={viewMode === "today" ? `/workspace/care-continuity#lcr-care-item-${encodeURIComponent(item.source_collection)}-${encodeURIComponent(item.id)}` : `#lcr-care-item-${encodeURIComponent(item.source_collection)}-${encodeURIComponent(item.id)}`}>View this detail</a>
                  </li>
                ))}
              </ul>
              {projection.item_count > 2 && <p className="lcr-entry-status">Showing 2 of {projection.item_count} saved care details. Open your full care history to review the rest.</p>}
            </>
          ) : projection && (projection.missing_required_sources.length > 0 || projection.missing_optional_sources.length > 0 || (projection.failed_sources?.length ?? 0) > 0) ? (
            <>
              <RecordState kind="incomplete" title="Some care history could not be loaded" description="Successful records remain available. Retry the affected source below." />
              {sourceRecoveryPanel}
            </>
          ) : hasConfirmedEmptyRecord ? (
            <div className="lcr-today-empty-state">
              <RecordState kind="first-empty" title="Your Care Record starts here" description="Keep care notes and documents together so you can understand what is happening and what has changed." />
              <p>Start with one thing you already know or something you have noticed. You can add more whenever you are ready.</p>
              <div className="lcr-today-empty-state__actions">
                <Link href="/workspace/daily-care" className="solenos-care-primary-action">Add a care update</Link>
                <Link href="/workspace/documents" className="solenos-care-secondary-action">Upload a care document</Link>
              </div>
            </div>
          ) : projection ? (
            <RecordState kind="incomplete" title="Some care information is not available yet" description="The record could not be checked completely, so SolenOS cannot confirm that it is empty." />
          ) : (
            <RecordState kind="unavailable" description="Your care information isn’t available right now. Please try again." onAction={() => void load(true)} />
          )}
        </div>

        <div className="lcr-first-screen-card">
          <h3>What matters now</h3>
          {assessment && !assessment.coverage.is_complete && (
            <p className="lcr-entry-status" role="status">Some saved care information could not be reviewed. This picture may be incomplete.</p>
          )}
          {sourceFreshness?.reassessment_recommended && (
            <div className="lcr-entry-status" role="status">
              <p>{sourceFreshness.status === "freshness_check_unavailable"
                ? "We couldn’t check whether this care summary is up to date. The last saved version may be out of date."
                : "Some information may have changed since this care picture was last reviewed."}</p>
              <button type="button" className="lcr-text-action" onClick={() => void refreshWholeRecord()} disabled={assessmentLoading || refreshing}>
                {assessmentLoading ? "Refreshing…" : "Refresh care summary"}
              </button>
            </div>
          )}
          {assessmentError ? (
            <RecordState kind="error" title="We couldn’t check what needs attention" description="We couldn’t check what may need attention. Please try again." onAction={() => void refreshWholeRecord()} />
          ) : assessmentLoading ? (
            <RecordState kind="loading" title="Checking what may need attention" description="Reviewing the saved care information. No priority has been assumed yet." />
          ) : !assessment ? (
            <RecordState kind="incomplete" title="Care priorities haven’t been reviewed yet" description="Review the saved care information to see what may need attention." onAction={() => void refreshWholeRecord()} />
          ) : hasConfirmedEmptyRecord ? (
            <RecordState kind="first-empty" title="No care information to review yet" description="The record is empty, so SolenOS cannot identify what needs attention. Add information as it becomes available." />
          ) : assessment.coverage.records_examined === 0 ? (
            <RecordState kind="incomplete" title="Care priorities could not be checked" description="The available review did not examine enough saved information to say what needs attention. Check the available Care Record and try again." onAction={() => void refreshWholeRecord()} />
          ) : immediateCareDecisions.length > 0 ? (
            <>
              <ul className="lcr-first-screen-list">
                {immediateCareDecisions.slice(0, 2).map((decision) => (
                  <li key={decision.id || decision.source + ":" + decision.record_id}>
                    <strong>{caregiverSafeGeneratedText(decision.title) || "Care follow-up"}</strong>
                    <p>{caregiverSafeGeneratedText(decision.reason || decision.priority_basis?.join("; ")) || "This was marked for attention in the latest review."}</p>
                    {decision.due_at && <small>Due {formatWhen(decision.due_at)}</small>}
                    {decision.records?.length ? (
                      <details>
                        <summary>See the notes and documents behind this</summary>
                        {decision.records.map((record) => (
                          <p key={record.source + ":" + record.record_id}>
                            {caregiverSafeAssistantText(record.title) || "Saved care record"} · Happened {formatWhen(record.occurred_at)} · Saved {formatWhen(record.recorded_at)}
                          </p>
                        ))}
                      </details>
                    ) : null}
                  </li>
                ))}
              </ul>
              {immediateCareDecisions.length > 2 && <p className="lcr-entry-status">{immediateCareDecisions.length - 2} more items may need attention. Open Needs attention to review them.</p>}
            </>
          ) : needsAttentionNow.length > 0 ? (
            <ul className="lcr-first-screen-list">
              {needsAttentionNow.slice(0, 2).map((item) => (
                <li key={item.source + ":" + item.id}>
                  <strong>{caregiverSourceText(item.title) || "Care follow-up"}</strong>
                  <p>{caregiverSourceText(item.description || item.request_text) || "This was marked for attention in the latest review."}</p>
                  {item.due_at && <small>Due {formatWhen(item.due_at)}</small>}
                </li>
              ))}
            </ul>
          ) : importantCareDecisions.length > 0 ? (
            <>
              <p>Nothing in the information reviewed is marked for immediate attention. These saved changes and follow-ups are important to review.</p>
              <ul className="lcr-first-screen-list">
                {importantCareDecisions.slice(0, 2).map((decision) => (
                  <li key={decision.id || decision.source + ":" + decision.record_id}>
                    <strong>{caregiverSafeGeneratedText(decision.title) || "Care information to review"}</strong>
                    <p>{caregiverSafeGeneratedText(decision.reason || decision.priority_basis?.join("; ")) || "The saved information indicates this may need review."}</p>
                    {decision.due_at && <small>Due {formatWhen(decision.due_at)}</small>}
                    {decision.records?.length ? (
                      <small>Based on {decision.records.length} linked care record{decision.records.length === 1 ? "" : "s"}</small>
                    ) : null}
                  </li>
                ))}
              </ul>
              {importantCareDecisions.length > 2 && <p className="lcr-entry-status">{importantCareDecisions.length - 2} more items are recorded for review.</p>}
              {clarificationCareDecisions.length > 0 && (
                <p className="lcr-entry-status">{clarificationCareDecisions.length} {clarificationCareDecisions.length === 1 ? "detail still needs" : "details still need"} clarification.</p>
              )}
            </>
          ) : clarificationCareDecisions.length > 0 ? (
            <p>Nothing in the information reviewed is marked for immediate attention. {clarificationCareDecisions.length} {clarificationCareDecisions.length === 1 ? "detail still needs" : "details still need"} clarification before it can be relied on.</p>
          ) : (
            <RecordState kind="period-empty" title="No immediate follow-up is shown" description={assessment.coverage.is_complete ? "The information reviewed does not currently show an immediate follow-up." : "Some care information may not have been available for this review, so this is not a complete picture."} />
          )}
          {watchMissingInformation.length > 0 && (
            <p className="lcr-entry-status">
              <strong>Information still to check:</strong>{" "}
              {watchMissingInformation.slice(0, 2).map((item) =>
                `${missingInformationReasonLabel(item.gap_reason, item.epistemic_status)} — ${caregiverSafeGeneratedText(item.title) || "A relevant care detail"}`
              ).join("; ")}
              {watchMissingInformation.length > 2 ? `; and ${watchMissingInformation.length - 2} more details` : ""}.
              A missing detail is not proof that the information is absent.
            </p>
          )}
          {careConflicts.length > 0 && (
            <p className="lcr-entry-status">
              <strong>Reports that do not match:</strong> {caregiverSafeAssistantText(careConflicts[0].title) || "Care reports"} · {careConflicts.length} unresolved {careConflicts.length === 1 ? "disagreement is" : "disagreements are"} recorded. SolenOS has not treated one report as the final answer.{" "}
              {viewMode === "today" ? (
                <Link href="/workspace/care-continuity#lcr-conflict-review">Review both reports</Link>
              ) : (
                <a href="#lcr-conflict-review">Review both reports</a>
              )}
            </p>
          )}
          {otherUncertainties.length > 0 && (
            <p className="lcr-entry-status">
              <strong>Still unclear:</strong>{" "}
              {missingInformationReasonLabel(otherUncertainties[0].gap_reason, otherUncertainties[0].epistemic_status)}: {caregiverSafeAssistantText(otherUncertainties[0].title) || "Some care information still needs checking."}
              {otherUncertainties.length > 1
                ? ` ${otherUncertainties.length - 1} more item(s) may need checking.`
                : ""}
            </p>
          )}
          {clarificationCareDecisions.length > 0 && (
            <section className="lcr-current-fact" aria-labelledby="lcr-questions-to-resolve-heading">
              <h4 id="lcr-questions-to-resolve-heading">Questions that still need answers</h4>
              <p>
                {clarificationCareDecisions.length} {clarificationCareDecisions.length === 1 ? "care detail needs" : "care details need"} a closer look before they can be relied on.
              </p>
              {viewMode === "today" ? (
                <Link href="/workspace/care-continuity#lcr-clarification-workflow" className="lcr-text-action">
                  Review questions
                </Link>
              ) : (
                <button
                  type="button"
                  className="lcr-text-action"
                  onClick={openClarification}
                  aria-controls="lcr-clarification-workflow"
                >
                  Review questions
                </button>
              )}
            </section>
          )}
          <Link href="/workspace/open-loops" className="lcr-text-action">Review needs attention <span aria-hidden="true">→</span></Link>
        </div>

        <div className="lcr-first-screen-card">
          <h3>What’s changed</h3>
          {changesError || patternsError ? (
            <RecordState kind="error" title="Recent changes could not be loaded" description="Some saved changes could not be checked. Please try again." onAction={() => void load(true)} />
          ) : changesLoading ? (
            <RecordState kind="loading" title="Checking recent changes" description="Checking what has changed in the saved care information." />
          ) : watchChanges.length > 0 ? (
            <ul className="lcr-first-screen-list">
              {watchChanges.slice(0, 2).map((change) => (
                <li key={change.id}>
                  <strong>{caregiverLabel(change.subject_type)} · {caregiverLabel(change.change_type)}</strong>
                  <p>{caregiverSafeChangeText(change.explanation) || "A possible change was saved. Its importance has not been established."}</p>
                  {change.comparison_window_start && change.comparison_window_end && <small>Compared from {formatWhen(change.comparison_window_start)} to {formatWhen(change.comparison_window_end)}</small>}
                  <small>Change review saved {formatWhen(change.created_at)}</small>
                  <button type="button" className="lcr-text-action" onClick={() => void loadChangeEvidence(change)} disabled={evidenceLoadingId === change.id || change.evidence_ids.length === 0} aria-expanded={expandedChangeId === change.id}>
                    {evidenceLoadingId === change.id ? "Loading related notes and documents…" : expandedChangeId === change.id ? "Hide related notes and documents" : "See related notes and documents"}
                  </button>
                  {expandedChangeId === change.id && changeEvidence[change.id]?.error && <p role="status">{changeEvidence[change.id]?.error}</p>}
                  {expandedChangeId === change.id && changeEvidence[change.id]?.missing_source_count ? (
                    <p role="status">Some of the information linked to this change could not be found. The available sources are still shown.</p>
                  ) : null}
                  {expandedChangeId === change.id && changeEvidence[change.id]?.evidence.map((source) => (
                    <article key={source.id}>
                      <strong>{caregiverSafeAssistantText(source.title) || "Saved care record"}</strong>
                      {displayDescription(source.description) && <p>{displayDescription(source.description)}</p>}
                      <small>{eventTimeLabel(source.occurred_at, source.time_provenance)} · Saved {formatWhen(source.recorded_at)}</small>
                    </article>
                  ))}
                  {expandedChangeId === change.id && changeEvidence[change.id]?.source_evidence.map((source) => (
                    <article key={source.id}>
                      <strong>{caregiverStatusLabel(source.type) || "Care information"}</strong>
                      <p>{caregiverReadableCaptureText(source.source_text) || "Original wording is not available."}</p>
                      <small>{caregiverInformationLabel(source.evidence_kind || source.epistemic_status || "reported") || "Reported information"}</small>
                      {source.reported_by_label && <small>Shared by {caregiverSafeAssistantText(source.reported_by_label) || "a caregiver"}</small>}
                      <small>{eventTimeLabel(source.occurred_at, source.time_provenance)} · Saved {formatWhen(source.ingested_at || source.uploaded_at)}</small>
                    </article>
                  ))}
                  {expandedChangeId === change.id && changeEvidence[change.id]?.assertions.map((item) => (
                    <article key={item.id}>
                      <strong>{caregiverFieldLabel(item.field) || caregiverLabel(item.field)}: {caregiverSourceText(item.asserted_value) || "Information was reported"}</strong>
                      {item.source_text && <p>{caregiverReadableCaptureText(item.source_text) || "Original wording is saved."}</p>}
                      <small>{caregiverInformationLabel(item.epistemic_state || "reported") || "Caregiver report"} · {caregiverSafeGeneratedText(item.source_label) || "Saved care record"}</small>
                      <small>Observed {eventTimeLabel(item.observed_at, item.time_provenance)} · Saved {formatWhen(item.recorded_at)}</small>
                    </article>
                  ))}
                  {expandedChangeId === change.id && changeEvidence[change.id]?.observations.map((item) => (
                    <article key={item.id}>
                      <strong>{caregiverFieldLabel(item.attribute) || caregiverLabel(item.attribute)}</strong>
                      <p>{caregiverReadableCaptureText(item.source_passage) || "Original wording is not available."}</p>
                      {item.observation_method !== "Daily Care form" && item.value_text && (
                        <p>What was recorded: {caregiverSourceText(item.value_text)}{item.units ? ` ${item.units}` : ""}</p>
                      )}
                      <small>{caregiverInformationLabel(item.epistemic_status || "reported") || "Reported information"} · {caregiverLabel(item.observation_kind)}</small>
                      <small>Observed {eventTimeLabel(item.observed_at || item.occurred_at, item.time_provenance)} · Reported {formatWhen(item.reported_at)} · Saved {formatWhen(item.recorded_at)}</small>
                    </article>
                  ))}
                  {expandedChangeId === change.id && changeEvidence[change.id]?.confirmation_history.map((transition) => (
                    <article key={transition.id}>
                      <strong>{caregiverLabel(transition.previous_status)} → {caregiverLabel(transition.new_status)}</strong>
                      {transition.reason && <p>{caregiverSafeAssistantText(transition.reason)}</p>}
                      <small>Reviewed by a caregiver · {formatWhen(transition.created_at)}</small>
                      {transition.evidence_ids.length > 0 && <small>This check used {transition.evidence_ids.length} saved care detail{transition.evidence_ids.length === 1 ? "" : "s"}.</small>}
                    </article>
                  ))}
                </li>
              ))}
            </ul>
          ) : activeWatchPatterns.length > 0 ? (
            <p>{activeWatchPatterns.length} repeated {activeWatchPatterns.length === 1 ? "change is" : "changes are"} recorded in the care history. Open the details to review the time period and supporting information.</p>
          ) : (
            <RecordState kind="period-empty" title="No recent changes recorded" description="Recorded changes will appear here as the care record is updated." />
          )}
        </div>
      </section>

      {viewMode === "complete" && (
        <>
      <details className="lcr-history-details" onToggle={(event) => setDementiaProfileOpen(event.currentTarget.open)}>
        <summary>Dementia care profile and observations</summary>
        {dementiaProfileOpen ? <DementiaCareProfilePanel key={personId} personId={personId} /> : null}
        {dementiaProfileOpen ? <DementiaObservationPanel key={personId} personId={personId} /> : null}
      </details>

            {(registeredActions.length > 0 || Boolean(registeredActionsError) || (assessment?.coverage.records_examined ?? 0) > 0) && (
            <div className="lcr-current-fact" aria-labelledby="lcr-registered-actions-heading">
              <h4 id="lcr-registered-actions-heading">What’s been agreed</h4>
              {registeredActionsError && <p role="alert">Agreed actions could not be loaded: {registeredActionsError}. Do not assume there are no active actions.</p>}
              {!registeredActionsError && registeredActions.length === 0 && <p>No actions have been agreed yet.</p>}
              {registeredActions.length > 0 && (
                <ul className="lcr-current-facts">
                  {registeredActions.map((action) => (
                    <li key={action.id} className="lcr-current-fact">
                      <strong>{caregiverSafeAssistantText(action.normalized_action) || "Saved care action"}</strong>
                      <p className="lcr-entry-status">Agreed next step · {caregiverStatusLabel(action.status) || "Status not available"}</p>
                      <small>Approved: {formatWhen(action.approved_at)} · Responsible caregiver: {action.responsible_caregiver_id === currentCaregiverId ? "You" : "Another caregiver"} · Created by: {action.created_by_caregiver_id === currentCaregiverId ? "You" : "Another caregiver"}</small>
                      <small>Related to {(action.source_evidence_ids ?? [action.source_evidence_id]).length} saved care detail{(action.source_evidence_ids ?? [action.source_evidence_id]).length === 1 ? "" : "s"}</small>
                      {action.deadline && <small>Due date: {formatWhen(action.deadline)}</small>}
                      {action.linked_reminder_status && <small>Linked reminder: {caregiverStatusLabel(action.linked_reminder_status) || "Status not available"} · Due {formatWhen(action.linked_reminder_due_at)}</small>}
                      {action.completed_at && <small>Explicitly marked completed: {formatWhen(action.completed_at)}</small>}
                      {action.deferred_until && <small>Deferred until: {formatWhen(action.deferred_until)}</small>}
                      {action.responsible_caregiver_id !== currentCaregiverId && <p role="status">Only the responsible caregiver can change this action. You can still review its status and change history.</p>}
                      <label>
                        Outcome when completing, or reason for deferring, cancelling or requesting clarification
                        <input
                          type="text"
                          value={actionTransitionReasons[action.id] ?? ""}
                          onChange={(event) => setActionTransitionReasons((current) => ({ ...current, [action.id]: event.target.value }))}
                          maxLength={2000}
                          disabled={action.responsible_caregiver_id !== currentCaregiverId}
                        />
                      </label>
                      {action.status !== "completed" && action.status !== "cancelled" && (
                        <label>
                          New reminder date when deferring {action.linked_reminder_status === "open" ? "(required for the linked open reminder)" : "(optional)"}
                          <input
                            type="datetime-local"
                            disabled={action.responsible_caregiver_id !== currentCaregiverId}
                            value={actionDeferredUntil[action.id] ?? ""}
                            onChange={(event) => setActionDeferredUntil((current) => ({ ...current, [action.id]: event.target.value }))}
                          />
                        </label>
                      )}
                      {action.status === "approved" && <button type="button" disabled={action.responsible_caregiver_id !== currentCaregiverId || actionTransitionLoadingId === action.id} onClick={() => void transitionRegisteredAction(action, "in_progress")}>Start action</button>}
                      {(action.status === "approved" || action.status === "in_progress") && <button type="button" disabled={action.responsible_caregiver_id !== currentCaregiverId || actionTransitionLoadingId === action.id} onClick={() => void transitionRegisteredAction(action, "completed")}>Confirm completed</button>}
                      {(action.status === "approved" || action.status === "in_progress" || action.status === "needs_clarification") && <button type="button" disabled={action.responsible_caregiver_id !== currentCaregiverId || actionTransitionLoadingId === action.id || (action.linked_reminder_status === "open" && !actionDeferredUntil[action.id])} onClick={() => void transitionRegisteredAction(action, "deferred")}>Defer</button>}
                      {(action.status === "deferred" || action.status === "needs_clarification") && <button type="button" disabled={action.responsible_caregiver_id !== currentCaregiverId || actionTransitionLoadingId === action.id} onClick={() => void transitionRegisteredAction(action, "approved")}>Resume as approved</button>}
                      {["approved", "in_progress", "deferred"].includes(action.status) && <button type="button" disabled={action.responsible_caregiver_id !== currentCaregiverId || actionTransitionLoadingId === action.id} onClick={() => void transitionRegisteredAction(action, "needs_clarification")}>Needs checking</button>}
                      {!["completed", "cancelled"].includes(action.status) && <button type="button" disabled={action.responsible_caregiver_id !== currentCaregiverId || actionTransitionLoadingId === action.id} onClick={() => void transitionRegisteredAction(action, "cancelled")}>Cancel action</button>}
                      {actionTransitionErrors[action.id] && <p role="alert">{actionTransitionErrors[action.id]}</p>}
                      <button type="button" className="lcr-text-action" onClick={() => void loadActionHistory(action)}>View change history</button>
                      {actionHistoryErrors[action.id] && <p role="alert">{actionHistoryErrors[action.id]}</p>}
                      {actionHistory[action.id] && (
                        <ol>
                          {actionHistory[action.id].map((event) => (
                            <li key={event.id}>
                              {caregiverStatusLabel(event.previous_status) || "Not recorded"} → {caregiverStatusLabel(event.new_status) || "Status not available"} · {formatWhen(event.created_at)} · Changed by: {event.actor_caregiver_id === currentCaregiverId ? "You" : "Another caregiver"}
                              {event.reason && <p>{caregiverSourceText(event.reason) || "A reason was recorded."}</p>}
                              <small>Related to {event.evidence_ids.length} saved care detail{event.evidence_ids.length === 1 ? "" : "s"}</small>
                            </li>
                          ))}
                        </ol>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            )}

      <section className="lcr-current-fact" aria-labelledby="lcr-outcomes-heading">
        <h3 id="lcr-outcomes-heading">What happened</h3>
        {projection?.outcomes?.length ? (
          <>
            <ul className="lcr-current-facts">
              {projection.outcomes.map((outcome) => (
                <li key={outcome.source_collection + ":" + outcome.id}>
                  <strong>{caregiverSafeAssistantText(outcome.description) || caregiverLabel(outcome.kind) || "Recorded outcome"}</strong>
                  <p>{caregiverStatusLabel(outcome.status) || "Outcome recorded"} · {formatWhen(outcome.recorded_at || outcome.occurred_at)}</p>
                  {outcome.related_record_type && outcome.related_record_id && (
                    <small>Linked to {outcome.related_record_type === "care_decision" ? "a recorded care decision" : outcome.related_record_type === "care_action" ? "an agreed care action" : "a follow-up"}</small>
                  )}
                  {outcome.evidence_ids.length > 0 && <small>Related to {outcome.evidence_ids.length} saved care detail{outcome.evidence_ids.length === 1 ? "" : "s"}</small>}
                </li>
              ))}
            </ul>
            {projection.outcomes_has_more && <p>More saved care history is available in your full care history.</p>}
          </>
        ) : !projection || projection.missing_required_sources.length > 0 || projection.missing_optional_sources.some((source) => ["decision_outcomes", "action_outcomes", "follow_up_links"].includes(source)) ? (
          <p>Some saved outcomes may not be available right now. Refresh your care history to try again.</p>
        ) : (
          <p>No follow-up outcomes have been recorded yet.</p>
        )}
      </section>

      <section className="lcr-current-fact" aria-labelledby="lcr-history-heading">
        <h3 id="lcr-history-heading">Your care history</h3>
        <p>Review saved care updates in date order, including the original reports and where they came from.</p>
        <Link href="/workspace/timeline" className="lcr-text-action">Open your full care history <span aria-hidden="true">→</span></Link>
      </section>



      <details className="lcr-history-details lcr-progressive-disclosure">
        <summary>More about your Care Record — follow-ups, details and history</summary>
      <section className="lcr-situation-assessment" aria-labelledby="lcr-attention-now-heading">
        <div className="lcr-entry-heading">
          <div>
            <h3 id="lcr-attention-now-heading">What needs attention</h3>
            <p>Only items that may need your attention appear here. This is not a diagnosis or medical advice.</p>
            <Link href="/workspace/open-loops" className="lcr-text-action">See needs attention <span aria-hidden="true">→</span></Link>
          </div>
        </div>
        {sourceFreshness?.reassessment_recommended && (
          <div role="status">
            <p>{sourceFreshness.status === "freshness_check_unavailable"
              ? "We couldn’t check whether this care summary is up to date. The last saved version is still available, but it may be out of date. Refresh before relying on it."
              : "Some information may have changed since this picture was last reviewed. Refresh to check for updates."}</p>
            <button type="button" onClick={() => void refreshWholeRecord()} disabled={assessmentLoading || refreshing}>
              {assessmentLoading ? "Refreshing…" : "Refresh care summary"}
            </button>
          </div>
        )}
        {assessmentError && (
          <RecordState kind="error" title="We couldn’t check what needs attention" description="Your saved care information is still available. Please try again." onAction={() => void refreshWholeRecord()} />
        )}
        {!assessmentError && !assessment && !loading && !assessmentLoading && (
          <RecordState kind="incomplete" title="Not enough information to say what needs attention" description="More care information may be needed before we can say what needs attention." />
        )}
        {assessment && !assessment.open_loops && (
          <p role="status">Some follow-up details are not available yet. We haven’t guessed what needs attention.</p>
        )}
        {medicationConflicts.map((item) => (
          <div key={"medication-conflict:" + item.id} className="lcr-current-fact" role="status">
            <h4>Medication instruction needs confirmation</h4>
            <p>Different reports about a medication do not match. The saved information does not tell us which instruction is current. Please contact the prescribing clinician or pharmacist promptly to confirm it. SolenOS has not changed the medication record.</p>
            <small>When the report was recorded: {formatWhen(item.recorded_at)}</small>
            <small>{item.evidence_ids.length > 0 ? "Related to " + item.evidence_ids.length + " saved care details" : "No related note or document is available"}</small>
          </div>
        ))}
        {assessment?.open_loops && (
          <>
            <div className="lcr-current-fact" aria-labelledby="lcr-attention-immediate-heading">
              <h4 id="lcr-attention-immediate-heading">Needs attention now</h4>
              {assessment.coverage.records_examined === 0 ? (
                <p>There isn’t enough recorded care information to assess immediate priorities yet.</p>
              ) : needsAttentionNow.length === 0 ? (
                <p>{assessment.open_loops.has_more
                  ? "No immediate concern appears in the information shown. Other items may still need review."
                  : "SolenOS has not found an immediate concern in the information it can currently access."}</p>
              ) : (
                <ul className="lcr-current-facts">
                  {needsAttentionNow.map((item) => {
                    const source = sourceForLoop(item);
                    return (
                      <li key={item.source + ":" + item.id} className="lcr-current-fact">
                        <strong>{caregiverSourceText(item.title) || "Care information"}</strong>
                        <p>{displayDescription(item.description || source?.description) || "No further description was recorded."}</p>
                        {item.request_text && <p>Follow-up: {caregiverSourceText(item.request_text) || "A follow-up was requested."}</p>}
                        {item.owner && <small>Responsible person: {caregiverSourceText(item.owner) || "Not recorded"}</small>}
                        {item.due_at && <small>Due date: {formatWhen(item.due_at)}</small>}
                        <details className="lcr-entry-status">
                          <summary>More about this item</summary>
                          <p>Why it appears: {(item.priority_reasons ?? []).map(caregiverSafeGeneratedText).filter(Boolean).join("; ") || "The saved record marks this item for attention, but no reason was provided."}</p>
                          <p>Status: {caregiverLabel(item.recorded_status)} · What we know: {caregiverLabel(item.epistemic_status)} · Where it came from: {historySourceLabel(item.source)}</p>
                          <small>When it happened: {eventTimeLabel(item.occurred_at, item.time_provenance)} · When it was saved: {formatWhen(item.recorded_at)}</small>
                          {item.verification_rule && <small>What shows this was done: {caregiverSafeGeneratedText(item.verification_rule) || "No further details are available."}</small>}
                          {item.outcome_status && <small>Outcome: {caregiverStatusLabel(item.outcome_status) || "Not available"}</small>}
                          {item.evidence_ids.length > 0
                            ? <small>Related notes or documents: {item.evidence_ids.length}</small>
                            : <small>This item was marked for follow-up in the saved record, but no supporting information is linked here.</small>}
                          {source?.source_label && <small>Shared by: {caregiverSafeGeneratedText(source.source_label) || "Not recorded"}</small>}
                          {source?.source_passage && <details><summary>Read the original note</summary><blockquote>{caregiverReadableCaptureText(source.source_passage) || "The original note could not be displayed."}</blockquote></details>}
                          {source && source.claim_count > 0 && <small>{source.claim_count} related reports. Check the saved details before deciding whether they differ.</small>}
                        </details>
                        {actionForSuggestion(item) ? (
                          <p className="lcr-entry-status">Agreed action: {caregiverLabel(actionForSuggestion(item)?.status)}. This suggestion has already been saved as an agreed action.</p>
                        ) : item.request_text?.trim() && item.evidence_ids.length > 0 ? (
                          <div>
                            <button type="button" className="lcr-text-action" onClick={() => {
                              setReviewingSuggestionId(reviewingSuggestionId === suggestionReference(item) ? null : suggestionReference(item));
                              setActionApprovalError(null);
                              setCreateReminderForSuggestion(false);
                              setReminderDueInput("");
                            }}>Review suggested follow-up</button>
                            {reviewingSuggestionId === suggestionReference(item) && (
                              <div className="lcr-current-fact" aria-label="Review suggested action before approval">
                                <strong>Suggested next step — not yet agreed</strong>
                                <p>Suggested next step: {caregiverSourceText(item.request_text) || "A follow-up request was saved."}</p>
                                <p>Why this may help: {(item.priority_reasons ?? []).map(caregiverSafeGeneratedText).filter(Boolean).join("; ") || caregiverSafeAssistantText(item.description) || "A follow-up request is saved in the care record."}</p>
                                <p>Related notes and documents: {item.evidence_ids.length}</p>
                                <p>What we know: {caregiverLabel(item.epistemic_status)}. This does not tell us how urgent the situation is.</p>
                                <label>
                                  Responsible caregiver
                                  <select
                                    value={responsibleCaregiverId || currentCaregiverId}
                                    onChange={(event) => setResponsibleCaregiverId(event.target.value)}
                                    disabled={assignableCaregivers.length === 0}
                                  >
                                    {assignableCaregivers.map((member) => (
                                      <option key={member.caregiver_id} value={member.caregiver_id}>{member.name}</option>
                                    ))}
                                  </select>
                                </label>
                                <p>Due date: {item.due_at ? `The source record contains ${formatWhen(item.due_at)}; no reminder will be created unless you explicitly choose one below.` : "No supported due date is recorded."}</p>
                                <p>Timing context: recorded priority {caregiverLabel(item.priority)} · recorded consequence of delay {caregiverLabel(item.consequence_of_delay)} · date source {caregiverLabel(item.deadline_source)}. No deadline is invented.</p>
                                <p>This item is not marked as optional or time-sensitive. Review the saved details before deciding when to act.</p>
                                <label>
                                  <input type="checkbox" checked={createReminderForSuggestion} onChange={(event) => setCreateReminderForSuggestion(event.target.checked)} />
                                  Create a reminder using the existing reminder system
                                </label>
                                {createReminderForSuggestion && (
                                  <label>
                                    Reminder due date and time
                                    <input type="datetime-local" value={reminderDueInput} onChange={(event) => setReminderDueInput(event.target.value)} />
                                  </label>
                                )}
                                {item.source === "open_loop_records" && (
                                  <label>
                                    Reason for deferring consideration
                                    <input
                                      type="text"
                                      value={suggestionDispositionReasons[suggestionReference(item)] ?? ""}
                                      onChange={(event) => setSuggestionDispositionReasons((current) => ({ ...current, [suggestionReference(item)]: event.target.value }))}
                                      maxLength={2000}
                                    />
                                  </label>
                                )}
                                {actionApprovalError && <p role="alert">{actionApprovalError}</p>}
                                <button type="button" onClick={() => void approveFollowUp(item)} disabled={actionApprovalLoadingId === suggestionReference(item)}>
                                  {actionApprovalLoadingId === suggestionReference(item) ? "Saving…" : "Approve and register"}
                                </button>
                                {item.source === "open_loop_records" && (
                                  <button type="button" onClick={() => void deferSuggestion(item)} disabled={actionApprovalLoadingId === suggestionReference(item)}>
                                    Defer consideration
                                  </button>
                                )}
                                <button type="button" className="lcr-text-action" onClick={() => {
                                  setReviewingSuggestionId(null);
                                  setActionApprovalError(null);
                                  setCreateReminderForSuggestion(false);
                                  setReminderDueInput("");
                                }}>Keep as suggestion</button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <small>This item is shown for reference only. It cannot be added as a follow-up without a clear request and supporting information.</small>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>


            {careAttention && (careAttention.important_to_address.length > 0 || careAttention.needs_clarification.length > 0) && (
              <section className="lcr-current-fact" aria-labelledby="lcr-care-attention-review-heading">
                <h4 id="lcr-care-attention-review-heading">Important changes and matters to review</h4>
                <p>These changes and unresolved matters may need review. They are not automatically emergencies.</p>
                {careAttention.important_to_address.length > 0 && (
                  <ul className="lcr-current-facts">
                    {careAttention.important_to_address.map((item) => (
                      <li key={item.id || item.source + ":" + item.record_id} className="lcr-current-fact">
                        <strong>{caregiverSourceText(item.title) || "Care information to review"}</strong>
                        <p>{caregiverSafeGeneratedText(item.reason || item.priority_basis?.join("; ")) || "The saved care information indicates this needs follow-up."}</p>
                        {item.evidence_status && <small>Information checked: {caregiverStatusLabel(item.evidence_status) || "Not established"}</small>}
                        {item.history_completeness && item.history_completeness !== "complete" && <small>Some earlier care information may be missing.</small>}
                        {item.action_status && item.action_status !== "not_recorded" && <small>Follow-up: {caregiverStatusLabel(item.action_status) || "Status not recorded"}</small>}
                        {item.linked_follow_up_outcome_status && item.linked_follow_up_outcome_status !== "not_recorded" && <small>Outcome: {caregiverStatusLabel(item.linked_follow_up_outcome_status) || "Not recorded"}</small>}
                        {item.records?.map((record) => (
                          <small key={record.source + ":" + record.record_id}>
                            {caregiverSafeAssistantText(record.title) || "Saved care record"} · Happened: {formatWhen(record.occurred_at)} · Saved: {formatWhen(record.recorded_at)}
                          </small>
                        ))}
                        {item.evidence_ids && item.evidence_ids.length > 0 && <small>Related notes or documents: {item.evidence_ids.length}</small>}
                      </li>
                    ))}
                  </ul>
                )}
                {careAttention.needs_clarification.length > 0 && (
                  <div role="status">
                    <p>Some details may need checking. SolenOS brings related questions together so you do not have to look in several places.</p>
                    <button
                      type="button"
                      className="lcr-text-action"
                      onClick={() => {
                        openClarification();
                        document.getElementById("lcr-clarification-workflow")?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                    >
                      See questions to clarify
                    </button>
                  </div>
                )}
                <small>This summary uses the information currently saved. Missing information may change what SolenOS can show. A pattern does not prove what caused a change.</small>
              </section>
            )}

            {assessment.coverage.records_examined > 0 && (
            <div className="lcr-current-fact" aria-labelledby="lcr-attention-wait-heading">
              <h4 id="lcr-attention-wait-heading">Put off for now</h4>
              {canWaitItems.length === 0 ? (
                <p>No care items have been marked as postponed. An unresolved concern may still need attention.</p>
              ) : (
                <>
                  <p>These items were put off earlier. That does not mean they are safe to delay now. Check the latest care information before relying on that decision.</p>
                  <ul className="lcr-current-facts">
                  {canWaitItems.map((item) => (
                    <li key={item.source + ":" + item.id} className="lcr-current-fact">
                      <strong>{caregiverSourceText(item.title) || "Care information"}</strong>
                      <p>{displayDescription(item.description)}</p>
                      <p className="lcr-entry-status">Reason for postponing: {caregiverSourceText(item.deferred_reason) || "No reason was recorded."}</p>
                      <p className="lcr-entry-status">Status: {caregiverLabel(item.recorded_status)} · Priority: {caregiverLabel(item.priority)} · What we know: {caregiverLabel(item.epistemic_status)}</p>
                      {item.request_text && <p>Next step: {caregiverSourceText(item.request_text) || "A follow-up request was saved."}</p>}
                      {item.verification_rule && <small>How completion was confirmed: {caregiverSourceText(item.verification_rule) || "A completion check was saved."}</small>}
                      {item.review_at && <small>Date to review: {formatWhen(item.review_at)}</small>}
                      {!item.review_at && <small>No review date was set.</small>}
                      {item.priority_reasons && item.priority_reasons.length > 0
                        ? <small>Why this was marked for attention: {item.priority_reasons.map(caregiverSafeGeneratedText).filter(Boolean).join("; ") || "No readable reason was recorded."}</small>
                        : <small>No reason was recorded. Review this again if the care information changes.</small>}
                      <small>When it happened: {eventTimeLabel(item.occurred_at, item.time_provenance)} · When it was saved: {formatWhen(item.recorded_at)}</small>
                      <small>Where it came from: {historySourceLabel(item.source)}</small>
                      <small>{item.evidence_ids.length > 0 ? "Related to " + item.evidence_ids.length + " saved care details" : "No related note or document is available"}</small>
                    </li>
                  ))}
                  </ul>
                </>
              )}
            </div>
            )}


            <div className="lcr-current-fact" aria-labelledby="lcr-attention-watch-heading">
              <h4 id="lcr-attention-watch-heading">Changes to watch</h4>
              <p>These are changes or things that are still unclear in the saved care history. They are not automatically tasks. You can see items that need follow-up on the Needs attention page.</p>
              <Link href="/workspace/open-loops" className="lcr-text-action">See needs attention <span aria-hidden="true">→</span></Link>
              {(changesError || patternsError) && <RecordState kind="error" title="Some care changes could not be loaded" description="This view may be incomplete. Your saved information remains visible." onAction={() => void load(true)} />}
              {watchChanges.length === 0 && watchUncertainties.length === 0 && watchPriorityCandidates.length === 0 && watchMissingInformation.length === 0 && watchOpenLoops.length === 0 && activeWatchPatterns.length === 0 && baselineItems.length === 0 ? (
                (changesError || patternsError) ? null : <RecordState kind="period-empty" title="No recent changes recorded" description="Recorded changes will appear here as information is added." />
              ) : (
                <ul className="lcr-current-facts">
                  {baselineItems.map((item) => (
                    <li key={"baseline:" + item.source + ":" + item.id} className="lcr-current-fact">
                      <strong>Usual or starting point · {caregiverSafeGeneratedText(item.title) || "Care detail"}</strong>
                      <p>This was marked as a usual or starting point for this person. It is not a comparison with other people.</p>
                      <p className="lcr-entry-status">Where it came from: {historySourceLabel(item.source)} · Status: {caregiverLabel(item.status)} · What we know: {caregiverLabel(item.epistemic_status)}</p>
                      <small>When it happened: {eventTimeLabel(item.occurred_at, item.time_provenance)} · When it was saved: {formatWhen(item.recorded_at)}</small>
                      <small>{item.evidence_ids.length > 0 ? "Related to " + item.evidence_ids.length + " saved care details" : "No related note or document is available"}</small>
                      {item.interpretation_limit && <small>{caregiverSafeGeneratedText(item.interpretation_limit) || "The available information may not tell the whole story."}</small>}
                    </li>
                  ))}
                  {watchPriorityCandidates.map((item) => {
                    const source = projection?.items.find((candidate) =>
                      candidate.id === item.id && candidate.source_collection === item.source
                    );
                    return (
                      <li key={"candidate:" + item.source + ":" + item.id} className="lcr-current-fact">
                        <strong>Possible follow-up · {caregiverSafeGeneratedText(item.title) || "Care detail to review"}</strong>
                        <p>This item was marked for follow-up. That does not mean it needs attention right away.</p>
                        <p className="lcr-entry-status">Status: {caregiverLabel(item.status)} · What we know: {caregiverLabel(item.epistemic_status)} · Where it came from: {historySourceLabel(item.source)}</p>
                        {source?.description && <p>{displayDescription(source.description)}</p>}
                        <small>When it happened: {eventTimeLabel(item.occurred_at, item.time_provenance)} · When it was saved: {formatWhen(item.recorded_at)}</small>
                        <small>{item.evidence_ids.length > 0 ? "Related to " + item.evidence_ids.length + " saved care details" : "No related note or document is available"}</small>
                        <small>Where it came from: {historySourceLabel(item.source)}</small>
                      </li>
                    );
                  })}
                  {watchOpenLoops.map((item) => (
                    <li key={"open-loop:" + item.source + ":" + item.id} className="lcr-current-fact">
                      <strong>Still needs follow-up · {caregiverSourceText(item.title) || "Care follow-up"}</strong>
                      <p>The saved information does not say whether this needs attention now or can wait. No due date is assumed.</p>
                      <p className="lcr-entry-status">Status: {caregiverLabel(item.recorded_status)} · Priority: {caregiverLabel(item.priority)} · What we know: {caregiverLabel(item.epistemic_status)}</p>
                      {item.description && <p>{displayDescription(item.description)}</p>}
                      {item.owner && <small>Responsible person: {caregiverSafeAssistantText(item.owner) || "Not recorded"}</small>}
                      {item.due_at && <small>Due date: {formatWhen(item.due_at)}</small>}
                      <small>When it happened: {eventTimeLabel(item.occurred_at, item.time_provenance)} · When it was saved: {formatWhen(item.recorded_at)}</small>
                      <small>{item.evidence_ids.length > 0 ? "Related to " + item.evidence_ids.length + " saved care details" : "No related note or document is available"}</small>
                      <small>Where it came from: {historySourceLabel(item.source)}</small>
                    </li>
                  ))}
                  {watchMissingInformation.map((item) => (
                    <li key={"missing:" + item.source + ":" + item.id} className="lcr-current-fact">
                      <strong>Information still missing · {caregiverSafeGeneratedText(item.title) || "Care detail to check"}</strong>
                      <p>This information is still missing. That alone does not tell us how urgent it is.</p>
                      <p className="lcr-entry-status">Status: {caregiverLabel(item.status)} · What we know: {caregiverLabel(item.epistemic_status)} · Where it came from: {historySourceLabel(item.source)}</p>
                      <small>When it happened: {eventTimeLabel(item.occurred_at, item.time_provenance)} · When it was saved: {formatWhen(item.recorded_at)}</small>
                      <small>{item.evidence_ids.length > 0 ? "Related to " + item.evidence_ids.length + " saved care details" : "No related note or document is available"}</small>
                      <small>Where it came from: {historySourceLabel(item.source)}</small>
                    </li>
                  ))}
                  {watchUncertainties.filter((item) => !isMedicationConflict(item)).map((item) => {
                    const source = projection?.items.find((candidate) =>
                      candidate.id === item.id && candidate.source_collection === item.source
                    );
                    const disputed = item.source === "conflicts" || item.source === "reconciliations";
                    return (
                      <li key={item.source + ":" + item.id} className="lcr-current-fact">
                        <strong>{caregiverSafeAssistantText(item.title) || "Care information"}</strong>
                        <p>{disputed ? "Reports do not match, and the difference has not been resolved. Neither report is treated as correct." : "This still needs to be checked."}</p>
                        <p className="lcr-entry-status">Status: {caregiverLabel(item.status)} · What we know: {caregiverLabel(item.epistemic_status)} · Where it came from: {historySourceLabel(item.source)}</p>
                        {source?.description && <p>{displayDescription(source.description)}</p>}
                        {source?.source_passage && <details><summary>Read the original note</summary><blockquote>{caregiverReadableCaptureText(source.source_passage) || "The original note could not be displayed."}</blockquote></details>}
                        <small>When it happened: {eventTimeLabel(item.occurred_at, item.time_provenance)} · When it was saved: {formatWhen(item.recorded_at)}</small>
                        <small>{item.evidence_ids.length > 0 ? "Related to " + item.evidence_ids.length + " saved care details" : "No related note or document is available"}</small>
                        <small>Where it came from: {historySourceLabel(item.source)}</small>
                      </li>
                    );
                  })}
                  {watchChanges.map((change) => (
                    <li key={change.id} className="lcr-current-fact">
                      <strong>{caregiverLabel(change.subject_type)} · {caregiverLabel(change.change_type)}</strong>
                      <p>{caregiverSafeGeneratedText(change.explanation) || "A possible change was saved, but no explanation is available."}</p>
                      <p>Previously recorded: {caregiverLabel(change.previous_state)} · Currently recorded: {caregiverLabel(change.current_state)}</p>
                      <p className="lcr-entry-status">Review this when a new report or correction changes the saved information. This change is not a medical conclusion.</p>
                      <p className="lcr-entry-status">
                        Review: {caregiverLabel(change.confirmation_status || "not recorded")}. 
                        {change.confirmation_status === "rejected"
                          ? " A caregiver disputed this change. It is not shown as confirmed."
                          : change.confirmation_status === "inconclusive"
                            ? " This change could not be confirmed."
                            : change.confirmation_status === "confirmed"
                              ? " A caregiver confirmed this change. This is not a medical diagnosis."
                              : " This possible change has not been confirmed."}
                      </p>
                      {change.comparison_window_start && change.comparison_window_end && <small>Compared from {formatWhen(change.comparison_window_start)} to {formatWhen(change.comparison_window_end)}</small>}
                      {change.evidence_ids.length > 0 && <small>Related to {change.evidence_ids.length} saved care detail{change.evidence_ids.length === 1 ? "" : "s"}</small>}
                      <button type="button" className="lcr-text-action" onClick={() => void loadChangeEvidence(change)} disabled={evidenceLoadingId === change.id || change.evidence_ids.length === 0} aria-expanded={expandedChangeId === change.id}>
                        {expandedChangeId === change.id ? "Hide notes and documents" : "View related notes and documents"}
                      </button>
                      {expandedChangeId === change.id && changeEvidence[change.id]?.error && <p role="status">{changeEvidence[change.id]?.error}</p>}
                      {expandedChangeId === change.id && changeEvidence[change.id]?.evidence.map((source) => (
                        <article key={source.id}>
                          <strong>{caregiverSafeAssistantText(source.title) || "Saved care update"}</strong>
                          <p>{displayDescription(source.description)}</p>
                          <small>When it happened: {formatWhen(source.occurred_at)} · When it was saved: {formatWhen(source.recorded_at)}</small>
                        </article>
                      ))}
                    </li>
                  ))}
                  {activeWatchPatterns.map((pattern) => (
                    <li key={pattern.id} className="lcr-current-fact">
                      <strong>{caregiverLabel(pattern.subject_type)} · {caregiverLabel(pattern.pattern_type)}</strong>
                      <p>These updates were saved between {formatWhen(pattern.temporal_start)} and {formatWhen(pattern.temporal_end)}. Number of care updates: {pattern.evidence_count}.</p>
                      {pattern.direction && <p>Change noted: {caregiverLabel(pattern.direction)}</p>}
                      <p className="lcr-entry-status">Review this again if new information or a correction changes the dates. This does not tell us what caused the change or whether it is medically important.</p>
                      {pattern.alternative_interpretations?.length ? (
                        <div>
                          <strong>Other possible explanations</strong>
                          {pattern.alternative_interpretations.map((alternative, index) => <p key={index}>{caregiverSafeGeneratedText(alternative) || "Another possible explanation was saved."}</p>)}
                        </div>
                      ) : <p>Other possible explanations were not provided. No cause is assumed.</p>}
                      <small>Saved care updates: {pattern.event_ids.length}</small>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </section>

      <details className="lcr-history-details"><summary>See changes that have happened more than once</summary>
      <div className="lcr-situation-assessment" aria-labelledby="lcr-pattern-history-heading">
        <div className="lcr-entry-heading">
          <h3 id="lcr-pattern-history-heading">Changes that have happened more than once</h3>
          <span>{patterns.filter((pattern) => pattern.is_active && !pattern.superseded_by_pattern_id).length} repeated changes in the saved history</span>
        </div>
        {patternsError && <RecordState kind="error" title="Repeated changes could not be loaded" description="Your saved information is still available. Please try again." onAction={() => void load(true)} />}
        {!patternsError && patterns.length === 0 && (
          <RecordState kind="period-empty" title="No repeated changes recorded" description="Repeated changes will appear here when they have been recorded and reviewed." />
        )}
        {patterns.length > 0 && (
          <ul className="lcr-current-facts">
            {patterns.map((pattern) => (
              <li key={pattern.id} className="lcr-current-fact">
                <div className="lcr-entry-heading">
                  <strong>{caregiverLabel(pattern.subject_type)} · {caregiverLabel(pattern.pattern_type)}</strong>
                  <span>{pattern.is_active && !pattern.superseded_by_pattern_id ? "Current" : "Replaced by a newer review"} · {caregiverLabel(pattern.pattern_strength)}</span>
                </div>
                <p>
                  Seen in {pattern.evidence_count} care updates, from {formatWhen(pattern.temporal_start)} to {formatWhen(pattern.temporal_end)}.
                </p>
                {pattern.rate_per_period != null && (
                  <p className="lcr-entry-status">This pattern is based only on care updates saved here. Some events may not have been recorded.</p>
                )}
                {pattern.direction && <p className="lcr-entry-status">Change noted: {caregiverLabel(pattern.direction)}</p>}
                {pattern.confidence == null && <p className="lcr-entry-status">There is not enough information to know how reliable this repeated change is.</p>}
                {pattern.alternative_interpretations?.map((item, index) => {
                  const safeInterpretation = caregiverSafeGeneratedText(item);
                  return safeInterpretation
                    ? <p className="lcr-entry-status" key={index}>{safeInterpretation}</p>
                    : null;
                })}
                <small>Saved care updates: {pattern.event_ids.length}</small>
              </li>
            ))}
          </ul>
        )}
      </div>

      </details>
      <details className="lcr-history-details"><summary>Review care changes</summary>
      <div className="lcr-situation-assessment" aria-labelledby="lcr-change-history-heading">
        <div className="lcr-entry-heading">
          <h3 id="lcr-change-history-heading">Care changes over time</h3>
          <span>{changes.length === 1 ? "1 change review saved" : `${changes.length} change reviews saved`}</span>
        </div>
        {changesError && <RecordState kind="error" title="Care changes could not be loaded" description="Your saved information is still available. Please try again." onAction={() => void load(true)} />}
        {!changesError && changes.length === 0 && (
          <RecordState kind="period-empty" title="No care changes recorded" description="Recorded care changes will appear here as they are reviewed." />
        )}
        {changes.length > 0 && (
          <ul className="lcr-current-facts">
            {changes.map((change) => (
              <li key={change.id} className="lcr-current-fact">
                <div className="lcr-entry-heading">
                  <strong>{caregiverLabel(change.subject_type)} · {caregiverLabel(change.change_type)}</strong>
                  <span>{change.significance_verdict ? caregiverLabel(change.significance_verdict) : "Not reviewed yet"}</span>
                </div>
                <p>{caregiverSafeChangeText(change.explanation) || "SolenOS found a change in the saved care information. Its importance has not yet been established."}</p>
                <p className="lcr-entry-status">
                  Previous: {caregiverSafeChangeText(change.previous_state) || "Not enough earlier information to compare"} · Current: {caregiverSafeChangeText(change.current_state) || "Saved change details need a closer look"}
                </p>
                <p className="lcr-entry-status">
                  Review: {caregiverLabel(change.is_active === false || change.superseded_by_change_id ? "superseded" : change.confirmation_status || "detected")}
                </p>
                <label className="lcr-evidence-reason">
                  Review note
                  <textarea
                    value={confirmationReason[change.id] || ""}
                    onChange={(event) => setConfirmationReason((previous) => ({ ...previous, [change.id]: event.target.value }))}
                    rows={2}
                    maxLength={2000}
                  />
                  <small>Add context if it would help. A note is required if you dispute this change or cannot confirm it. Your confirmation records your review; it does not independently verify a medical fact.</small>
                </label>
                {confirmationError[change.id] && <p role="alert">{confirmationError[change.id]}</p>}
                {change.is_active !== false && !change.superseded_by_change_id ? (
                  <div className="lcr-entry-actions">
                    {(["detected", "awaiting_confirmation"].includes(change.confirmation_status || "detected")) ? (
                      <>
                        <button type="button" className="lcr-text-action" disabled={confirmationLoadingId === change.id} onClick={() => void transitionConfirmation(change, "confirmed")}>Confirm</button>
                        <button type="button" className="lcr-text-action" disabled={confirmationLoadingId === change.id} onClick={() => void transitionConfirmation(change, "inconclusive")}>Could not confirm</button>
                        <button type="button" className="lcr-text-action" disabled={confirmationLoadingId === change.id} onClick={() => void transitionConfirmation(change, "rejected")}>Dispute this change</button>
                        {change.confirmation_status !== "awaiting_confirmation" && (
                          <button type="button" className="lcr-text-action" disabled={confirmationLoadingId === change.id} onClick={() => void transitionConfirmation(change, "awaiting_confirmation")}>Ask for confirmation</button>
                        )}
                      </>
                    ) : (
                      <button type="button" className="lcr-text-action" disabled={confirmationLoadingId === change.id} onClick={() => void transitionConfirmation(change, "awaiting_confirmation")}>Review again</button>
                    )}
                  </div>
                ) : (
                  <small>A newer review replaced this one. The earlier review remains in the care history.</small>
                )}
                {change.comparison_window_start && change.comparison_window_end && <small>Compared from {formatWhen(change.comparison_window_start)} to {formatWhen(change.comparison_window_end)}</small>}
                {change.evidence_ids.length > 0 && <small>Related to {change.evidence_ids.length} saved care detail{change.evidence_ids.length === 1 ? "" : "s"}</small>}
                <button
                  type="button"
                  className="lcr-text-action"
                  onClick={() => void loadChangeEvidence(change)}
                  disabled={evidenceLoadingId === change.id || change.evidence_ids.length === 0}
                  aria-expanded={expandedChangeId === change.id}
                >
                  {evidenceLoadingId === change.id
                    ? "Loading related notes and documents…"
                    : expandedChangeId === change.id
                      ? "Hide related notes and documents"
                      : "View related notes and documents"}
                </button>
                {expandedChangeId === change.id && (
                  <div className="lcr-current-facts" aria-label="Related notes and documents">
                    {changeEvidence[change.id]?.error && (
                      <p role="status">Related notes and documents could not be loaded. Please try again.</p>
                    )}
                    {changeEvidence[change.id]?.evidence.map((item) => (
                      <article key={item.id} className="lcr-current-fact">
                        <strong>{caregiverSourceText(item.title) || "Care information"}</strong>
                        <p>{displayDescription(item.description)}</p>
                        <small>{item.event_type === "structured_daily_capture" ? "Daily care update" : item.event_type === "quick_daily_checkin" ? "Daily check-in" : caregiverLabel(item.event_type)} · {item.status === "recorded" ? "Saved" : caregiverLabel(item.status)}</small>
                        <small>When it happened: {eventTimeLabel(item.occurred_at, item.time_provenance)}{item.time_provenance !== "server_recorded_at" && item.time_provenance !== "entry_time_defaulted" && item.occurred_at_timezone ? ` (${item.occurred_at_timezone})` : ""}</small>
                        <small>Saved: {formatWhen(item.recorded_at)}</small>
                        <small>How the date was described: {caregiverLabel(item.time_provenance)}</small>
                      </article>
                    ))}
                    {changeEvidence[change.id] && !changeEvidence[change.id].error && changeEvidence[change.id].evidence.length === 0 && (
                      <p>The original information linked to this change is not available.</p>
                    )}
                    {changeEvidence[change.id]?.assertions.length > 0 && (
                      <div aria-label="Saved reports">
                        <strong>What was reported</strong>
                        <ul>
                          {changeEvidence[change.id].assertions.map((assertion) => (
                            <li key={assertion.id}>
                              <p>{caregiverFieldLabel(assertion.field) || caregiverLabel(assertion.field)}: {caregiverSourceText(assertion.asserted_value) || "Saved care detail"}</p>
                              <small>{caregiverLabel(assertion.subject_type)} · What we know: {caregiverInformationLabel(assertion.epistemic_state || "reported") || "Caregiver report"} · Review: {caregiverLabel(assertion.assertion_status)} · {caregiverSafeGeneratedText(assertion.source_label) || "Saved care record"}</small>
                              <small>Date noticed: {formatWhen(assertion.observed_at)} · Saved: {formatWhen(assertion.recorded_at)}</small>
                              {assertion.source_text && <p>{caregiverReadableCaptureText(assertion.source_text) || "The original wording is saved."}</p>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {changeEvidence[change.id]?.confirmation_history.length > 0 && (
                      <div aria-label="Review history">
                        <strong>Review history</strong>
                        <ul>
                          {changeEvidence[change.id].confirmation_history.map((transition) => (
                            <li key={transition.id}>
                              <p>{caregiverLabel(transition.previous_status)} → {caregiverLabel(transition.new_status)}</p>
                              {transition.reason && <p>{caregiverSourceText(transition.reason) || "A reason was recorded."}</p>}
                              <small>Recorded {formatWhen(transition.created_at)} · reviewed by a caregiver</small>
                              {transition.evidence_ids.length > 0 && <small>This check used {transition.evidence_ids.length} saved care detail{transition.evidence_ids.length === 1 ? "" : "s"}.</small>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
                {change.is_persistent === true && <small>Recorded on more than one occasion{change.persistence_days != null ? ` across ${change.persistence_days} days` : ""}</small>}
                {change.is_persistent === false && <small>There is not enough information to tell whether this continued.</small>}
                {(change.attention_candidate || change.follow_up_candidate) && (
                  <small>{[change.attention_candidate ? "May need attention" : null, change.follow_up_candidate ? "May need follow-up" : null].filter(Boolean).join(" · ")}</small>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      </details>
      {/* Detailed assessment diagnostics remain available to the care engine and audit services,
          but are intentionally not exposed as caregiver-facing copy. The record itself remains
          available through the timeline, source review and care-history controls. */}
      {loading ? (
        <RecordState kind="loading" title="Loading your care information" />
      ) : error ? (
        <div role="alert" className="lcr-empty-state">
          <AlertCircle size={20} aria-hidden="true" />
          <h3>Your care information isn’t available right now</h3>
          <p>We couldn’t load this care information. Check your connection and try again. Your saved records have not been changed.</p>
          
          <button type="button" className="lcr-text-action" onClick={() => void load(true)}>Try again</button>
        </div>
      ) : projection ? (
        <>
          {(projection.schema_status !== "complete" || projection.missing_required_sources.length > 0 || projection.missing_optional_sources.length > 0 || (projection.failed_sources?.length ?? 0) > 0) && (
            <div role="status" className="lcr-empty-state">
              <AlertCircle size={20} aria-hidden="true" />
              <h3>Some care information is unavailable</h3>
              <p>We couldn’t load all of the available care information. The picture shown may be incomplete. Try refreshing later.</p>
              {projection.missing_required_sources.length > 0 && (
                <p>Some important care information may be missing from this view.</p>
              )}
              {projection.missing_optional_sources.length > 0 && (
                <p>Some additional care information may not be available right now.</p>
              )}
            </div>
          )}

          {projection.items.length === 0 ? (
            projection.missing_required_sources.length > 0 || projection.missing_optional_sources.length > 0 || (projection.failed_sources?.length ?? 0) > 0 ? (
              <div className="lcr-empty-state" role="status">
                <h3>We couldn’t check all of your care information.</h3>
                <p>No matching care details were returned from the sources we could check. This does not mean the unavailable sources have no relevant information.</p>
                {sourceRecoveryPanel}
              </div>
            ) : (
              <div className="lcr-empty-state">
                <h3>Your Care Record does not have any care information yet.</h3>
                <p>Add what you know in Daily Care or upload a care document. You can also ask the Care Assistant to help you understand saved information.</p>
              </div>
            )
          ) : (
            <div className="lcr-current-facts">
              <ul>
                {projection.items.map((item) => (
                  <li id={`lcr-care-item-${encodeURIComponent(item.source_collection)}-${encodeURIComponent(item.id)}`} key={item.source_collection + ":" + item.id} className="lcr-current-fact">
                    <div className="lcr-entry-heading">
                      <strong>{displayCurrentCareTitle(item)}</strong>
                      <span>{caregiverLabel(item.epistemic_status)}</span>
                    </div>
                    {displayCurrentCareDescription(item) && <p style={{ whiteSpace: "pre-line" }}>{displayCurrentCareDescription(item)}</p>}
                    <details className="lcr-entry-status">
                      <summary>Care details</summary>
                      <p>{caregiverLabel(item.kind)} · {item.status === "recorded" ? "Saved" : caregiverStatusLabel(item.status) || "Status not available"}</p>

                      <small>Shared by: {item.reported_by_caregiver_id ? (item.reported_by_caregiver_id === currentCaregiverId ? "You" : "Another caregiver") : caregiverSafeGeneratedText(item.source_label) || "Not recorded"}</small>
                      {documentStatementContextLabels(item).length > 0 && <small>{documentStatementContextLabels(item).join(" · ")}</small>}
                      <small>{item.time_provenance === "server_recorded_at" || item.time_provenance === "entry_time_defaulted" ? "Event time not provided · " : item.occurred_at ? `Happened: ${formatWhen(item.occurred_at)} · ` : ""}{item.reported_at ? `Caregiver shared: ${formatWhen(item.reported_at)} · ` : ""}Saved to the care record: {formatWhen(item.recorded_at || item.occurred_at)}</small>
                      {item.evidence_ids?.length > 0 ? (
                        <div>
                          <small>{item.evidence_link_validation === "valid" ? "Original report attached" : "Related report linked"}</small>
                          {item.source_passage ? (
                            <details>
                              <summary>Read original report</summary>
                              <blockquote>{caregiverReadableCaptureText(item.source_passage) || "The original wording is saved."}</blockquote>
                            </details>
                          ) : (
                            <small>Original report text is not available in this view.</small>
                          )}
                        </div>
                      ) : (
                        <small>The original report is not linked to this item yet.</small>
                      )}
                    </details>
                    {item.derived_observations && item.derived_observations.length > 0 && (
                      <details className="lcr-entry-status">
                        <summary>Details found in this note ({item.derived_observations.length})</summary>
                        <p>These details were taken from the same note. They are not separate reports or independent confirmation of the information.</p>
                        {item.derived_observations.some((observation) => isMedicationObservation(observation.attribute)) && (
                          <p>These medication details come from saved reports. They do not confirm the current prescription or whether a dose was given. Do not use them as instructions to start, stop or change medicine.</p>
                        )}
                        <ul>
                          {item.derived_observations.map((observation) => (
                            <li key={observation.id}>
                              <strong>{caregiverFieldLabel(observation.attribute) || caregiverLabel(observation.attribute || observation.observation_kind)}</strong>
                              {observation.subject_label && <small>About: {caregiverSafeAssistantText(observation.subject_label) || "Person receiving care"}</small>}
                              {(observation.observer_caregiver_id || observation.observer_label) && <small>Shared by: {observation.observer_caregiver_id ? (observation.observer_caregiver_id === currentCaregiverId ? "You" : "Another caregiver") : caregiverSafeAssistantText(observation.observer_label) || "Not recorded"}</small>}
                              {observation.observation_method && <small>How it was recorded: {caregiverLabel(observation.observation_method)}</small>}
                              {typeof observation.context === "string" && caregiverSourceText(observation.context) && <p>Context: {caregiverSourceText(observation.context)}</p>}
                              {displayCurrentCareObservationValue(observation.attribute, observation.value_text) && <p>{displayCurrentCareObservationValue(observation.attribute, observation.value_text)}</p>}
                              <small>Happened: {formatWhen(observation.observed_at)} · Shared: {formatWhen(observation.reported_at)} · Saved: {formatWhen(observation.recorded_at)}</small>
                              {observation.source_passage && (
                                <details>
                                  <summary>Read the original note</summary>
                                  <blockquote>{caregiverReadableCaptureText(observation.source_passage) || "The original note could not be displayed."}</blockquote>
                                </details>
                              )}
                              {observation.negated != null && <small>Was this reported as not happening? {observation.negated ? "Yes" : "No"}</small>}
                              {observation.hedge_marker && <small>Words that suggest uncertainty: {caregiverLabel(observation.hedge_marker)}</small>}
                              {observation.ambiguity_note && <small>What still needs clarification: {caregiverSourceText(observation.ambiguity_note) || "More information may be needed."}</small>}
                              {observation.correction_rationale && <small>Why it was corrected: {caregiverSourceText(observation.correction_rationale) || "A correction was recorded."}</small>}
                              <small>The original wording is saved.</small>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                    <details className="lcr-entry-status">
                      <summary>More about this information</summary>
                    {item.source_collection === "evidence_observations" && (
                      <div className="lcr-entry-status">
                        <small>
                          Original wording is saved ·
                          {" "}Details taken from the saved note ·
                          {" "}Was this reported as not happening? {item.negated == null ? "Not recorded" : item.negated ? "Yes" : "No"}
                        </small>
                        {item.source_passage && (
                          <details>
                            <summary>Read the original note</summary>
                            <blockquote>{caregiverReadableCaptureText(item.source_passage) || "The original note could not be displayed."}</blockquote>
                          </details>
                        )}
                        {item.supersedes_observation_id && <small>This entry corrects an earlier care detail.</small>}
                        {item.correction_rationale && <small>Why it was corrected: {caregiverSourceText(item.correction_rationale) || "A correction was recorded."}</small>}
                        {item.hedge_marker && <small>Words that suggest uncertainty: {caregiverLabel(item.hedge_marker)}</small>}
                        {item.ambiguity_note && <small>What still needs clarification: {caregiverSourceText(item.ambiguity_note) || "More information may be needed."}</small>}
                      </div>
                    )}
                    {item.evidence_ids?.length > 0 && <small>What was checked: {caregiverLabel(item.evidence_assessment_coverage || "not returned")}</small>}
                    {item.evidence_assessments?.map((review) => (
                      <div key={review.evidence_id + ":" + review.review_type} className="lcr-entry-status">
                        <small>{caregiverLabel(review.review_type)}: {caregiverStatusLabel(review.outcome) || "Status not available"} · reviewed {formatWhen(review.reviewed_at)}</small>
                        <small>{caregiverSafeGeneratedText(review.rationale) || "No further explanation is available."}</small>
                      </div>
                    ))}
                    {item.claim_count > 0 && <small>Related reports: {item.claim_count}</small>}
                    {item.source_collection === "facts" && (
                      <div className="lcr-evidence-integrity">
                        <button type="button" onClick={() => void loadEvidenceIntegrity(item.id)} disabled={evidenceIntegrityLoadingId === item.id}>
                          {evidenceIntegrityLoadingId === item.id ? "Checking related notes and documents…" : "See related notes and documents"}
                        </button>
                        {evidenceIntegrityErrors[item.id] && <p role="alert">{evidenceIntegrityErrors[item.id]}</p>}
                        {evidenceIntegrityByFact[item.id] && (
                          <div>
                            <small>Related notes or documents: {evidenceIntegrityByFact[item.id].linked_evidence_count} · Shared separately: {caregiverStatusLabel(evidenceIntegrityByFact[item.id].independent_corroboration_status) || "Not checked"}</small>
                            {evidenceIntegrityByFact[item.id].duplicate_content_candidates.map(group => (
                              <p key={group.fingerprint}><small>Similar wording appears in {group.evidence_ids.length} other saved notes or updates. {caregiverSafeGeneratedText(group.interpretation) || "They may describe the same event."}</small></p>
                            ))}
                            {evidenceIntegrityByFact[item.id].near_duplicate_analysis && (
                              <div>
                                <small>Check for similar wording: {caregiverStatusLabel(evidenceIntegrityByFact[item.id].near_duplicate_analysis?.status) || "Not checked"} · {evidenceIntegrityByFact[item.id].near_duplicate_analysis?.records_considered ?? 0} of {evidenceIntegrityByFact[item.id].near_duplicate_analysis?.records_available ?? 0} saved items checked.</small>
                                {evidenceIntegrityByFact[item.id].near_duplicate_analysis?.candidate_groups?.map(group => (
                                  <p key={group.evidence_ids.join(":")}><small>Similar wording appears in {group.evidence_ids.length} saved care detail{group.evidence_ids.length === 1 ? "" : "s"}. {caregiverSafeGeneratedText(group.interpretation) || "This does not prove the reports are about the same event."}</small></p>
                                ))}
                                <small>{caregiverSafeGeneratedText(evidenceIntegrityByFact[item.id].near_duplicate_analysis?.interpretation_limit) || "Similar wording does not prove that reports came from the same source."}</small>
                              </div>
                            )}
                            <small>{caregiverSafeGeneratedText(evidenceIntegrityByFact[item.id].interpretation_limit) || "The relationship between these reports is not fully known."}</small>
                          </div>
                        )}
                      </div>
                    )}
                    </details>
                  </li>
                ))}
              </ul>
              {projection.has_more && <p>Showing the first {projection.item_count} items that may need attention. More are saved in your Care Record.</p>}
            </div>
          )}
          <p className="lcr-footer-note">Information shown as of {formatWhen(projection.as_of)}. This view includes the care information saved here so far.</p>
          <p className="lcr-footer-note">{caregiverSafeGeneratedText(projection.notice) || "This view reflects the care information currently available."}</p>
        </>
      ) : null}
        </>
      )}
      {showNextStep && !hasConfirmedEmptyRecord && (
              <section className="solenos-care-next-step" aria-labelledby="lcr-contextual-next-step-heading">
                <div>
                  <h4 id="lcr-contextual-next-step-heading">What may help next</h4>
                  {error ? (
                    <p role="alert">Your care information could not be checked, so SolenOS cannot suggest a next step yet.</p>
                  ) : loading ? (
                    <p role="status">Loading your care information…</p>
                  ) : hasIncompleteProjection ? (
                    <p>Some care information could not be checked. Review the available record before relying on this summary.</p>
                  ) : assessmentError ? (
                    <p role="alert">The saved care summary could not be loaded, so SolenOS cannot suggest a next step yet.</p>
                  ) : assessmentLoading ? (
                    <p role="status">The current care picture is still being reviewed. No next step has been assumed.</p>
                  ) : !assessment ? (
                    <p>Care priorities have not been reviewed yet. Review the saved information before relying on a next step.</p>
                  ) : immediateCareDecisions.length > 0 ? (
                    <p>Some care matters remain unresolved. Review the saved details before deciding what to do.</p>
                  ) : clarificationCareDecisions.length > 0 || watchMissingInformation.length > 0 || watchUncertainties.length > 0 ? (
                    <p>Some saved information is missing, unclear or does not match. Reviewing it may help make the care picture clearer.</p>
                  ) : importantCareDecisions.length > 0 || watchChanges.length > 0 ? (
                    <p>There are changes or unresolved matters you may want to review.</p>
                  ) : (
                    <p>You can explore the full care history or add an update whenever something changes.</p>
                  )}
                  {!error && !loading && !hasIncompleteProjection && !assessmentError && !assessmentLoading && contextualNextDecision && (
                    <div className="solenos-care-next-step__detail">
                      <strong>{caregiverSafeGeneratedText(contextualNextDecision.title) || "Care information to review"}</strong>
                      {(caregiverSafeGeneratedText(contextualNextDecision.reason) || contextualNextDecision.priority_basis?.map(caregiverSafeGeneratedText).filter(Boolean).join("; ")) && (
                        <p>{caregiverSafeGeneratedText(contextualNextDecision.reason) || contextualNextDecision.priority_basis?.map(caregiverSafeGeneratedText).filter(Boolean).join("; ")}</p>
                      )}
                      {contextualNextDecision.due_at && <small>Due {formatWhen(contextualNextDecision.due_at)}</small>}
                      {contextualNextDecision.records?.length ? (
                        <small>Based on {contextualNextDecision.records.length} linked care record{contextualNextDecision.records.length === 1 ? "" : "s"}</small>
                      ) : contextualNextDecision.evidence_ids?.length ? (
                        <small>Linked to {contextualNextDecision.evidence_ids.length} saved source{contextualNextDecision.evidence_ids.length === 1 ? "" : "s"}</small>
                      ) : null}
                    </div>
                  )}
                </div>
                <div className="solenos-care-next-step__actions">
                  {error ? (
                    <button type="button" className="solenos-care-primary-action" onClick={() => void refreshWholeRecord()}>Try again</button>
                  ) : loading ? (
                    <span role="status">Loading…</span>
                  ) : hasIncompleteProjection ? (
                    <Link href="/workspace/care-continuity" className="solenos-care-primary-action">Review available care information</Link>
                  ) : assessmentError ? (
                    <button type="button" className="solenos-care-primary-action" onClick={() => void refreshWholeRecord()}>Try again</button>
                  ) : assessmentLoading ? (
                    <span role="status">Reviewing…</span>
                  ) : !assessment ? (
                    <Link href="/workspace/care-continuity" className="solenos-care-primary-action">Review care information</Link>
                  ) : immediateCareDecisions.length > 0 ? (
                    <Link href="/workspace/open-loops" className="solenos-care-primary-action">Review Needs attention</Link>
                  ) : clarificationCareDecisions.length > 0 || watchMissingInformation.length > 0 || watchUncertainties.length > 0 ? (
                    viewMode === "today" ? (
                      <Link href="/workspace/care-continuity#lcr-clarification-workflow" className="solenos-care-primary-action">Review details to check</Link>
                    ) : (
                      <button type="button" className="solenos-care-primary-action" onClick={() => {
                        openClarification();
                        document.getElementById("lcr-clarification-workflow")?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}>Review details to check</button>
                    )
                  ) : importantCareDecisions.length > 0 || watchChanges.length > 0 ? (
                    <Link href="/workspace/timeline" className="solenos-care-primary-action">View Care history</Link>
                  ) : (
                    <Link href="/workspace/care-continuity" className="solenos-care-primary-action">View care information</Link>
                  )}
                </div>
              </section>
            )}
      {viewMode === "complete" && (
        <>
      <div id="lcr-clarification-workflow">
        <details ref={clarificationDetailsRef} className="lcr-history-details" onToggle={(event) => setClarificationOpen(event.currentTarget.open)}>
          <summary>Questions to clarify care</summary>
          {clarificationOpen ? <ClarificationWorkflowPanel personId={personId} /> : null}
        </details>
      </div>

      <details className="lcr-advanced-integrity">
        <summary>Sources of care information</summary>
        <p className="lcr-footer-note">See the original information behind each care detail, what is still unclear and how corrections are kept. A caregiver report is not the same as a confirmed medical fact.</p>
        <details ref={evidenceReviewDetailsRef} className="lcr-history-details" onToggle={(event) => setEvidenceReviewOpen(event.currentTarget.open)}>
          <summary>Original notes and documents</summary>
          {evidenceReviewOpen ? <EvidenceReviewPanel personId={personId} /> : null}
        </details>
        <details ref={claimAssessmentDetailsRef} className="lcr-history-details" onToggle={(event) => setClaimAssessmentOpen(event.currentTarget.open)}>
          <summary>Check a care detail against the original information</summary>
          {claimAssessmentOpen ? <ClaimAssessmentPanel /> : null}
        </details>
        <details id="lcr-conflict-review" ref={conflictReviewDetailsRef} className="lcr-history-details" onToggle={(event) => setConflictReviewOpen(event.currentTarget.open)}>
          <summary>When reports do not match</summary>
          {conflictReviewOpen ? <ConflictResolutionPanel personId={personId} /> : null}
        </details>
        <details ref={recordHistoryDetailsRef} className="lcr-history-details" onToggle={(event) => setRecordHistoryOpen(event.currentTarget.open)}>
          <summary>Care information and history</summary>
          {recordHistoryOpen ? <CareContinuityIntegrityPanel personId={personId} /> : null}
        </details>
      </details>
      </details>
        </>
      )}
    </section>
  );
}
