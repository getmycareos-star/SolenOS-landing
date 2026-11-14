"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { AlertCircle, RefreshCw } from "lucide-react";
import { ensureAnonymousSession, getJSON, postJSON, patchJSON } from "@/api/client";
import { selectDeferredItems, selectImmediatePriorities, selectWatchChanges } from "@/components/mvp-workspace/attention-now";
import { caregiverInformationLabel, caregiverSafeAssistantText, caregiverStatusLabel } from "@/lib/caregiver-language";
// Advanced review panels are code-split so they do not block the first caregiver view.
const CareContinuityIntegrityPanel = dynamic(() => import("@/components/CareContinuityIntegrityPanel"), { ssr: false, loading: () => <p role="status">Loading care record details…</p> });
const EvidenceReviewPanel = dynamic(() => import("@/components/EvidenceReviewPanel"), { ssr: false, loading: () => <p role="status">Loading saved care information…</p> });
const ClaimAssessmentPanel = dynamic(() => import("@/components/ClaimAssessmentPanel"), { ssr: false, loading: () => <p role="status">Loading saved care information…</p> });
const ConflictResolutionPanel = dynamic(() => import("@/components/ConflictResolutionPanel"), { ssr: false, loading: () => <p role="status">Loading conflict review…</p> });
const ClarificationWorkflowPanel = dynamic(() => import("@/components/ClarificationWorkflowPanel"), { ssr: false, loading: () => <p role="status">Loading information that may need checking…</p> });

let workspaceLoadSequence = 0;


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
  occurred_at?: string | null;
  reported_at?: string | null;
  recorded_at?: string | null;
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
    observation_method?: string | null;
    observed_at?: string | null;
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
  due_at?: string | null;
  review_at?: string | null;
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
  priorities: Array<{ id: string; source: string; title: string; status: string; epistemic_status: string; occurred_at?: string | null; recorded_at?: string | null; evidence_ids: string[] }>;
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
  uncertainties_and_conflicts: Array<{ id: string; source: string; title: string; status: string; epistemic_status: string; subject_type?: string | null; subject_id?: string | null; field?: string | null; occurred_at?: string | null; recorded_at?: string | null; evidence_ids: string[] }>;
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
      evidence_ids: string[];
      baseline_basis?: string;
      interpretation_limit?: string;
    }>;
    count: number;
    has_more: boolean;
    source_of_truth: string;
    limitation: string;
  };
  missing_information: Array<{ id: string; source: string; title: string; status: string; epistemic_status: string; occurred_at?: string | null; recorded_at?: string | null; evidence_ids: string[] }>;
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
  evidence_ids: string[];
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

function displayCurrentCareTitle(item: CurrentCareItem): string {
  return DOCUMENT_ASSERTION_LABELS[item.title || ""] || caregiverSafeAssistantText(item.title) || caregiverLabel(item.kind) || "Care record item"
}

function displayDescription(value?: string | null): string {
  if (!value?.trim()) return "No description was recorded.";
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const parsedRecord = parsed as Record<string, unknown>;
      const quickValue = parsedRecord.quick_check_in;
      if (quickValue && typeof quickValue === "object" && !Array.isArray(quickValue)) {
        const quick = quickValue as Record<string, unknown>;
        const kindLabels: Record<string, string> = {
          same_as_usual: "Same as usual",
          change: "Something changed",
          concern: "I have a concern",
          care_completed: "Care was completed",
          uncertain: "I’m not sure",
        };
        const areas = Array.isArray(quick.selected_areas)
          ? quick.selected_areas.filter((item): item is string => typeof item === "string")
               .map(caregiverLabel)
          : [];
        const summary = typeof parsedRecord.notes === "string" ? caregiverSafeAssistantText(parsedRecord.notes) || "" : "";
        return [
          summary,
          `Update type: ${kindLabels[String(quick.kind)] || "Caregiver check-in"}`,
          areas.length ? `Areas selected: ${areas.join(", ")}` : "",
          quick.scope === "selected_areas_only" ? "Scope: selected areas only" : "",
        ].filter(Boolean).join("\n");
      }
      const summary = [parsedRecord.notes, parsedRecord.text, parsedRecord.description, parsedRecord.observation, parsedRecord.summary]
        .find((item): item is string => typeof item === "string" && item.trim().length > 0);
      if (summary) return caregiverSafeAssistantText(summary) || "Saved care information";
      return "Saved care information";
    }
    if (typeof parsed === "string") return caregiverSafeAssistantText(parsed) || "Saved care information";
  } catch {
    // Plain text is preserved exactly as saved.
  }
  return caregiverSafeAssistantText(value) || "Saved care information";
}

function formatWhen(value?: string | null): string {
  if (!value) return "Time not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Time not recorded"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

const CAREGIVER_LABELS: Record<string, string> = {
  unknown: "Not yet known",
  not_assessed: "Not checked yet",
  not_recorded: "Not recorded",
  inferred: "Possible interpretation",
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
  clustering: "Several events close together",
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
  insufficient_evidence: "Not enough information to judge",
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
  rejected: "Not supported",
  superseded: "Replaced by a newer review",
  active: "Current",
  inactive: "No longer current",
  emergence: "First recorded",
  frequency_increase: "Recorded more often",
  frequency_decrease: "Recorded less often",
  recurrence: "Repeated",
  temporal_clustering: "Several events close together",
  medication: "Medication",
  mobility: "Movement",
  care_recipient: "Person receiving care",
  daily_care: "Daily care",
};

function caregiverLabel(value?: string | null): string {
  if (!value?.trim()) return "Not recorded";
  const normalized = value.trim().toLowerCase();
  return CAREGIVER_LABELS[normalized] ?? caregiverStatusLabel(normalized) ?? "Care information";
}

export function LCRCurrentUnderstanding() {
  const [personId, setPersonId] = useState("");
  const [currentCaregiverId, setCurrentCaregiverId] = useState("");
  const [registeredActions, setRegisteredActions] = useState<RegisteredAction[]>([]);
  const [registeredActionsError, setRegisteredActionsError] = useState<string | null>(null);
  const [reviewingSuggestionId, setReviewingSuggestionId] = useState<string | null>(null);
  const [clarificationPrefill, setClarificationPrefill] = useState<{ question: string; evidenceIds: string[] } | null>(null);
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
  const [advancedPanelsOpen, setAdvancedPanelsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assessment, setAssessment] = useState<SituationAssessment | null>(null);
  const [sourceFreshness, setSourceFreshness] = useState<SourceFreshness | null>(null);
  const [assessmentLoading, setAssessmentLoading] = useState(false);
  const [assessmentError, setAssessmentError] = useState<string | null>(null);
  const [changes, setChanges] = useState<PersistedChange[]>([]);
  const [changesError, setChangesError] = useState<string | null>(null);
  const [patterns, setPatterns] = useState<PersistedPattern[]>([]);
  const [patternsError, setPatternsError] = useState<string | null>(null);
  const [expandedChangeId, setExpandedChangeId] = useState<string | null>(null);
  const [changeEvidence, setChangeEvidence] = useState<Record<string, { evidence: ChangeEvidence[]; assertions: ChangeAssertionEvidence[]; confirmation_history: ChangeConfirmationHistoryItem[]; error?: string }>>({});
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
      setEvidenceIntegrityErrors(current => ({ ...current, [factId]: "Linked evidence integrity could not be loaded. No corroboration status is assumed; retry when the connection is available." }));
    } finally {
      setEvidenceIntegrityLoadingId(current => current === factId ? null : current);
    }
  }, []);

  const refreshSituationAssessment = async () => {
    const scopedPersonId = personId;
    if (!scopedPersonId) return;
    setAssessmentLoading(true);
    setAssessmentError(null);
    try {
      const current = await postJSON(
        "/care-continuity/situation-understanding/reassess",
        {},
      ) as SituationAssessmentResponse;
      if (current.assessment?.person_id === scopedPersonId) {
        setAssessment(current.assessment);
        setSourceFreshness(current.source_freshness ?? null);
        setAssessmentError(null);
      } else {
        throw new Error("The refreshed care summary did not match the active care record.");
      }
    } catch {
      setAssessmentError("The latest care summary could not be refreshed. The last saved view is shown and may be out of date.");
    } finally {
      setAssessmentLoading(false);
    }
  };

  const load = useCallback(async (manual = false) => {
    const timingId = ++workspaceLoadSequence;
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
    setChangesError(null);
    setPatternsError(null);
    setAssessmentError(null);
    let backgroundStarted = false;

    try {
      const session = await ensureAnonymousSession();
      if (!session.access_token || !session.person?.id) {
        throw new Error("Your care record session is not available. Refresh the page and try again.");
      }
      const scopedPersonId = session.person.id;
      setPersonId(scopedPersonId);
      setCurrentCaregiverId(session.caregiver.id);

      // The caregiver's first useful screen depends only on this scoped,
      // read-only projection. No secondary query or write blocks its display.
      const currentCare = await getJSON("/care-continuity/current-care?limit_per_source=12");
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
      const changePath = `/change/changes/${encodeURIComponent(scopedPersonId)}`;
      const backgroundTasks = [
        (async () => {
          try {
            const savedActions = await getJSON(`/registered-actions/${encodeURIComponent(scopedPersonId)}`);
            if (!Array.isArray(savedActions) || savedActions.some((item) => item?.person_id !== scopedPersonId)) {
              throw new Error("Saved actions did not match this care record.");
            }
            setRegisteredActions(savedActions as RegisteredAction[]);
            setRegisteredActionsError(null);
          } catch (cause) {
            setRegisteredActions([]);
            setRegisteredActionsError("Agreed actions could not be loaded. Please try again.");
          }
        })(),
        (async () => {
          const validateChanges = (value: unknown): PersistedChange[] => {
            if (!Array.isArray(value) || value.some((item) => item?.person_id !== scopedPersonId)) {
              throw new Error("The saved change history does not match this care record.");
            }
            return value as PersistedChange[];
          };
          try {
            setChanges(validateChanges(await getJSON(changePath)));
            setChangesError(null);
          } catch (cause) {
            setChanges([]);
            setChangesError("Saved care changes could not be loaded. Please try again.");
          }
        })(),
        (async () => {
          try {
            const persistedPatterns = await getJSON(`/change/patterns/${encodeURIComponent(scopedPersonId)}`);
            if (!Array.isArray(persistedPatterns) || persistedPatterns.some((item) => item?.person_id !== scopedPersonId)) {
              throw new Error("The saved repeated-change information did not match the active care record.");
            }
            setPatterns(persistedPatterns as PersistedPattern[]);
            setPatternsError(null);
          } catch (cause) {
            setPatterns([]);
            setPatternsError("Repeated changes could not be loaded. Please try again.");
          }
        })(),
        (async () => {
          try {
            const saved = await getJSON("/care-continuity/situation-understanding") as SituationAssessmentResponse;
            const savedNeedsReassessment = saved.source_freshness?.reassessment_recommended === true;
            const savedBelongsToPerson =
              saved.status === "available" && saved.assessment?.person_id === scopedPersonId;
            if (savedBelongsToPerson) {
              setAssessment(saved.assessment);
              setSourceFreshness(saved.source_freshness ?? null);
              if (savedNeedsReassessment) {
                // Hydration remains read-only; the caregiver can request a refresh explicitly.
              }
              setAssessmentError(null);
            } else {
              setAssessment(null);
              setSourceFreshness(null);
              setAssessmentError("The care summary is not available yet. Some care information may be missing.");
            }
          } catch (cause) {
            setAssessment(null);
            setSourceFreshness(null);
            setAssessmentError("The saved care summary could not be loaded. Please try again.");
          }
        })(),
      ];
      const backgroundWork = Promise.allSettled(backgroundTasks).finally(() => setRefreshing(false));
      if (manual) await backgroundWork;
      else void backgroundWork;
    } catch (cause) {
      setPersonId("");
      setCurrentCaregiverId("");
      setProjection(null);
      setRegisteredActions([]);
      setRegisteredActionsError("Agreed actions are unavailable because your care record session could not be confirmed.");
      setError("The care history could not be loaded. Please try again.");
    } finally {
      setLoading(false);
      if (!backgroundStarted) setRefreshing(false);
    }
  }, []);

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
      const reason = (confirmationReason[change.id] || "").trim();
      if ((status === "rejected" || status === "inconclusive") && !reason) {
        throw new Error("Enter a reason before disputing this change or marking it as not confirmed.");
      }
      await postJSON(
        `/change/changes/${encodeURIComponent(session.person.id)}/${encodeURIComponent(change.id)}/confirmation`,
        { status, reason: reason || null, evidence_ids: change.evidence_ids },
      );
      const refreshed = await getJSON(
        `/change/changes/${encodeURIComponent(session.person.id)}`
      ) as PersistedChange[];
      if (!Array.isArray(refreshed) || refreshed.some((item) => item.person_id !== session.person.id)) {
        throw new Error("The refreshed change history did not match the active care-record session.");
      }
      setChanges(refreshed);
    } catch (cause) {
      setConfirmationError((previous) => ({
        ...previous,
        [change.id]: "Confirmation could not be saved.",
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
          result.change.person_id !== session.person.id || !Array.isArray(result.evidence) || !Array.isArray(result.assertions) || !Array.isArray(result.confirmation_history) ||
          result.evidence.some((item) => !change.evidence_ids.includes(item.id))) {
        throw new Error("The returned source information did not match the saved change review.");
      }
      setChangeEvidence((previous) => ({ ...previous, [change.id]: { evidence: result.evidence, assertions: result.assertions, confirmation_history: result.confirmation_history } }));
    } catch (cause) {
      setChangeEvidence((previous) => ({
        ...previous,
        [change.id]: {
          evidence: [],
          assertions: [],
          confirmation_history: [],
          error: "Supporting evidence could not be loaded.",
        },
      }));
    } finally {
      setEvidenceLoadingId(null);
    }
  }, [changeEvidence, expandedChangeId]);

  const reassess = useCallback(async () => {
    setAssessmentLoading(true);
    setAssessmentError(null);
    try {
      const session = await ensureAnonymousSession();
      const result = await postJSON("/care-continuity/situation-understanding/reassess", {}) as SituationAssessmentResponse;
      if (!result.assessment || result.assessment.person_id !== session.person.id) {
        throw new Error("The review did not match the active care record.");
      }
      setAssessment(result.assessment);
      setSourceFreshness(result.source_freshness ?? null);
    } catch (cause) {
      setAssessmentError("The care summary could not be updated.");
    } finally {
      setAssessmentLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const refreshAfterCareRecordWrite = () => {
      void (async () => {
        await load(true);
        await refreshSituationAssessment();
      })();
    };
    window.addEventListener("careRecordUpdated", refreshAfterCareRecordWrite);
    return () => window.removeEventListener("careRecordUpdated", refreshAfterCareRecordWrite);
  }, [load]);

  const openLoopItems = assessment?.open_loops?.items ?? [];
  const careAttention = assessment?.care_attention;
  const findAttentionLoop = (decision: CareAttentionDecision) =>
    openLoopItems.find((item) => item.id === decision.record_id && item.source === decision.source);
  const needsAttentionNow = careAttention
    ? careAttention.needs_attention_now.map(findAttentionLoop).filter((item): item is (typeof openLoopItems)[number] => Boolean(item))
    : selectImmediatePriorities(openLoopItems);
  const canWaitItems = careAttention
    ? careAttention.can_wait_with_documented_basis.map(findAttentionLoop).filter((item): item is (typeof openLoopItems)[number] => Boolean(item))
    : selectDeferredItems(openLoopItems);
  const watchChanges = selectWatchChanges(changes);
  const watchUncertainties = assessment?.uncertainties_and_conflicts ?? [];
  const isMedicationConflict = (item: (typeof watchUncertainties)[number]) => {
    const subjectType = item.subject_type?.trim().toLowerCase();
    const field = item.field?.trim().toLowerCase();
    return subjectType === "medication" || subjectType === "medications" || Boolean(field?.includes("medication"));
  };
  const medicationConflicts = watchUncertainties.filter((item) =>
    (item.source === "conflicts" || item.source === "reconciliations") && isMedicationConflict(item)
  );
  const watchPriorityCandidates = assessment?.priorities ?? [];
  const watchMissingInformation = assessment?.missing_information ?? [];
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

  const approveFollowUp = async (item: (typeof openLoopItems)[number]) => {
    const suggestionId = suggestionReference(item);
    setActionApprovalLoadingId(suggestionId);
    setActionApprovalError(null);
    try {
      const session = await ensureAnonymousSession();
      if (!session.person?.id || session.person.id !== personId) {
        throw new Error("The suggestion does not belong to the active care-record session.");
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
          title: item.request_text.trim(),
          action_type: "follow_up",
          rationale: (item.priority_reasons ?? []).join("; ") || item.description || "A follow-up request is saved in the care record.",
          limitations: `Information status: ${caregiverLabel(item.epistemic_status)}. Saving this suggestion does not confirm the information or show how urgent it is.`,
          evidence_ids: item.evidence_ids,
          responsible_caregiver_id: session.caregiver.id,
          create_reminder: createReminderForSuggestion,
          ...(createReminderForSuggestion ? { reminder_due_at: new Date(reminderDueInput).toISOString() } : {}),
        },
      ) as RegisteredAction;
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
      setActionApprovalError("The action could not be registered.");
    } finally {
      setActionApprovalLoadingId(null);
    }
  };

  const deferSuggestion = async (item: (typeof openLoopItems)[number]) => {
    if (item.source !== "open_loop_records") {
      setActionApprovalError("This item is not a directly editable Open Loop record. It remains informational; no deferral was written.");
      return;
    }
    const reason = (suggestionDispositionReasons[suggestionReference(item)] || "").trim();
    if (!reason) {
      setActionApprovalError("Enter a reason before deferring this suggestion.");
      return;
    }
    setActionApprovalLoadingId(suggestionReference(item));
    setActionApprovalError(null);
    try {
      const session = await ensureAnonymousSession();
      if (session.person?.id !== personId) {
        throw new Error("The selected follow-up does not belong to the active care-record session.");
      }
      const updatedLoop = await patchJSON(`/open-loops/${encodeURIComponent(item.id)}`, {
        status: "deferred",
        deferred_reason: reason,
        reason,
        idempotency_key: `lcr-defer-${item.id}-${reason}`.slice(0, 160),
      });
      if (!updatedLoop || updatedLoop.id !== item.id || updatedLoop.status !== "deferred") {
        throw new Error("The backend did not confirm the requested deferral. The suggestion remains unchanged.");
      }
      setReviewingSuggestionId(null);
      await load(true);
    } catch (cause) {
      setActionApprovalError("The suggestion could not be deferred.");
    } finally {
      setActionApprovalLoadingId(null);
    }
  };

  const transitionRegisteredAction = async (
    action: RegisteredAction,
    status: "approved" | "in_progress" | "completed" | "cancelled" | "deferred" | "needs_clarification",
  ) => {
    const reason = (actionTransitionReasons[action.id] || "").trim();
    if (["cancelled", "deferred", "needs_clarification"].includes(status) && !reason) {
      setActionTransitionErrors((current) => ({ ...current, [action.id]: "Enter a reason before this status change." }));
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
          reason: reason || undefined,
          ...(status === "deferred" && actionDeferredUntil[action.id] ? { deferred_until: new Date(actionDeferredUntil[action.id]).toISOString() } : {}),
        },
      ) as RegisteredAction;
      if (!updated?.id || updated.id !== action.id || updated.person_id !== personId) {
        throw new Error("The backend did not confirm the expected action update. Refresh before retrying.");
      }
      setRegisteredActions((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (cause) {
      setActionTransitionErrors((current) => ({
        ...current,
        [action.id]: "The action status could not be updated.",
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

  return (
    <section className="lcr-record-section" aria-labelledby="lcr-current-understanding-heading">
      <div className="lcr-section-heading">
        <div>
          <p className="lcr-eyebrow">CURRENT CARE SUMMARY</p>
          <h2 id="lcr-current-understanding-heading">Your care, at a glance</h2>
          <p>What has been shared, what may need attention, and what is still unclear.</p>
        </div>
        <button type="button" className="lcr-text-action" onClick={() => void load(true)} disabled={loading || refreshing} aria-label="Refresh care summary">
          <RefreshCw size={16} aria-hidden="true" /> Refresh care summary
        </button>
      </div>

      <section className="lcr-situation-assessment" aria-labelledby="lcr-attention-now-heading">
        <div className="lcr-entry-heading">
          <div>
            <h3 id="lcr-attention-now-heading">Care priorities</h3>
            <p>Follow-ups and changes recorded in the care history. A flag is not a diagnosis or a medical judgement.</p>
          </div>
        </div>
        {sourceFreshness?.reassessment_recommended && (
          <div role="status">
            <p>Some information may have changed since this picture was last reviewed. Refresh to check for updates.</p>
            <button type="button" onClick={() => void refreshSituationAssessment()} disabled={assessmentLoading}>
              {assessmentLoading ? "Refreshing…" : "Refresh care summary"}
            </button>
          </div>
        )}
        {assessmentError && (
          <p role="status">We couldn’t check which items may need attention. Try refreshing. The information shown may be incomplete.</p>
        )}
        {!assessmentError && !assessment && !loading && !assessmentLoading && (
          <p role="status">We don’t yet have enough information to identify priorities. This does not mean there are no care needs.</p>
        )}
        {assessment && !assessment.open_loops && (
          <p role="status">Some follow-up details are not available yet. No priority has been assumed.</p>
        )}
        {medicationConflicts.map((item) => (
          <div key={"medication-conflict:" + item.id} className="lcr-current-fact" role="status">
            <h4>Medication instruction needs confirmation</h4>
            <p>Different reports about a medication do not match. The record does not establish the current instruction. Please contact the prescribing clinician or pharmacist promptly to confirm it. SolenOS has not changed the medication record.</p>
            <small>When the report was recorded: {formatWhen(item.recorded_at)}</small>
            <small>Sources: {item.evidence_ids.length > 0 ? item.evidence_ids.length + " saved item(s)" : "No source is attached"}</small>
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
                  ? "No immediate-priority item appears in the information currently shown. Additional unresolved items exist beyond this view."
                  : "No immediate-priority items are recorded in the care information currently available."}</p>
              ) : (
                <ul className="lcr-current-facts">
                  {needsAttentionNow.map((item) => {
                    const source = sourceForLoop(item);
                    return (
                      <li key={item.source + ":" + item.id} className="lcr-current-fact">
                        <strong>{caregiverSafeAssistantText(item.title) || "Care record item"}</strong>
                        <p>{caregiverSafeAssistantText(item.description || source?.description) || "No further description was recorded."}</p>
                        <p className="lcr-entry-status">
                          Why it appears: {(item.priority_reasons ?? []).map(caregiverSafeAssistantText).filter(Boolean).join("; ") || "The saved record marks this item for attention, but no reason was provided."}
                        </p>
                        <p className="lcr-entry-status">
                          Status: {caregiverLabel(item.recorded_status)} · How certain this is: {caregiverLabel(item.epistemic_status)} · Source: {caregiverLabel(item.source)}
                        </p>
                        <small>When it happened: {formatWhen(item.occurred_at)} · When it was saved: {formatWhen(item.recorded_at)}</small>
                        {item.owner && <small>Responsible person: {caregiverSafeAssistantText(item.owner) || "Not recorded"}</small>}
                        {item.request_text && <p>Follow-up request: {caregiverSafeAssistantText(item.request_text) || "A follow-up was requested."}</p>}
                        {item.verification_rule && <small>How completion was checked: {caregiverSafeAssistantText(item.verification_rule) || "No further details are available."}</small>}
                        {item.outcome_status && <small>Recorded outcome status: {caregiverStatusLabel(item.outcome_status) || "Status not available"}</small>}
                        {item.due_at && <small>Due date: {formatWhen(item.due_at)}</small>}
                        {item.evidence_ids.length > 0
                          ? <small>Sources: {item.evidence_ids.length} saved item(s)</small>
                          : <small>This item was marked for follow-up in the saved record, but no supporting information is linked here.</small>}
                        {source?.source_label && <small>Shared by: {caregiverSafeAssistantText(source.source_label) || "Not recorded"}</small>}
                        {source?.source_passage && <details><summary>Read source passage</summary><blockquote>{caregiverSafeAssistantText(source.source_passage) || "The original note is saved."}</blockquote></details>}
                        {source && source.claim_count > 0 && <small>{source.claim_count} related report(s). Review the saved details before deciding whether they differ.</small>}
                        {actionForSuggestion(item) ? (
                          <p className="lcr-entry-status">Agreed action: {caregiverLabel(actionForSuggestion(item)?.status)}. This suggestion has already been saved as an agreed action.</p>
                        ) : item.request_text?.trim() && item.evidence_ids.length > 0 ? (
                          <div>
                            <button type="button" className="lcr-text-action" onClick={() => {
                              setReviewingSuggestionId(reviewingSuggestionId === suggestionReference(item) ? null : suggestionReference(item));
                              setActionApprovalError(null);
                              setCreateReminderForSuggestion(false);
                              setReminderDueInput("");
                            }}>Review suggested follow-up for approval</button>
                            {reviewingSuggestionId === suggestionReference(item) && (
                              <div className="lcr-current-fact" aria-label="Review suggested action before approval">
                                <strong>Suggested follow-up — not a registered action</strong>
                                <p>Proposed action: {caregiverSafeAssistantText(item.request_text) || "A follow-up request was saved."}</p>
                                <p>Why suggested: {(item.priority_reasons ?? []).map(caregiverSafeAssistantText).filter(Boolean).join("; ") || caregiverSafeAssistantText(item.description) || "A follow-up request is saved in the care record."}</p>
                                <p>Sources: {item.evidence_ids.length} saved item(s)</p>
                                <p>What this does not tell us: This information is marked {caregiverLabel(item.epistemic_status)}. This suggestion does not establish clinical urgency or resolve uncertainty.</p>
                                <p>Responsible caregiver: the caregiver authenticated in this session. No other caregiver will be assigned.</p>
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
                                  setClarificationPrefill({
                                    question: item.request_text?.trim() || item.description || item.title,
                                    evidenceIds: item.evidence_ids,
                                  });
                                  document.getElementById("lcr-clarification-workflow")?.scrollIntoView({ behavior: "smooth", block: "start" });
                                }}>
                                  Request clarification
                                </button>
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
                <h4 id="lcr-care-attention-review-heading">Important changes and follow-ups</h4>
                <p>These items deserve review based on the saved care history. They are not automatically emergencies.</p>
                {careAttention.important_to_address.length > 0 && (
                  <ul className="lcr-current-facts">
                    {careAttention.important_to_address.map((item) => (
                      <li key={item.id || item.source + ":" + item.record_id} className="lcr-current-fact">
                        <strong>{caregiverSafeAssistantText(item.title) || "Care information to review"}</strong>
                        <p>{caregiverSafeAssistantText(item.reason || item.priority_basis?.join("; ")) || "The saved care information indicates this needs follow-up."}</p>
                        {item.records?.map((record) => (
                          <small key={record.source + ":" + record.record_id}>
                            {caregiverSafeAssistantText(record.title) || "Saved care record"} · Happened: {formatWhen(record.occurred_at)} · Saved: {formatWhen(record.recorded_at)}
                          </small>
                        ))}
                        {item.evidence_ids && item.evidence_ids.length > 0 && <small>Linked sources: {item.evidence_ids.length}</small>}
                      </li>
                    ))}
                  </ul>
                )}
                {careAttention.needs_clarification.length > 0 && (
                  <>
                    <h5>Needs clarification</h5>
                    <p>Some details are missing or reports do not agree. SolenOS cannot determine the right next step until the information is checked.</p>
                    <ul className="lcr-current-facts">
                      {careAttention.needs_clarification.map((item) => (
                        <li key={item.id || item.source + ":" + item.record_id} className="lcr-current-fact">
                          <strong>{caregiverSafeAssistantText(item.title) || "Information needs checking"}</strong>
                          <p>{caregiverSafeAssistantText(item.reason) || "The available information is not enough to determine the appropriate priority."}</p>
                          <small>Source: {caregiverLabel(item.source)} · Happened: {formatWhen(item.occurred_at)} · Saved: {formatWhen(item.recorded_at)}</small>
                          {item.evidence_ids && item.evidence_ids.length > 0 && <small>Linked sources: {item.evidence_ids.length}</small>}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                <small>Assessment uses saved records only. Missing history is not evidence that nothing happened, and grouped observations do not establish cause or diagnosis.</small>
              </section>
            )}

            {assessment.coverage.records_examined > 0 && (
            <div className="lcr-current-fact" aria-labelledby="lcr-attention-wait-heading">
              <h4 id="lcr-attention-wait-heading">Previously postponed</h4>
              {canWaitItems.length === 0 ? (
                <p>No care items are currently recorded as postponed. Unresolved items are not automatically safe to put off.</p>
              ) : (
                <>
                  <p>These items were recorded as postponed. That does not confirm they are safe to wait now. Check the review date and current care information before relying on the postponement.</p>
                  <ul className="lcr-current-facts">
                  {canWaitItems.map((item) => (
                    <li key={item.source + ":" + item.id} className="lcr-current-fact">
                      <strong>{caregiverSafeAssistantText(item.title) || "Care record item"}</strong>
                      <p>{item.description || "No extra details were saved."}</p>
                      <p className="lcr-entry-status">Why this was postponed: {caregiverSafeAssistantText(item.deferred_reason) || "No reason was recorded."}</p>
                      <p className="lcr-entry-status">Status: {caregiverLabel(item.recorded_status)} · Priority: {caregiverLabel(item.priority)} · How certain this is: {caregiverLabel(item.epistemic_status)}</p>
                      {item.request_text && <p>Follow-up request: {caregiverSafeAssistantText(item.request_text) || "A follow-up request was saved."}</p>}
                      {item.verification_rule && <small>How completion was checked: {caregiverSafeAssistantText(item.verification_rule) || "A completion check was saved."}</small>}
                      {item.review_at && <small>Review date: {formatWhen(item.review_at)}</small>}
                      {!item.review_at && <small>No review date was recorded.</small>}
                      {item.priority_reasons && item.priority_reasons.length > 0
                        ? <small>Reasons for the priority: {item.priority_reasons.map(caregiverSafeAssistantText).filter(Boolean).join("; ") || "No readable reason was recorded."}</small>
                        : <small>No reason for the priority change was saved. Review it again if the care information changes.</small>}
                      <small>When it happened: {formatWhen(item.occurred_at)} · When it was saved: {formatWhen(item.recorded_at)}</small>
                      <small>Where this came from: {caregiverLabel(item.source)}</small>
                      <small>Sources: {item.evidence_ids.length > 0 ? item.evidence_ids.length + " saved item(s)" : "No source is attached"}</small>
                    </li>
                  ))}
                  </ul>
                </>
              )}
            </div>
            )}


            <div className="lcr-current-fact" aria-labelledby="lcr-attention-watch-heading">
              <h4 id="lcr-attention-watch-heading">Changes to keep an eye on</h4>
              {changesError && <p role="status">We couldn’t check the saved change history. This does not mean nothing has changed.</p>}
              {patternsError && <p role="status">We couldn’t check whether any changes are repeating. This does not mean nothing is repeating.</p>}
              {watchChanges.length === 0 && watchUncertainties.length === 0 && watchPriorityCandidates.length === 0 && watchMissingInformation.length === 0 && watchOpenLoops.length === 0 && activeWatchPatterns.length === 0 && baselineItems.length === 0 ? (
                <p>{changesError || patternsError
                  ? "Some care history could not be checked. Changes may be missing from this view."
                  : "There isn’t enough saved history to describe changes yet."}</p>
              ) : (
                <ul className="lcr-current-facts">
                  {baselineItems.map((item) => (
                    <li key={"baseline:" + item.source + ":" + item.id} className="lcr-current-fact">
                      <strong>Usual or starting point · {item.title}</strong>
                      <p>This was marked as a usual or starting point for this person. It is not a comparison with other people.</p>
                      <p className="lcr-entry-status">Source: {caregiverLabel(item.source)} · Status: {caregiverLabel(item.status)} · How certain this is: {caregiverLabel(item.epistemic_status)}</p>
                      <small>When it happened: {formatWhen(item.occurred_at)} · When it was saved: {formatWhen(item.recorded_at)}</small>
                      <small>Sources: {item.evidence_ids.length > 0 ? item.evidence_ids.length + " saved item(s)" : "No source is attached"}</small>
                      {item.interpretation_limit && <small>{caregiverSafeAssistantText(item.interpretation_limit) || "The available information may not tell the whole story."}</small>}
                    </li>
                  ))}
                  {watchPriorityCandidates.map((item) => {
                    const source = projection?.items.find((candidate) =>
                      candidate.id === item.id && candidate.source_collection === item.source
                    );
                    return (
                      <li key={"candidate:" + item.source + ":" + item.id} className="lcr-current-fact">
                        <strong>Possible follow-up · {item.title}</strong>
                        <p>This item was marked for follow-up. That does not mean it needs attention right away.</p>
                        <p className="lcr-entry-status">Status: {caregiverLabel(item.status)} · How certain this is: {caregiverLabel(item.epistemic_status)} · Source: {caregiverLabel(item.source)}</p>
                        {source?.description && <p>{caregiverSafeAssistantText(source.description) || "Saved care information is available."}</p>}
                        <small>When it happened: {formatWhen(item.occurred_at)} · When it was saved: {formatWhen(item.recorded_at)}</small>
                        <small>Sources: {item.evidence_ids.length > 0 ? item.evidence_ids.length + " saved item(s)" : "No source is attached"}</small>
                        <small>Where this came from: {caregiverLabel(item.source)}</small>
                      </li>
                    );
                  })}
                  {watchOpenLoops.map((item) => (
                    <li key={"open-loop:" + item.source + ":" + item.id} className="lcr-current-fact">
                      <strong>Still needs follow-up · {item.title}</strong>
                      <p>The saved information does not say whether this needs attention now or can wait. No due date is assumed.</p>
                      <p className="lcr-entry-status">Status: {caregiverLabel(item.recorded_status)} · Priority: {caregiverLabel(item.priority)} · How certain this is: {caregiverLabel(item.epistemic_status)}</p>
                      {item.description && <p>{caregiverSafeAssistantText(item.description) || "Saved care information is available."}</p>}
                      {item.owner && <small>Responsible person: {item.owner}</small>}
                      {item.due_at && <small>Due date: {formatWhen(item.due_at)}</small>}
                      <small>When it happened: {formatWhen(item.occurred_at)} · When it was saved: {formatWhen(item.recorded_at)}</small>
                      <small>Sources: {item.evidence_ids.length > 0 ? item.evidence_ids.length + " saved item(s)" : "No source is attached"}</small>
                      <small>Where this came from: {caregiverLabel(item.source)}</small>
                    </li>
                  ))}
                  {watchMissingInformation.map((item) => (
                    <li key={"missing:" + item.source + ":" + item.id} className="lcr-current-fact">
                      <strong>Information still missing · {item.title}</strong>
                      <p>This information is still missing. That alone does not tell us how urgent it is.</p>
                      <p className="lcr-entry-status">Status: {caregiverLabel(item.status)} · How certain this is: {caregiverLabel(item.epistemic_status)} · Source: {caregiverLabel(item.source)}</p>
                      <small>When it happened: {formatWhen(item.occurred_at)} · When it was saved: {formatWhen(item.recorded_at)}</small>
                      <small>Sources: {item.evidence_ids.length > 0 ? item.evidence_ids.length + " saved item(s)" : "No source is attached"}</small>
                      <small>Where this came from: {caregiverLabel(item.source)}</small>
                    </li>
                  ))}
                  {watchUncertainties.filter((item) => !isMedicationConflict(item)).map((item) => {
                    const source = projection?.items.find((candidate) =>
                      candidate.id === item.id && candidate.source_collection === item.source
                    );
                    const disputed = item.source === "conflicts" || item.source === "reconciliations";
                    return (
                      <li key={item.source + ":" + item.id} className="lcr-current-fact">
                        <strong>{caregiverSafeAssistantText(item.title) || "Care record item"}</strong>
                        <p>{disputed ? "Reports do not match, and the difference has not been resolved. Neither report is treated as correct." : "This still needs to be checked."}</p>
                        <p className="lcr-entry-status">Status: {caregiverLabel(item.status)} · How certain this is: {caregiverLabel(item.epistemic_status)} · Source: {caregiverLabel(item.source)}</p>
                        {source?.description && <p>{caregiverSafeAssistantText(source.description) || "Saved care information is available."}</p>}
                        {source?.source_passage && <details><summary>Read source passage</summary><blockquote>{caregiverSafeAssistantText(source.source_passage) || "The original note is saved."}</blockquote></details>}
                        <small>When it happened: {formatWhen(item.occurred_at)} · When it was saved: {formatWhen(item.recorded_at)}</small>
                        <small>Sources: {item.evidence_ids.length > 0 ? item.evidence_ids.length + " saved item(s)" : "No source is attached"}</small>
                        <small>Where this came from: {caregiverLabel(item.source)}</small>
                      </li>
                    );
                  })}
                  {watchChanges.map((change) => (
                    <li key={change.id} className="lcr-current-fact">
                      <strong>{caregiverLabel(change.subject_type)} · {caregiverLabel(change.change_type)}</strong>
                      <p>{change.explanation || "A possible change was saved, but no explanation is available."}</p>
                      <p>Previously recorded: {change.previous_state ?? "Not recorded"} · Currently recorded: {change.current_state ?? "Not recorded"}</p>
                      <p className="lcr-entry-status">Review this if a new report or correction changes the saved information. No medical limit is assumed.</p>
                      <p className="lcr-entry-status">
                        Review state: {caregiverLabel(change.confirmation_status || "not recorded")}. 
                        {change.confirmation_status === "rejected"
                          ? " A caregiver disputed this change. It is not shown as confirmed."
                          : change.confirmation_status === "inconclusive"
                            ? " This change could not be confirmed."
                            : change.confirmation_status === "confirmed"
                              ? " A caregiver confirmed this change. This is not a medical diagnosis."
                              : " This possible change has not been confirmed."}
                      </p>
                      <small>Dates compared: {formatWhen(change.comparison_window_start)} – {formatWhen(change.comparison_window_end)}</small>
                      <small>Sources: {change.evidence_ids.length} saved item(s)</small>
                      <button type="button" className="lcr-text-action" onClick={() => void loadChangeEvidence(change)} disabled={evidenceLoadingId === change.id || change.evidence_ids.length === 0} aria-expanded={expandedChangeId === change.id}>
                        {expandedChangeId === change.id ? "Hide supporting records" : "View supporting records"}
                      </button>
                      {expandedChangeId === change.id && changeEvidence[change.id]?.error && <p role="status">{changeEvidence[change.id]?.error}</p>}
                      {expandedChangeId === change.id && changeEvidence[change.id]?.evidence.map((source) => (
                        <article key={source.id}>
                          <strong>{source.title}</strong>
                          <p>{source.description || "No source description was recorded."}</p>
                          <small>Event: {formatWhen(source.occurred_at)} · Recorded: {formatWhen(source.recorded_at)}</small>
                        </article>
                      ))}
                    </li>
                  ))}
                  {activeWatchPatterns.map((pattern) => (
                    <li key={pattern.id} className="lcr-current-fact">
                      <strong>{caregiverLabel(pattern.subject_type)} · {caregiverLabel(pattern.pattern_type)}</strong>
                      <p>Saved between {formatWhen(pattern.temporal_start)} and {formatWhen(pattern.temporal_end)} across {pattern.evidence_count} event(s).</p>
                      {pattern.direction && <p>Change noted: {caregiverLabel(pattern.direction)}</p>}
                      <p className="lcr-entry-status">Review this again if new information or a correction changes the dates being compared. This does not show what caused the change or whether it is medically important.</p>
                      {pattern.alternative_interpretations?.length ? (
                        <div>
                          <strong>Other possible explanations</strong>
                          {pattern.alternative_interpretations.map((alternative, index) => <p key={index}>{typeof alternative === "string" ? alternative : "Another possible explanation was saved."}</p>)}
                        </div>
                      ) : <p>Other possible explanations were not provided. No cause is assumed.</p>}
                      <small>Saved events: {pattern.event_ids.length}</small>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </section>

            {(registeredActions.length > 0 || Boolean(registeredActionsError) || (assessment?.coverage.records_examined ?? 0) > 0) && (
            <div className="lcr-current-fact" aria-labelledby="lcr-registered-actions-heading">
              <h4 id="lcr-registered-actions-heading">Agreed actions</h4>
              {registeredActionsError && <p role="alert">Agreed actions could not be loaded: {registeredActionsError}. Do not assume there are no active actions.</p>}
              {!registeredActionsError && registeredActions.length === 0 && <p>No actions have been agreed yet.</p>}
              {registeredActions.length > 0 && (
                <ul className="lcr-current-facts">
                  {registeredActions.map((action) => (
                    <li key={action.id} className="lcr-current-fact">
                      <strong>{caregiverSafeAssistantText(action.normalized_action) || "Saved care action"}</strong>
                      <p className="lcr-entry-status">Agreed action · {caregiverStatusLabel(action.status) || "Status not available"}</p>
                      <small>Approved: {formatWhen(action.approved_at)} · Responsible caregiver: {action.responsible_caregiver_id === currentCaregiverId ? "You" : "Another caregiver"} · Created by: {action.created_by_caregiver_id === currentCaregiverId ? "You" : "Another caregiver"}</small>
                      <small>Sources: {(action.source_evidence_ids ?? [action.source_evidence_id]).length} saved item(s)</small>
                      {action.deadline && <small>Due date: {formatWhen(action.deadline)}</small>}
                      {action.linked_reminder_status && <small>Linked reminder: {caregiverStatusLabel(action.linked_reminder_status) || "Status not available"} · Due {formatWhen(action.linked_reminder_due_at)}</small>}
                      {action.completed_at && <small>Explicitly marked completed: {formatWhen(action.completed_at)}</small>}
                      {action.deferred_until && <small>Deferred until: {formatWhen(action.deferred_until)}</small>}
                      {action.responsible_caregiver_id !== currentCaregiverId && <p role="status">Only the responsible caregiver can change this action. You can still review its status and change history.</p>}
                      <label>
                        Reason for deferring, cancelling or requesting clarification
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
                      {["approved", "in_progress", "deferred"].includes(action.status) && <button type="button" disabled={action.responsible_caregiver_id !== currentCaregiverId || actionTransitionLoadingId === action.id} onClick={() => void transitionRegisteredAction(action, "needs_clarification")}>Needs clarification</button>}
                      {!["completed", "cancelled"].includes(action.status) && <button type="button" disabled={action.responsible_caregiver_id !== currentCaregiverId || actionTransitionLoadingId === action.id} onClick={() => void transitionRegisteredAction(action, "cancelled")}>Cancel action</button>}
                      {actionTransitionErrors[action.id] && <p role="alert">{actionTransitionErrors[action.id]}</p>}
                      <button type="button" className="lcr-text-action" onClick={() => void loadActionHistory(action)}>View change history</button>
                      {actionHistoryErrors[action.id] && <p role="alert">{actionHistoryErrors[action.id]}</p>}
                      {actionHistory[action.id] && (
                        <ol>
                          {actionHistory[action.id].map((event) => (
                            <li key={event.id}>
                              {caregiverStatusLabel(event.previous_status) || "Not recorded"} → {caregiverStatusLabel(event.new_status) || "Status not available"} · {formatWhen(event.created_at)} · Changed by: {event.actor_caregiver_id === currentCaregiverId ? "You" : "Another caregiver"}
                              {event.reason && <p>{caregiverSafeAssistantText(event.reason) || "A reason was recorded."}</p>}
                              <small>Sources: {event.evidence_ids.length} saved item(s)</small>
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


      <details className="lcr-history-details"><summary>See repeated changes over time</summary>
      <div className="lcr-situation-assessment" aria-labelledby="lcr-pattern-history-heading">
        <div className="lcr-entry-heading">
          <h3 id="lcr-pattern-history-heading">Repeated changes over time</h3>
          <span>{patterns.filter((pattern) => pattern.is_active && !pattern.superseded_by_pattern_id).length} repeated changes in the saved history</span>
        </div>
        {patternsError && <p role="status">Saved repeated-change history could not be loaded: {patternsError}</p>}
        {!patternsError && patterns.length === 0 && (
          <p>There is not enough saved history to tell whether something repeats yet.</p>
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
                  Recorded in {pattern.evidence_count} event(s), from {formatWhen(pattern.temporal_start)} to {formatWhen(pattern.temporal_end)}.
                </p>
                {pattern.rate_per_period != null && (
                  <p className="lcr-entry-status">Saved records show {pattern.rate_per_period.toFixed(2)} events every 30 days. This counts saved records only, not events that may have gone unrecorded.</p>
                )}
                {pattern.direction && <p className="lcr-entry-status">Change noted: {caregiverLabel(pattern.direction)}</p>}
                {pattern.confidence == null && <p className="lcr-entry-status">There is not enough information to know how reliable this repeated change is.</p>}
                {pattern.alternative_interpretations?.map((item, index) => (
                  <p className="lcr-entry-status" key={index}>
                    {caregiverSafeAssistantText(item) || "Additional details are saved."}
                  </p>
                ))}
                <small>Saved events: {pattern.event_ids.length}</small>
              </li>
            ))}
          </ul>
        )}
      </div>

      </details>
      <details className="lcr-history-details"><summary>Review saved changes</summary>
      <div className="lcr-situation-assessment" aria-labelledby="lcr-change-history-heading">
        <div className="lcr-entry-heading">
          <h3 id="lcr-change-history-heading">Changes over time</h3>
          <span>{changes.length} saved change reviews</span>
        </div>
        {changesError && <p role="status">Saved change history could not be loaded: {changesError}</p>}
        {!changesError && changes.length === 0 && (
          <p>There is not enough saved information to describe changes yet. Missing records do not mean nothing changed.</p>
        )}
        {changes.length > 0 && (
          <ul className="lcr-current-facts">
            {changes.map((change) => (
              <li key={change.id} className="lcr-current-fact">
                <div className="lcr-entry-heading">
                  <strong>{caregiverLabel(change.subject_type)} · {caregiverLabel(change.change_type)}</strong>
                  <span>{change.significance_verdict ? caregiverLabel(change.significance_verdict) : "Not reviewed yet"}</span>
                </div>
                <p>{change.explanation || "No explanation was saved with this change review."}</p>
                <p className="lcr-entry-status">
                  Previous: {change.previous_state ?? "Not recorded"} · Current: {change.current_state ?? "Not recorded"}
                </p>
                <p className="lcr-entry-status">
                  Review status: {caregiverLabel(change.is_active === false || change.superseded_by_change_id ? "superseded" : change.confirmation_status || "detected")}
                </p>
                <label className="lcr-evidence-reason">
                  Review note
                  <textarea
                    value={confirmationReason[change.id] || ""}
                    onChange={(event) => setConfirmationReason((previous) => ({ ...previous, [change.id]: event.target.value }))}
                    rows={2}
                    maxLength={2000}
                  />
                  <small>Add context or explain why this change may be incorrect or uncertain.</small>
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
                <small>Compared: {formatWhen(change.comparison_window_start)} – {formatWhen(change.comparison_window_end)}</small>
                <small>Sources: {change.evidence_ids.length} saved item(s)</small>
                <button
                  type="button"
                  className="lcr-text-action"
                  onClick={() => void loadChangeEvidence(change)}
                  disabled={evidenceLoadingId === change.id || change.evidence_ids.length === 0}
                  aria-expanded={expandedChangeId === change.id}
                >
                  {evidenceLoadingId === change.id
                    ? "Loading saved evidence…"
                    : expandedChangeId === change.id
                      ? "Hide supporting evidence"
                      : "View supporting evidence"}
                </button>
                {expandedChangeId === change.id && (
                  <div className="lcr-current-facts" aria-label="Supporting information">
                    {changeEvidence[change.id]?.error && (
                      <p role="status">Saved source details could not be loaded. Please try again.</p>
                    )}
                    {changeEvidence[change.id]?.evidence.map((item) => (
                      <article key={item.id} className="lcr-current-fact">
                        <strong>{caregiverSafeAssistantText(item.title) || "Care record item"}</strong>
                        <p>{item.description || "No source description was recorded."}</p>
                        <small>{item.event_type === "structured_daily_capture" ? "Daily care update" : item.event_type === "quick_daily_checkin" ? "Daily check-in" : caregiverLabel(item.event_type)} · {item.status === "recorded" ? "Saved" : caregiverLabel(item.status)}</small>
                        <small>Observed: {formatWhen(item.occurred_at)}{item.occurred_at_timezone ? ` (${item.occurred_at_timezone})` : ""}</small>
                        <small>Recorded: {formatWhen(item.recorded_at)}</small>
                        <small>Time details: {caregiverLabel(item.time_provenance)}</small>
                      </article>
                    ))}
                    {changeEvidence[change.id] && !changeEvidence[change.id].error && changeEvidence[change.id].evidence.length === 0 && (
                      <p>No supporting source details are available for the linked information.</p>
                    )}
                    {changeEvidence[change.id]?.assertions.length > 0 && (
                      <div aria-label="Saved reports">
                        <strong>Recorded observations</strong>
                        <ul>
                          {changeEvidence[change.id].assertions.map((assertion) => (
                            <li key={assertion.id}>
                              <p>{caregiverLabel(assertion.field)}: {assertion.asserted_value}</p>
                              <small>{caregiverLabel(assertion.subject_type)} · Information: {caregiverInformationLabel(assertion.epistemic_state || "reported") || "Caregiver report"} · Review: {caregiverLabel(assertion.assertion_status)} · {caregiverSafeAssistantText(assertion.source_label) || "Saved care record"}</small>
                              <small>Observed: {formatWhen(assertion.observed_at)} · Recorded: {formatWhen(assertion.recorded_at)}</small>
                              {assertion.source_text && <p>{caregiverSafeAssistantText(assertion.source_text) || "The original wording is saved."}</p>}
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
                              {transition.reason && <p>{transition.reason}</p>}
                              <small>Recorded {formatWhen(transition.created_at)} · reviewed by a caregiver</small>
                              {transition.evidence_ids.length > 0 && <small>Information used for this review: {transition.evidence_ids.length} saved item(s)</small>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
                {change.is_persistent === true && <small>Persistence: recorded as persistent{change.persistence_days != null ? ` for ${change.persistence_days} days` : ""}</small>}
                {change.is_persistent === false && <small>Persistence: not established</small>}
                {(change.attention_candidate || change.follow_up_candidate) && (
                  <small>{[change.attention_candidate ? "Attention candidate" : null, change.follow_up_candidate ? "Follow-up candidate" : null].filter(Boolean).join(" · ")}</small>
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
        <p role="status">Loading saved care information…</p>
      ) : error ? (
        <div role="alert" className="lcr-empty-state">
          <AlertCircle size={20} aria-hidden="true" />
          <h3>Your care information isn’t available right now</h3>
          <p>We couldn’t load this care information. Check your connection and try again. Your saved records have not been changed.</p>
          
          <button type="button" className="lcr-text-action" onClick={() => void load(true)}>Try again</button>
        </div>
      ) : projection ? (
        <>
          {(projection.schema_status !== "complete" || projection.missing_required_sources.length > 0) && (
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
            <div className="lcr-empty-state">
              <h3>Your Living Care Record does not have any care information available yet.</h3>
              <p>Share what you know through AI Companion. Information reviewed and approved there will appear in your care record.</p>
            </div>
          ) : (
            <div className="lcr-current-facts">
              <ul>
                {projection.items.map((item) => (
                  <li key={item.source_collection + ":" + item.id} className="lcr-current-fact">
                    <div className="lcr-entry-heading">
                      <strong>{displayCurrentCareTitle(item)}</strong>
                      <span>{caregiverLabel(item.epistemic_status)}</span>
                    </div>
                    <p style={{ whiteSpace: "pre-line" }}>{displayDescription(item.description)}</p>
                    <p className="lcr-entry-status">{caregiverLabel(item.kind)} · {item.status === "recorded" ? "Saved" : caregiverStatusLabel(item.status) || "Status not available"}</p>
                    <small>Shared by: {caregiverSafeAssistantText(item.source_label) || "Not recorded"} · {item.occurred_at ? `Event: ${formatWhen(item.occurred_at)} · ` : ""}{item.reported_at ? `Caregiver reported: ${formatWhen(item.reported_at)} · ` : ""}Recorded: {formatWhen(item.recorded_at || item.occurred_at)}</small>
                    {item.evidence_ids?.length > 0 && <small>Original caregiver report linked to this entry</small>}
                    {item.evidence_link_validation && <small>{item.evidence_link_validation === "valid" ? "Source record linked" : "Source details: " + (caregiverStatusLabel(item.evidence_link_validation) || "Not available")}</small>}
                    {item.derived_observations && item.derived_observations.length > 0 && (
                      <details className="lcr-entry-status">
                        <summary>What was taken from this note ({item.derived_observations.length})</summary>
                        <p>These are structured readings of the same source report, not independent corroborating reports.</p>
                        <ul>
                          {item.derived_observations.map((observation) => (
                            <li key={observation.id}>
                              <strong>{caregiverLabel(observation.attribute || observation.observation_kind)}</strong>
                              {observation.subject_label && <small>About: {caregiverSafeAssistantText(observation.subject_label) || "Person receiving care"}</small>}
                              {observation.observer_label && <small>Reported by: {caregiverSafeAssistantText(observation.observer_label) || "Not recorded"}</small>}
                              {observation.observation_method && <small>Observation method: {caregiverLabel(observation.observation_method)}</small>}
                              {observation.context != null && <p>Context: {typeof observation.context === "string" ? caregiverSafeAssistantText(observation.context) || "Additional details are saved." : "Additional details are saved."}</p>}
                              {observation.value_text && <p>{caregiverSafeAssistantText(observation.value_text) || "A recorded detail is available in the original note."}</p>}
                              <small>Observed: {formatWhen(observation.observed_at)} · Recorded: {formatWhen(observation.recorded_at)}</small>
                              {observation.source_passage && (
                                <details>
                                  <summary>Read the original note</summary>
                                  <blockquote>{caregiverSafeAssistantText(observation.source_passage) || "The original note is saved."}</blockquote>
                                </details>
                              )}
                              {observation.negated != null && <small>Does the note say this did not happen? {observation.negated ? "Yes" : "No"}</small>}
                              {observation.hedge_marker && <small>Words that show uncertainty: {caregiverLabel(observation.hedge_marker)}</small>}
                              {observation.ambiguity_note && <small>What is unclear: {caregiverSafeAssistantText(observation.ambiguity_note) || "More information may be needed."}</small>}
                              {observation.correction_rationale && <small>Why it was corrected: {caregiverSafeAssistantText(observation.correction_rationale) || "A correction was recorded."}</small>}
                              <small>The exact source passage is retained.</small>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                    {item.source_collection === "evidence_observations" && (
                      <div className="lcr-entry-status">
                        <small>
                          Exact source wording is retained ·
                          {" "}Details read from the saved note ·
                          {" "}Did the note say this did not happen? {item.negated == null ? "Not recorded" : item.negated ? "Yes" : "No"}
                        </small>
                        {item.source_passage && (
                          <details>
                            <summary>Read the original note</summary>
                            <blockquote>{caregiverSafeAssistantText(item.source_passage) || "The original note is saved."}</blockquote>
                          </details>
                        )}
                        {item.supersedes_observation_id && <small>This entry corrects an earlier observation.</small>}
                        {item.correction_rationale && <small>Why it was corrected: {caregiverSafeAssistantText(item.correction_rationale) || "A correction was recorded."}</small>}
                        {item.hedge_marker && <small>Words that show uncertainty: {caregiverLabel(item.hedge_marker)}</small>}
                        {item.ambiguity_note && <small>What is unclear: {caregiverSafeAssistantText(item.ambiguity_note) || "More information may be needed."}</small>}
                      </div>
                    )}
                    {item.evidence_ids?.length > 0 && <small>How the source was reviewed: {caregiverLabel(item.evidence_assessment_coverage || "not returned")}</small>}
                    {item.evidence_assessments?.map((review) => (
                      <div key={review.evidence_id + ":" + review.review_type} className="lcr-entry-status">
                        <small>{caregiverLabel(review.review_type)}: {caregiverStatusLabel(review.outcome) || "Status not available"} · reviewed {formatWhen(review.reviewed_at)}</small>
                        <small>{caregiverSafeAssistantText(review.rationale) || "No further explanation is available."}</small>
                      </div>
                    ))}
                    {item.claim_count > 0 && <small>Different reports linked: {item.claim_count}</small>}
                    {item.source_collection === "facts" && (
                      <div className="lcr-evidence-integrity">
                        <button type="button" onClick={() => void loadEvidenceIntegrity(item.id)} disabled={evidenceIntegrityLoadingId === item.id}>
                          {evidenceIntegrityLoadingId === item.id ? "Checking linked evidence…" : "View supporting information"}
                        </button>
                        {evidenceIntegrityErrors[item.id] && <p role="alert">{evidenceIntegrityErrors[item.id]}</p>}
                        {evidenceIntegrityByFact[item.id] && (
                          <div>
                            <small>Supporting sources: {evidenceIntegrityByFact[item.id].linked_evidence_count} · Reports from different sources: {caregiverStatusLabel(evidenceIntegrityByFact[item.id].independent_corroboration_status) || "Not checked"}</small>
                            {evidenceIntegrityByFact[item.id].duplicate_content_candidates.map(group => (
                              <p key={group.fingerprint}><small>The same wording appears in {group.evidence_ids.length} other saved item(s). {caregiverSafeAssistantText(group.interpretation) || "These may not be separate reports."}</small></p>
                            ))}
                            {evidenceIntegrityByFact[item.id].near_duplicate_analysis && (
                              <div>
                                <small>Similar wording check: {caregiverStatusLabel(evidenceIntegrityByFact[item.id].near_duplicate_analysis?.status) || "Not checked"} · {evidenceIntegrityByFact[item.id].near_duplicate_analysis?.records_considered ?? 0} of {evidenceIntegrityByFact[item.id].near_duplicate_analysis?.records_available ?? 0} saved items compared.</small>
                                {evidenceIntegrityByFact[item.id].near_duplicate_analysis?.candidate_groups?.map(group => (
                                  <p key={group.evidence_ids.join(":")}><small>Similar wording appears in {group.evidence_ids.length} saved item(s). {caregiverSafeAssistantText(group.interpretation) || "This does not prove the reports are the same."}</small></p>
                                ))}
                                <small>{caregiverSafeAssistantText(evidenceIntegrityByFact[item.id].near_duplicate_analysis?.interpretation_limit) || "Similar wording does not prove that reports came from the same source."}</small>
                              </div>
                            )}
                            <small>{caregiverSafeAssistantText(evidenceIntegrityByFact[item.id].interpretation_limit) || "The relationship between these reports is not fully known."}</small>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              {projection.has_more && <p>Showing the first {projection.item_count} prioritized items. More items exist in the record.</p>}
            </div>
          )}
          <p className="lcr-footer-note">Information shown as of {formatWhen(projection.as_of)}. This view reflects the records currently available to SolenOS.</p>
          <p className="lcr-footer-note">{caregiverSafeAssistantText(projection.notice) || "This view reflects the care information currently available."}</p>
        </>
      ) : null}
      <div id="lcr-clarification-workflow"><ClarificationWorkflowPanel personId={personId} prefillQuestion={clarificationPrefill?.question} prefillEvidenceIds={clarificationPrefill?.evidenceIds} /></div>
      <details className="lcr-advanced-integrity" onToggle={(event) => setAdvancedPanelsOpen(event.currentTarget.open)}>
        <summary>Where this information came from</summary>
        <p className="lcr-footer-note">Review the sources behind recorded information, what remains uncertain and how corrections are preserved. A caregiver report is not automatically a verified fact.</p>
        <details className="lcr-history-details">
          <summary>Evidence and sources</summary>
          {advancedPanelsOpen ? <EvidenceReviewPanel personId={personId} /> : null}
        </details>
        <details className="lcr-history-details">
          <summary>Review information supporting a care detail</summary>
          {advancedPanelsOpen ? <ClaimAssessmentPanel /> : null}
        </details>
        <details className="lcr-history-details">
          <summary>When information differs</summary>
          {advancedPanelsOpen ? <ConflictResolutionPanel personId={personId} /> : null}
        </details>
        <details className="lcr-history-details">
          <summary>Reported information and record history</summary>
          {advancedPanelsOpen ? <CareContinuityIntegrityPanel personId={personId} /> : null}
        </details>
      </details>
    </section>
  );
}
