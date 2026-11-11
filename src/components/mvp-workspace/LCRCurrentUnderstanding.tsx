"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { AlertCircle, RefreshCw } from "lucide-react";
import { ensureAnonymousSession, getJSON, postJSON, patchJSON } from "@/api/client";
import { selectDeferredItems, selectImmediatePriorities, selectWatchChanges } from "@/components/mvp-workspace/attention-now";
// Advanced review panels are code-split so they do not block the first caregiver view.
const CareContinuityIntegrityPanel = dynamic(() => import("@/components/CareContinuityIntegrityPanel"), { ssr: false, loading: () => <p role="status">Loading care-integrity tools…</p> });
const EvidenceReviewPanel = dynamic(() => import("@/components/EvidenceReviewPanel"), { ssr: false, loading: () => <p role="status">Loading evidence review…</p> });
const ClaimAssessmentPanel = dynamic(() => import("@/components/ClaimAssessmentPanel"), { ssr: false, loading: () => <p role="status">Loading claim review…</p> });
const ConflictResolutionPanel = dynamic(() => import("@/components/ConflictResolutionPanel"), { ssr: false, loading: () => <p role="status">Loading conflict review…</p> });
const ClarificationWorkflowPanel = dynamic(() => import("@/components/ClarificationWorkflowPanel"), { ssr: false, loading: () => <p role="status">Loading clarification workflow…</p> });

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
  uncertainties_and_conflicts: Array<{ id: string; source: string; title: string; status: string; epistemic_status: string; occurred_at?: string | null; recorded_at?: string | null; evidence_ids: string[] }>;
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
  return DOCUMENT_ASSERTION_LABELS[item.title || ""] || item.title || item.kind || "Care record item"
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
              .map((item) => item.replaceAll("_", " "))
          : [];
        const summary = typeof parsedRecord.notes === "string" ? parsedRecord.notes : "";
        return [
          summary,
          `Update type: ${kindLabels[String(quick.kind)] || "Caregiver check-in"}`,
          areas.length ? `Areas selected: ${areas.join(", ")}` : "",
          quick.scope === "selected_areas_only" ? "Scope: selected areas only" : "",
        ].filter(Boolean).join("\n");
      }
      const entries = Object.entries(parsedRecord)
        .filter(([, item]) => item !== null && item !== undefined && item !== "");
      if (entries.length > 0) {
        return entries.map(([key, item]) =>
          `${key.replaceAll("_", " ")}: ${typeof item === "string" ? item : JSON.stringify(item)}`
        ).join("\n");
      }
    }
    if (typeof parsed === "string") return parsed;
  } catch {
    // Plain text is preserved exactly as saved.
  }
  return value;
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
  return CAREGIVER_LABELS[normalized]
    ?? normalized.replaceAll("_", " ").replace(/\\b\\w/g, (letter) => letter.toUpperCase());
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
        throw new Error("A valid care-record session is required to read the longitudinal record.");
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
              throw new Error("Registered actions did not match the active care-record session.");
            }
            setRegisteredActions(savedActions as RegisteredAction[]);
            setRegisteredActionsError(null);
          } catch (cause) {
            setRegisteredActions([]);
            setRegisteredActionsError(cause instanceof Error ? cause.message : "Registered actions could not be loaded.");
          }
        })(),
        (async () => {
          const validateChanges = (value: unknown): PersistedChange[] => {
            if (!Array.isArray(value) || value.some((item) => item?.person_id !== scopedPersonId)) {
              throw new Error("The persisted change history did not match the active care-record session.");
            }
            return value as PersistedChange[];
          };
          try {
            setChanges(validateChanges(await getJSON(changePath)));
            setChangesError(null);
          } catch (cause) {
            setChanges([]);
            setChangesError(cause instanceof Error ? cause.message : "Persisted change history is unavailable.");
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
            setPatternsError(cause instanceof Error ? cause.message : "Saved repeated-change history is unavailable.");
          }
        })(),
        (async () => {
          try {
            const saved = await getJSON("/care-continuity/situation-understanding") as SituationAssessmentResponse;
            if (saved.status === "available" && saved.assessment?.person_id === scopedPersonId) {
              setAssessment(saved.assessment);
              setSourceFreshness(saved.source_freshness ?? null);
              setAssessmentError(null);
            } else {
              setAssessment(null);
              setSourceFreshness(null);
              setAssessmentError("No saved situation assessment is available yet. Refresh the care picture when you need a new assessment.");
            }
          } catch (cause) {
            setAssessment(null);
            setSourceFreshness(null);
            setAssessmentError(cause instanceof Error ? cause.message : "The saved situation assessment could not be loaded.");
          }
        })(),
      ];
      void Promise.allSettled(backgroundTasks).finally(() => setRefreshing(false));
    } catch (cause) {
      setPersonId("");
      setCurrentCaregiverId("");
      setProjection(null);
      setRegisteredActions([]);
      setRegisteredActionsError("Registered actions are unavailable because the caregiver session could not be established.");
      setError(cause instanceof Error ? cause.message : "The care history could not be loaded.");
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
        throw new Error("Enter a reason before rejecting this change or marking it inconclusive.");
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
        [change.id]: cause instanceof Error ? cause.message : "Confirmation could not be saved.",
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
          error: cause instanceof Error ? cause.message : "Supporting evidence could not be loaded.",
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
      setAssessmentError(cause instanceof Error ? cause.message : "Situation reassessment failed.");
    } finally {
      setAssessmentLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const refreshAfterCareRecordWrite = () => { void load(); };
    window.addEventListener("careRecordUpdated", refreshAfterCareRecordWrite);
    return () => window.removeEventListener("careRecordUpdated", refreshAfterCareRecordWrite);
  }, [load]);

  const openLoopItems = assessment?.open_loops?.items ?? [];
  const needsAttentionNow = selectImmediatePriorities(openLoopItems);
  const canWaitItems = selectDeferredItems(openLoopItems);
  const watchChanges = selectWatchChanges(changes);
  const watchUncertainties = assessment?.uncertainties_and_conflicts ?? [];
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
          rationale: (item.priority_reasons ?? []).join("; ") || item.description || "A persisted LCR follow-up request is recorded.",
          limitations: `Information status: ${item.epistemic_status}. Registration does not resolve uncertainty or establish clinical urgency.`,
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
      setActionApprovalError(cause instanceof Error ? cause.message : "The action could not be registered.");
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
      setActionApprovalError(cause instanceof Error ? cause.message : "The suggestion could not be deferred.");
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
        [action.id]: cause instanceof Error ? cause.message : "The action status could not be updated.",
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
        [action.id]: cause instanceof Error ? cause.message : "Action history could not be loaded.",
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
          <p role="status">Some information may have changed since this picture was last reviewed. Refresh to check for updates.</p>
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
                        <strong>{item.title}</strong>
                        <p>{item.description || source?.description || "No further description was recorded."}</p>
                        <p className="lcr-entry-status">
                          Why it appears: {(item.priority_reasons ?? []).join("; ") || "The saved record marks this item high priority, but the reason was not returned."}
                        </p>
                        <p className="lcr-entry-status">
                          Status: {caregiverLabel(item.recorded_status)} · Information: {caregiverLabel(item.epistemic_status)} · Source: {caregiverLabel(item.source)}
                        </p>
                        <small>Event date: {formatWhen(item.occurred_at)} · Record date: {formatWhen(item.recorded_at)}</small>
                        {item.owner && <small>Recorded owner: {item.owner}</small>}
                        {item.request_text && <p>Recorded follow-up request: {item.request_text}</p>}
                        {item.verification_rule && <small>Recorded completion check: {item.verification_rule}</small>}
                        {item.outcome_status && <small>Recorded outcome status: {item.outcome_status.replaceAll("_", " ")}</small>}
                        {item.due_at && <small>Recorded due date: {formatWhen(item.due_at)}</small>}
                        {item.evidence_ids.length > 0
                          ? <small>Supporting sources: {item.evidence_ids.length} linked record(s)</small>
                          : <small>This priority comes from a saved follow-up assessment; supporting source material is not linked here.</small>}
                        {source?.source_label && <small>Source label: {source.source_label}</small>}
                        {source?.source_passage && <details><summary>Read source passage</summary><blockquote>{source.source_passage}</blockquote></details>}
                        {source && source.claim_count > 0 && <small>Different reports linked: {source.claim_count}. Review the underlying record before resolving disagreement.</small>}
                        {actionForSuggestion(item) ? (
                          <p className="lcr-entry-status">Registered action: {actionForSuggestion(item)?.status.replaceAll("_", " ")}. This suggestion has already been explicitly registered.</p>
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
                                <p>Proposed action: {item.request_text}</p>
                                <p>Why suggested: {(item.priority_reasons ?? []).join("; ") || item.description || "The persisted open-loop record contains a follow-up request."}</p>
                                <p>Supporting sources: {item.evidence_ids.length} linked record(s)</p>
                                <p>Limitations: Information is marked {caregiverLabel(item.epistemic_status)}. This suggestion does not establish clinical urgency or resolve uncertainty.</p>
                                <p>Responsible caregiver: the caregiver authenticated in this session. No other caregiver will be assigned.</p>
                                <p>Due date: {item.due_at ? `The source record contains ${formatWhen(item.due_at)}; no reminder will be created unless you explicitly choose one below.` : "No supported due date is recorded."}</p>
                                <p>Timing context: recorded priority {item.priority || "not recorded"} · recorded consequence of delay {item.consequence_of_delay || "not recorded"} · deadline source {item.deadline_source || "not recorded"}. No deadline is invented.</p>
                                <p>Optional vs time-sensitive classification: not recorded as a separate field for this candidate. Review the recorded priority and consequence rather than assuming urgency or obligation.</p>
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
                          <small>Not eligible for registration: an explicit follow-up request and linked evidence are both required. Keep this as an informational LCR item.</small>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {assessment.coverage.records_examined > 0 && (
            <div className="lcr-current-fact" aria-labelledby="lcr-attention-wait-heading">
              <h4 id="lcr-attention-wait-heading">Things that can wait</h4>
              {canWaitItems.length === 0 ? (
                <p>No items have been explicitly deferred in the information currently available. This does not mean unresolved items are safe to postpone.</p>
              ) : (
                <ul className="lcr-current-facts">
                  {canWaitItems.map((item) => (
                    <li key={item.source + ":" + item.id} className="lcr-current-fact">
                      <strong>{item.title}</strong>
                      <p>{item.description || "No additional description was recorded."}</p>
                      <p className="lcr-entry-status">Recorded deferral: {item.deferred_reason || "The status is explicitly marked deferred; no reason was supplied."}</p>
                      <p className="lcr-entry-status">Status: {caregiverLabel(item.recorded_status)} · Priority: {item.priority || "not recorded"} · Information: {caregiverLabel(item.epistemic_status)}</p>
                      {item.request_text && <p>Recorded follow-up request: {item.request_text}</p>}
                      {item.verification_rule && <small>Recorded completion check: {item.verification_rule}</small>}
                      {item.review_at && <small>Recorded review date: {formatWhen(item.review_at)}</small>}
                      {!item.review_at && <small>No review date was recorded.</small>}
                      {item.priority_reasons && item.priority_reasons.length > 0
                        ? <small>Recorded priority factors: {item.priority_reasons.join("; ")}</small>
                        : <small>No priority-change trigger was recorded; reassess if the underlying record changes.</small>}
                      <small>Event date: {formatWhen(item.occurred_at)} · Record date: {formatWhen(item.recorded_at)}</small>
                      <small>Source type: {caregiverLabel(item.source)}</small>
                      <small>Supporting sources: {item.evidence_ids.length > 0 ? item.evidence_ids.length + " linked record(s)" : "No supporting source is linked"}</small>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            )}


            <div className="lcr-current-fact" aria-labelledby="lcr-attention-watch-heading">
              <h4 id="lcr-attention-watch-heading">Changes to keep an eye on</h4>
              {changesError && <p role="status">We couldn’t check the saved change history. This does not mean nothing has changed.</p>}
              {patternsError && <p role="status">We couldn’t check for patterns in the care history. This does not mean no patterns exist.</p>}
              {watchChanges.length === 0 && watchUncertainties.length === 0 && watchPriorityCandidates.length === 0 && watchMissingInformation.length === 0 && watchOpenLoops.length === 0 && activeWatchPatterns.length === 0 && baselineItems.length === 0 ? (
                <p>{changesError || patternsError
                  ? "Some care history could not be checked. Changes may be missing from this view."
                  : "There isn’t enough recorded history to describe changes reliably yet."}</p>
              ) : (
                <ul className="lcr-current-facts">
                  {baselineItems.map((item) => (
                    <li key={"baseline:" + item.source + ":" + item.id} className="lcr-current-fact">
                      <strong>Usual or starting point · {item.title}</strong>
                      <p>This was marked as a usual or starting point for this person. It is not a comparison with other people.</p>
                      <p className="lcr-entry-status">Source: {caregiverLabel(item.source)} · Status: {caregiverLabel(item.status)} · Information: {caregiverLabel(item.epistemic_status)}</p>
                      <small>Event date: {formatWhen(item.occurred_at)} · Record date: {formatWhen(item.recorded_at)}</small>
                      <small>Supporting sources: {item.evidence_ids.length > 0 ? item.evidence_ids.length + " linked record(s)" : "No supporting source is linked"}</small>
                      {item.interpretation_limit && <small>{item.interpretation_limit}</small>}
                    </li>
                  ))}
                  {watchPriorityCandidates.map((item) => {
                    const source = projection?.items.find((candidate) =>
                      candidate.id === item.id && candidate.source_collection === item.source
                    );
                    return (
                      <li key={"candidate:" + item.source + ":" + item.id} className="lcr-current-fact">
                        <strong>Possible follow-up · {item.title}</strong>
                        <p>This record was flagged for attention or follow-through. That flag does not establish immediate urgency.</p>
                        <p className="lcr-entry-status">Status: {caregiverLabel(item.status)} · Information: {caregiverLabel(item.epistemic_status)} · Source: {caregiverLabel(item.source)}</p>
                        {source?.description && <p>{source.description}</p>}
                        <small>Event date: {formatWhen(item.occurred_at)} · Record date: {formatWhen(item.recorded_at)}</small>
                        <small>Supporting sources: {item.evidence_ids.length > 0 ? item.evidence_ids.length + " linked record(s)" : "No supporting source is linked"}</small>
                        <small>Source type: {caregiverLabel(item.source)}</small>
                      </li>
                    );
                  })}
                  {watchOpenLoops.map((item) => (
                    <li key={"open-loop:" + item.source + ":" + item.id} className="lcr-current-fact">
                      <strong>Still needs follow-up · {item.title}</strong>
                      <p>The saved information does not say whether this needs attention now or can wait. Do not assume a deadline.</p>
                      <p className="lcr-entry-status">Status: {caregiverLabel(item.recorded_status)} · Recorded priority: {item.priority || "not assessed"} · Information: {caregiverLabel(item.epistemic_status)}</p>
                      {item.description && <p>{item.description}</p>}
                      {item.owner && <small>Recorded owner: {item.owner}</small>}
                      {item.due_at && <small>Recorded due date: {formatWhen(item.due_at)}</small>}
                      <small>Event date: {formatWhen(item.occurred_at)} · Record date: {formatWhen(item.recorded_at)}</small>
                      <small>Supporting sources: {item.evidence_ids.length > 0 ? item.evidence_ids.length + " linked record(s)" : "No supporting source is linked"}</small>
                      <small>Source type: {caregiverLabel(item.source)}</small>
                    </li>
                  ))}
                  {watchMissingInformation.map((item) => (
                    <li key={"missing:" + item.source + ":" + item.id} className="lcr-current-fact">
                      <strong>Information still missing · {item.title}</strong>
                      <p>This information is still missing. That alone does not tell us how urgent it is.</p>
                      <p className="lcr-entry-status">Status: {caregiverLabel(item.status)} · Information: {caregiverLabel(item.epistemic_status)} · Source: {caregiverLabel(item.source)}</p>
                      <small>Event date: {formatWhen(item.occurred_at)} · Record date: {formatWhen(item.recorded_at)}</small>
                      <small>Supporting sources: {item.evidence_ids.length > 0 ? item.evidence_ids.length + " linked record(s)" : "No supporting source is linked"}</small>
                      <small>Source type: {caregiverLabel(item.source)}</small>
                    </li>
                  ))}
                  {watchUncertainties.map((item) => {
                    const source = projection?.items.find((candidate) =>
                      candidate.id === item.id && candidate.source_collection === item.source
                    );
                    const disputed = item.source === "conflicts" || item.source === "reconciliations";
                    return (
                      <li key={item.source + ":" + item.id} className="lcr-current-fact">
                        <strong>{item.title}</strong>
                        <p>{disputed ? "Conflicting accounts remain unresolved. Neither account is selected as the winner." : "This item remains uncertain or requires clarification."}</p>
                        <p className="lcr-entry-status">Status: {caregiverLabel(item.status)} · Evidence state: {caregiverLabel(item.epistemic_status)} · Source: {caregiverLabel(item.source)}</p>
                        {source?.description && <p>{source.description}</p>}
                        {source?.source_passage && <details><summary>Read source passage</summary><blockquote>{source.source_passage}</blockquote></details>}
                        <small>Event date: {formatWhen(item.occurred_at)} · Record date: {formatWhen(item.recorded_at)}</small>
                        <small>Supporting sources: {item.evidence_ids.length > 0 ? item.evidence_ids.length + " linked record(s)" : "No supporting source is linked"}</small>
                        <small>Source type: {caregiverLabel(item.source)}</small>
                      </li>
                    );
                  })}
                  {watchChanges.map((change) => (
                    <li key={change.id} className="lcr-current-fact">
                      <strong>{caregiverLabel(change.subject_type)} · {caregiverLabel(change.change_type)}</strong>
                      <p>{change.explanation || "A possible change was saved, but no explanation is available."}</p>
                      <p>Previously recorded: {change.previous_state ?? "Not recorded"} · Currently recorded: {change.current_state ?? "Not recorded"}</p>
                      <p className="lcr-entry-status">Review this comparison if a new report or correction changes the saved information. No medical cutoff is assumed.</p>
                      <p className="lcr-entry-status">
                        Review state: {caregiverLabel(change.confirmation_status || "not recorded")}. 
                        {change.confirmation_status === "rejected"
                          ? " This assessment was disputed and is not presented as an established change."
                          : change.confirmation_status === "inconclusive"
                            ? " The assessment remains inconclusive."
                            : change.confirmation_status === "confirmed"
                              ? " A caregiver confirmed this change assessment; it remains a record, not a diagnosis."
                              : " This candidate has not been confirmed."}
                      </p>
                      <small>Comparison window: {formatWhen(change.comparison_window_start)} – {formatWhen(change.comparison_window_end)}</small>
                      <small>Supporting sources: {change.evidence_ids.length} linked record(s)</small>
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
                      <p>Recorded from {formatWhen(pattern.temporal_start)} to {formatWhen(pattern.temporal_end)} across {pattern.evidence_count} linked event(s).</p>
                      {pattern.direction && <p>Recorded direction: {caregiverLabel(pattern.direction)}</p>}
                      <p className="lcr-entry-status">Reassess this comparison if new source observations or corrections change the recorded interval. This does not show what caused the change or whether it is medically important.</p>
                      {pattern.alternative_interpretations?.length ? (
                        <div>
                          <strong>Other possible explanations</strong>
                          {pattern.alternative_interpretations.map((alternative, index) => <p key={index}>{typeof alternative === "string" ? alternative : JSON.stringify(alternative)}</p>)}
                        </div>
                      ) : <p>Other possible explanations were not provided. No cause is assumed.</p>}
                      <small>Recorded events: {pattern.event_ids.length}</small>
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
              {registeredActionsError && <p role="alert">Registered actions could not be loaded: {registeredActionsError}. Do not assume there are no active actions.</p>}
              {!registeredActionsError && registeredActions.length === 0 && <p>No agreed actions are recorded in this care history.</p>}
              {registeredActions.length > 0 && (
                <ul className="lcr-current-facts">
                  {registeredActions.map((action) => (
                    <li key={action.id} className="lcr-current-fact">
                      <strong>{action.normalized_action}</strong>
                      <p className="lcr-entry-status">Registered action · {action.status.replaceAll("_", " ")} · Version {action.version}</p>
                      <small>Approved: {formatWhen(action.approved_at)} · Responsible caregiver: {action.responsible_caregiver_id === currentCaregiverId ? "You" : "Another caregiver"} · Created by: {action.created_by_caregiver_id === currentCaregiverId ? "You" : "Another caregiver"}</small>
                      <small>Supporting evidence: {(action.source_evidence_ids ?? [action.source_evidence_id]).length} linked record(s)</small>
                      {action.deadline && <small>Recorded due date: {formatWhen(action.deadline)}</small>}
                      {action.linked_reminder_status && <small>Linked reminder: {action.linked_reminder_status} · Due {formatWhen(action.linked_reminder_due_at)}</small>}
                      {action.completed_at && <small>Explicitly marked completed: {formatWhen(action.completed_at)}</small>}
                      {action.deferred_until && <small>Deferred until: {formatWhen(action.deferred_until)}</small>}
                      {action.responsible_caregiver_id !== currentCaregiverId && <p role="status">Only the responsible caregiver can change this action. You can still review its status and audit history.</p>}
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
                      <button type="button" className="lcr-text-action" onClick={() => void loadActionHistory(action)}>View audit history</button>
                      {actionHistoryErrors[action.id] && <p role="alert">{actionHistoryErrors[action.id]}</p>}
                      {actionHistory[action.id] && (
                        <ol>
                          {actionHistory[action.id].map((event) => (
                            <li key={event.id}>
                              {event.previous_status ?? "not registered"} → {event.new_status.replaceAll("_", " ")} · {formatWhen(event.created_at)} · Actor: {event.actor_caregiver_id === currentCaregiverId ? "You" : "Another caregiver"}
                              {event.reason && <p>{event.reason}</p>}
                              <small>Evidence: {event.evidence_ids.length} linked record(s)</small>
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
                  <p className="lcr-entry-status">Saved records show {pattern.rate_per_period.toFixed(2)} events per 30 days. This counts records only; it does not estimate events that were not recorded.</p>
                )}
                {pattern.direction && <p className="lcr-entry-status">Direction: {caregiverLabel(pattern.direction)}</p>}
                {pattern.confidence == null && <p className="lcr-entry-status">There is not enough information to judge how reliable this repeated-change finding is.</p>}
                {pattern.alternative_interpretations?.map((item, index) => (
                  <p className="lcr-entry-status" key={index}>
                    {typeof item === "string" ? item : JSON.stringify(item)}
                  </p>
                ))}
                <small>Recorded events: {pattern.event_ids.length}</small>
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
                <p>{change.explanation || "No explanation was stored with this assessment."}</p>
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
                <small>Supporting sources: {change.evidence_ids.length} linked record(s)</small>
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
                  <div className="lcr-current-facts" aria-label="Supporting source evidence">
                    {changeEvidence[change.id]?.error && (
                      <p role="status">Supporting evidence unavailable: {changeEvidence[change.id]?.error}</p>
                    )}
                    {changeEvidence[change.id]?.evidence.map((item) => (
                      <article key={item.id} className="lcr-current-fact">
                        <strong>{item.title}</strong>
                        <p>{item.description || "No source description was recorded."}</p>
                        <small>{item.event_type === "structured_daily_capture" ? "Daily care update" : item.event_type === "quick_daily_checkin" ? "Daily check-in" : caregiverLabel(item.event_type)} · {item.status === "recorded" ? "Saved" : caregiverLabel(item.status)}</small>
                        <small>Observed: {formatWhen(item.occurred_at)}{item.occurred_at_timezone ? ` (${item.occurred_at_timezone})` : ""}</small>
                        <small>Recorded: {formatWhen(item.recorded_at)}</small>
                        <small>How the time was recorded: {item.time_provenance || "Not recorded"}</small>
                      </article>
                    ))}
                    {changeEvidence[change.id] && !changeEvidence[change.id].error && changeEvidence[change.id].evidence.length === 0 && (
                      <p>No supporting source details are available for the linked information.</p>
                    )}
                    {changeEvidence[change.id]?.assertions.length > 0 && (
                      <div aria-label="Structured source assertions">
                        <strong>Recorded observations</strong>
                        <ul>
                          {changeEvidence[change.id].assertions.map((assertion) => (
                            <li key={assertion.id}>
                              <p>{caregiverLabel(assertion.field)}: {assertion.asserted_value}</p>
                              <small>{caregiverLabel(assertion.subject_type)} · {caregiverLabel(assertion.assertion_status)} · {assertion.source_label}</small>
                              <small>Observed: {formatWhen(assertion.observed_at)} · Recorded: {formatWhen(assertion.recorded_at)}</small>
                              {assertion.source_text && <p>{assertion.source_text}</p>}
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
                              {transition.evidence_ids.length > 0 && <small>Information used for this review: {transition.evidence_ids.length} linked record(s)</small>}
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
        <p role="status">Loading persisted care information…</p>
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
                    <p className="lcr-entry-status">{item.kind} · {item.status === "recorded" ? "Saved" : (item.status || "Status not recorded").replaceAll("_", " ")}</p>
                    <small>Source: {item.source_label || "Not recorded"} · {item.occurred_at ? `Event: ${formatWhen(item.occurred_at)} · ` : ""}{item.reported_at ? `Caregiver reported: ${formatWhen(item.reported_at)} · ` : ""}Recorded: {formatWhen(item.recorded_at || item.occurred_at)}</small>
                    {item.evidence_ids?.length > 0 && <small>Original caregiver report linked to this entry</small>}
                    {item.evidence_link_validation && <small>{item.evidence_link_validation === "valid" ? "Source record linked" : "Source record status: " + item.evidence_link_validation.replaceAll("_", " ")}</small>}
                    {item.derived_observations && item.derived_observations.length > 0 && (
                      <details className="lcr-entry-status">
                        <summary>What was taken from this note ({item.derived_observations.length})</summary>
                        <p>These are structured readings of the same source report, not independent corroborating reports.</p>
                        <ul>
                          {item.derived_observations.map((observation) => (
                            <li key={observation.id}>
                              <strong>{observation.attribute?.replaceAll("_", " ") || observation.observation_kind || "Recorded observation"}</strong>
                              {observation.subject_label && <small>Subject: {observation.subject_label}</small>}
                              {observation.observer_label && <small>Reported by: {observation.observer_label}</small>}
                              {observation.observation_method && <small>Observation method: {observation.observation_method}</small>}
                              {observation.context != null && <p>Context: {typeof observation.context === "string" ? observation.context : JSON.stringify(observation.context)}</p>}
                              {observation.value_text && <p>{observation.value_text}</p>}
                              <small>Observed: {formatWhen(observation.observed_at)} · Recorded: {formatWhen(observation.recorded_at)}</small>
                              {observation.source_passage && (
                                <details>
                                  <summary>Read the original note</summary>
                                  <blockquote>{observation.source_passage}</blockquote>
                                </details>
                              )}
                              {observation.negated != null && <small>Negated in source: {observation.negated ? "Yes" : "No"}</small>}
                              {observation.hedge_marker && <small>Uncertainty wording: {observation.hedge_marker}</small>}
                              {observation.ambiguity_note && <small>Ambiguity: {observation.ambiguity_note}</small>}
                              {observation.correction_rationale && <small>Correction rationale: {observation.correction_rationale}</small>}
                              <small>The exact source passage is retained.</small>
                              <small>Extraction method: {(observation.extraction_method || "not recorded").replaceAll("_", " ")} · Version: {observation.extraction_version || "not recorded"}</small>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                    {item.source_collection === "evidence_observations" && (
                      <div className="lcr-entry-status">
                        <small>
                          Exact source wording is retained ·
                          {" "}Extraction: {item.extraction_method || "not recorded"} ·
                          {" "}Negated: {item.negated == null ? "not specified" : item.negated ? "yes" : "no"}
                        </small>
                        {item.source_passage && (
                          <details>
                            <summary>Read the original note</summary>
                            <blockquote>{item.source_passage}</blockquote>
                          </details>
                        )}
                        {item.supersedes_observation_id && <small>This entry corrects an earlier observation.</small>}
                        {item.correction_rationale && <small>Correction rationale: {item.correction_rationale}</small>}
                        {item.hedge_marker && <small>Hedge / uncertainty marker: {item.hedge_marker}</small>}
                        {item.ambiguity_note && <small>Ambiguity: {item.ambiguity_note}</small>}
                      </div>
                    )}
                    {item.evidence_ids?.length > 0 && <small>Source review status: {(item.evidence_assessment_coverage || "not returned").replaceAll("_", " ")}</small>}
                    {item.evidence_assessments?.map((review) => (
                      <div key={review.evidence_id + ":" + review.review_type} className="lcr-entry-status">
                        <small>{review.review_type.replaceAll("_", " ")}: {review.outcome.replaceAll("_", " ")} · policy {review.policy_version} · reviewed {formatWhen(review.reviewed_at)}</small>
                        <small>{review.rationale}</small>
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
                            <small>Linked evidence records: {evidenceIntegrityByFact[item.id].linked_evidence_count} · Corroboration: {evidenceIntegrityByFact[item.id].independent_corroboration_status.replaceAll("_", " ")}</small>
                            {evidenceIntegrityByFact[item.id].duplicate_content_candidates.map(group => (
                              <p key={group.fingerprint}><small>Possible exact duplicate across {group.evidence_ids.length} source record(s). {group.interpretation}</small></p>
                            ))}
                            {evidenceIntegrityByFact[item.id].near_duplicate_analysis && (
                              <div>
                                <small>Near-duplicate review ({evidenceIntegrityByFact[item.id].near_duplicate_analysis?.status?.replaceAll("_", " ") ?? "status unavailable"}; {evidenceIntegrityByFact[item.id].near_duplicate_analysis?.records_considered ?? 0}/{evidenceIntegrityByFact[item.id].near_duplicate_analysis?.records_available ?? 0} records considered; {evidenceIntegrityByFact[item.id].near_duplicate_analysis?.algorithm_version ?? "algorithm version unavailable"}).</small>
                                {evidenceIntegrityByFact[item.id].near_duplicate_analysis?.candidate_groups?.map(group => (
                                  <p key={group.evidence_ids.join(":")}><small>Possible near-duplicate across {group.evidence_ids.length} source record(s). {group.interpretation}</small></p>
                                ))}
                                <small>{evidenceIntegrityByFact[item.id].near_duplicate_analysis?.interpretation_limit ?? "Near-duplicate interpretation limits were not returned by the server."}</small>
                              </div>
                            )}
                            <small>{evidenceIntegrityByFact[item.id].interpretation_limit}</small>
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
          <p className="lcr-footer-note">{projection.notice}</p>
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
