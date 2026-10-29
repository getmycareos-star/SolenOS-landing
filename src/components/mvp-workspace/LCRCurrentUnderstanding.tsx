"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { ensureAnonymousSession, getJSON, postJSON } from "@/api/client";

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
  recorded_at?: string | null;
  evidence_ids: string[];
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
  capabilities: Record<string, { source_names: string[]; record_count: number; evidence_state: string; unavailable_sources: string[] }>;
  priorities: Array<{ id: string; source: string; title: string; status: string; epistemic_status: string; evidence_ids: string[] }>;
  uncertainties_and_conflicts: Array<{ id: string; source: string; title: string; status: string; epistemic_status: string; evidence_ids: string[] }>;
  missing_information: Array<{ id: string; source: string; title: string; status: string; epistemic_status: string; evidence_ids: string[] }>;
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

type SituationAssessmentResponse = {
  status: "available" | "not_assessed" | "created" | "unchanged";
  assessment_id?: string;
  assessment: SituationAssessment | null;
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
  independent_corroboration_status: string;
  interpretation_limit: string;
};

function displayDescription(value?: string | null): string {
  if (!value?.trim()) return "No description was recorded.";
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const entries = Object.entries(parsed as Record<string, unknown>)
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

export function LCRCurrentUnderstanding() {
  const [projection, setProjection] = useState<CurrentCareProjection | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assessment, setAssessment] = useState<SituationAssessment | null>(null);
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
    if (manual) setRefreshing(true);
    else setLoading(true);
    setError(null);
    setChanges([]);
    setChangesError(null);
    setPatterns([]);
    setPatternsError(null);
    try {
      const session = await ensureAnonymousSession();
      if (!session.access_token || !session.person?.id) {
        throw new Error("A valid care-record session is required to read the longitudinal record.");
      }
      const result = await getJSON("/care-continuity/current-care?limit_per_source=12");
      if (!result || result.read_only !== true || !Array.isArray(result.items) ||
          typeof result.schema_status !== "string" || typeof result.projection_type !== "string" ||
          result.person_id !== session.person.id) {
        throw new Error("The current-care response did not match this session's record contract. No care state has been assumed.");
      }
      setProjection(result as CurrentCareProjection);
      try {
        const changePath = `/change/changes/${encodeURIComponent(session.person.id)}`;
        const validateChanges = (value: unknown): PersistedChange[] => {
          if (!Array.isArray(value) || value.some((item) => item?.person_id !== session.person.id)) {
            throw new Error("The persisted change history did not match the active care-record session.");
          }
          return value as PersistedChange[];
        };

        // Load the durable history first so a failed reassessment never hides saved results.
        setChanges(validateChanges(await getJSON(changePath)));
        try {
          await postJSON(`/change/changes/reassess?person_id=${encodeURIComponent(session.person.id)}`, {});
          setChanges(validateChanges(await getJSON(changePath)));
          setChangesError(null);
        } catch (reassessmentCause) {
          setChangesError(
            reassessmentCause instanceof Error
              ? `Reassessment failed; previously saved change assessments remain visible. ${reassessmentCause.message}`
              : "Reassessment failed; previously saved change assessments remain visible."
          );
        }
      } catch (changeCause) {
        setChanges([]);
        setChangesError(changeCause instanceof Error ? changeCause.message : "Persisted change history is unavailable.");
      }
      try {
        const patternPath = `/change/patterns/${encodeURIComponent(session.person.id)}`;
        const persistedPatterns = await getJSON(patternPath);
        if (!Array.isArray(persistedPatterns) || persistedPatterns.some(
          (item) => item?.person_id !== session.person.id
        )) {
          throw new Error("The persisted pattern history did not match the active care-record session.");
        }
        setPatterns(persistedPatterns as PersistedPattern[]);
      } catch (patternCause) {
        setPatterns([]);
        setPatternsError(patternCause instanceof Error
          ? patternCause.message
          : "Persisted pattern history is unavailable.");
      }
      try {
        const saved = await getJSON("/care-continuity/situation-understanding") as SituationAssessmentResponse;
        if (saved.status === "available" && saved.assessment?.person_id === session.person.id) {
          setAssessment(saved.assessment);
        } else {
          setAssessment(null);
        }
        setAssessmentError(null);
      } catch (assessmentCause) {
        setAssessment(null);
        setAssessmentError(assessmentCause instanceof Error ? assessmentCause.message : "Situation assessment is unavailable.");
      }
    } catch (cause) {
      setProjection(null);
      setError(cause instanceof Error ? cause.message : "The longitudinal care record could not be loaded.");
    } finally {
      setLoading(false);
      setRefreshing(false);
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
        throw new Error("The returned evidence did not match the saved change assessment.");
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
        throw new Error("The assessment did not match the active care-record session.");
      }
      setAssessment(result.assessment);
    } catch (cause) {
      setAssessmentError(cause instanceof Error ? cause.message : "Situation reassessment failed.");
    } finally {
      setAssessmentLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="lcr-record-section" aria-labelledby="lcr-current-understanding-heading">
      <div className="lcr-section-heading">
        <div>
          <p className="lcr-eyebrow">LONGITUDINAL RECORD</p>
          <h2 id="lcr-current-understanding-heading">Current care understanding</h2>
          <p>What is recorded, what needs attention, and what remains uncertain—kept distinct from the chronological timeline.</p>
        </div>
        <button type="button" className="lcr-text-action" onClick={() => void load(true)} disabled={loading || refreshing} aria-label="Refresh current care understanding">
          <RefreshCw size={16} aria-hidden="true" /> Refresh
        </button>
      </div>

      <div className="lcr-situation-assessment" aria-labelledby="lcr-pattern-history-heading">
        <div className="lcr-entry-heading">
          <h3 id="lcr-pattern-history-heading">Longitudinal patterns</h3>
          <span>{patterns.filter((pattern) => pattern.is_active && !pattern.superseded_by_pattern_id).length} active patterns in loaded history</span>
        </div>
        {patternsError && <p role="status">Persisted pattern history could not be loaded: {patternsError}</p>}
        {!patternsError && patterns.length === 0 && (
          <p>No persisted longitudinal patterns are available. A pattern is not inferred from missing history.</p>
        )}
        {patterns.length > 0 && (
          <ul className="lcr-current-facts">
            {patterns.map((pattern) => (
              <li key={pattern.id} className="lcr-current-fact">
                <div className="lcr-entry-heading">
                  <strong>{pattern.subject_type.replaceAll("_", " ")} · {pattern.pattern_type.replaceAll("_", " ")}</strong>
                  <span>{pattern.is_active && !pattern.superseded_by_pattern_id ? "active" : "superseded"} · {pattern.pattern_strength.replaceAll("_", " ")}</span>
                </div>
                <p>
                  Recorded across {pattern.evidence_count} linked event(s), from {formatWhen(pattern.temporal_start)} to {formatWhen(pattern.temporal_end)}.
                </p>
                {pattern.rate_per_period != null && (
                  <p className="lcr-entry-status">Recorded rate: {pattern.rate_per_period.toFixed(2)} per 30-day period. This is a record rate, not an estimate of unobserved events.</p>
                )}
                {pattern.direction && <p className="lcr-entry-status">Direction: {pattern.direction.replaceAll("_", " ")}</p>}
                {pattern.confidence == null && <p className="lcr-entry-status">Confidence is not calibrated; no numeric confidence is asserted.</p>}
                {pattern.alternative_interpretations?.map((item, index) => (
                  <p className="lcr-entry-status" key={index}>
                    {typeof item === "string" ? item : JSON.stringify(item)}
                  </p>
                ))}
                <small>Source event references: {pattern.event_ids.length ? pattern.event_ids.join(", ") : "None linked"}</small>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="lcr-situation-assessment" aria-labelledby="lcr-change-history-heading">
        <div className="lcr-entry-heading">
          <h3 id="lcr-change-history-heading">Recorded changes</h3>
          <span>{changes.length} persisted assessments</span>
        </div>
        {changesError && <p role="status">Saved change history could not be loaded: {changesError}</p>}
        {!changesError && changes.length === 0 && (
          <p>No persisted change assessments are available for this record. No change has been inferred from missing assessments.</p>
        )}
        {changes.length > 0 && (
          <ul className="lcr-current-facts">
            {changes.map((change) => (
              <li key={change.id} className="lcr-current-fact">
                <div className="lcr-entry-heading">
                  <strong>{change.subject_type.replaceAll("_", " ")} · {change.change_type.replaceAll("_", " ")}</strong>
                  <span>{change.significance_verdict?.replaceAll("_", " ") ?? "Significance not assessed"}</span>
                </div>
                <p>{change.explanation || "No explanation was stored with this assessment."}</p>
                <p className="lcr-entry-status">
                  Previous: {change.previous_state ?? "Not recorded"} · Current: {change.current_state ?? "Not recorded"}
                </p>
                <p className="lcr-entry-status">
                  Confirmation: {(change.is_active === false || change.superseded_by_change_id ? "superseded" : change.confirmation_status || "detected").replaceAll("_", " ")}
                </p>
                <label className="lcr-evidence-reason">
                  Review note
                  <textarea
                    value={confirmationReason[change.id] || ""}
                    onChange={(event) => setConfirmationReason((previous) => ({ ...previous, [change.id]: event.target.value }))}
                    rows={2}
                    maxLength={2000}
                  />
                  <small>Record context or explain why this assessment is incorrect or uncertain.</small>
                </label>
                {confirmationError[change.id] && <p role="alert">{confirmationError[change.id]}</p>}
                {change.is_active !== false && !change.superseded_by_change_id ? (
                  <div className="lcr-entry-actions">
                    {(["detected", "awaiting_confirmation"].includes(change.confirmation_status || "detected")) ? (
                      <>
                        <button type="button" className="lcr-text-action" disabled={confirmationLoadingId === change.id} onClick={() => void transitionConfirmation(change, "confirmed")}>Confirm</button>
                        <button type="button" className="lcr-text-action" disabled={confirmationLoadingId === change.id} onClick={() => void transitionConfirmation(change, "inconclusive")}>Mark inconclusive</button>
                        <button type="button" className="lcr-text-action" disabled={confirmationLoadingId === change.id} onClick={() => void transitionConfirmation(change, "rejected")}>Reject assessment</button>
                        {change.confirmation_status !== "awaiting_confirmation" && (
                          <button type="button" className="lcr-text-action" disabled={confirmationLoadingId === change.id} onClick={() => void transitionConfirmation(change, "awaiting_confirmation")}>Request confirmation</button>
                        )}
                      </>
                    ) : (
                      <button type="button" className="lcr-text-action" disabled={confirmationLoadingId === change.id} onClick={() => void transitionConfirmation(change, "awaiting_confirmation")}>Reopen review</button>
                    )}
                  </div>
                ) : (
                  <small>This assessment has been superseded. It remains in the record for audit history.</small>
                )}
                <small>Compared: {formatWhen(change.comparison_window_start)} – {formatWhen(change.comparison_window_end)}</small>
                <small>Evidence references: {change.evidence_ids.length > 0 ? change.evidence_ids.join(", ") : "None linked"}</small>
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
                        <small>{item.event_type.replaceAll("_", " ")} · {item.status}</small>
                        <small>Observed: {formatWhen(item.occurred_at)}{item.occurred_at_timezone ? ` (${item.occurred_at_timezone})` : ""}</small>
                        <small>Recorded: {formatWhen(item.recorded_at)}</small>
                        <small>Time provenance: {item.time_provenance || "Not recorded"}</small>
                      </article>
                    ))}
                    {changeEvidence[change.id] && !changeEvidence[change.id].error && changeEvidence[change.id].evidence.length === 0 && (
                      <p>No source observations were returned for the linked evidence references.</p>
                    )}
                    {changeEvidence[change.id]?.assertions.length > 0 && (
                      <div aria-label="Structured source assertions">
                        <strong>Structured observations</strong>
                        <ul>
                          {changeEvidence[change.id].assertions.map((assertion) => (
                            <li key={assertion.id}>
                              <p>{assertion.field.replaceAll("_", " ")}: {assertion.asserted_value}</p>
                              <small>{assertion.subject_type.replaceAll("_", " ")} · {assertion.assertion_status} · {assertion.source_label}</small>
                              <small>Observed: {formatWhen(assertion.observed_at)} · Recorded: {formatWhen(assertion.recorded_at)}</small>
                              {assertion.source_text && <p>{assertion.source_text}</p>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {changeEvidence[change.id]?.confirmation_history.length > 0 && (
                      <div aria-label="Confirmation history">
                        <strong>Review history</strong>
                        <ul>
                          {changeEvidence[change.id].confirmation_history.map((transition) => (
                            <li key={transition.id}>
                              <p>{transition.previous_status.replaceAll("_", " ")} → {transition.new_status.replaceAll("_", " ")}</p>
                              {transition.reason && <p>{transition.reason}</p>}
                              <small>Recorded {formatWhen(transition.created_at)} · caregiver {transition.actor_caregiver_id}</small>
                              {transition.evidence_ids.length > 0 && <small>Review evidence: {transition.evidence_ids.join(", ")}</small>}
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

      <div className="lcr-situation-assessment" aria-labelledby="lcr-situation-assessment-heading">
        <div className="lcr-entry-heading">
          <h3 id="lcr-situation-assessment-heading">Situation understanding</h3>
          <button type="button" className="lcr-text-action" onClick={() => void reassess()} disabled={assessmentLoading || loading}>
            {assessmentLoading ? "Assessing persisted record…" : "Reassess from record"}
          </button>
        </div>
        {assessmentError && <p role="status">Assessment status: {assessmentError}</p>}
        {!assessment && !assessmentLoading && (
          <p>No persisted situation assessment is available yet. Reassess to compose one from the current authorized record. No care conclusion is assumed.</p>
        )}
        {assessment && (
          <>
            <p>{assessment.coverage.records_examined} persisted records examined across {assessment.coverage.sources_examined} sources; {assessment.coverage.distinct_linked_evidence_ids} distinct linked evidence references.</p>
            <p>Coverage: {assessment.coverage.is_complete ? "complete for the examined schema and bounds" : "partial or bounded"} · Confidence: {assessment.confidence_assessment.overall.replaceAll("_", " ")}.</p>
            <details>
              <summary>Capability evidence coverage ({Object.keys(assessment.capabilities || {}).length})</summary>
              <ul>{Object.entries(assessment.capabilities || {}).map(([name, capability]) => (
                <li key={name}>
                  <strong>{name.replaceAll("_", " ")}</strong>: {capability.evidence_state.replaceAll("_", " ")} ({capability.record_count} source records)
                  {capability.unavailable_sources.length > 0 && <span> · Unavailable sources: {capability.unavailable_sources.join(", ")}</span>}
                </li>
              ))}</ul>
            </details>
            {assessment.evolution_since_previous_assessment && (
              <div>
                <strong>Changes since previous assessment</strong>
                {assessment.evolution_since_previous_assessment.comparison_available ? (
                  <>
                    <p>{assessment.evolution_since_previous_assessment.change_count} persisted-record projection change(s) identified.</p>
                    {assessment.evolution_since_previous_assessment.changes.length > 0 && (
                      <ul>{assessment.evolution_since_previous_assessment.changes.slice(0, 10).map((change) => (
                        <li key={change.source + ":" + change.record_id}>
                          {change.change_type.replaceAll("_", " ")} · {change.source} · {change.record_id}
                        </li>
                      ))}</ul>
                    )}
                    <small>{assessment.evolution_since_previous_assessment.interpretation_limit}</small>
                  </>
                ) : <p>No prior persisted assessment exists to establish a comparison baseline.</p>}
              </div>
            )}
            {assessment.priorities.length > 0 && (
              <div>
                <strong>Recorded items needing attention or follow-through</strong>
                <ul>{assessment.priorities.slice(0, 5).map((item) => <li key={item.source + ":" + item.id}>{item.title} — {item.status}; {item.epistemic_status}</li>)}</ul>
              </div>
            )}
            {assessment.uncertainties_and_conflicts.length > 0 && (
              <div>
                <strong>Unresolved uncertainties or conflicts</strong>
                <ul>{assessment.uncertainties_and_conflicts.slice(0, 5).map((item) => <li key={item.source + ":" + item.id}>{item.title} — {item.status}</li>)}</ul>
              </div>
            )}
            {assessment.missing_information.length > 0 && (
              <div>
                <strong>Recorded information gaps</strong>
                <ul>{assessment.missing_information.slice(0, 5).map((item) => <li key={item.source + ":" + item.id}>{item.title} — {item.status}</li>)}</ul>
              </div>
            )}
            {assessment.confidence_assessment.limitations.map((limitation) => <small key={limitation}>{limitation}</small>)}
            <p className="lcr-footer-note">{assessment.notice}</p>
          </>
        )}
      </div>

      {loading ? (
        <p role="status">Loading persisted care information…</p>
      ) : error ? (
        <div role="alert" className="lcr-empty-state">
          <AlertCircle size={20} aria-hidden="true" />
          <h3>Current care understanding is unavailable</h3>
          <p>{error}</p>
          <p>The timeline is not being used as a substitute for this view.</p>
          <button type="button" className="lcr-text-action" onClick={() => void load(true)}>Try again</button>
        </div>
      ) : projection ? (
        <>
          {(projection.schema_status !== "complete" || projection.missing_required_sources.length > 0) && (
            <div role="status" className="lcr-empty-state">
              <AlertCircle size={20} aria-hidden="true" />
              <h3>Record coverage is incomplete</h3>
              <p>Some data sources are unavailable or incomplete. This view may not cover the full care record.</p>
              {projection.missing_required_sources.length > 0 && (
                <p>Unavailable required sources: {projection.missing_required_sources.join(", ")}</p>
              )}
              {projection.missing_optional_sources.length > 0 && (
                <p>Unavailable optional sources: {projection.missing_optional_sources.join(", ")}</p>
              )}
            </div>
          )}

          {projection.items.length === 0 ? (
            <div className="lcr-empty-state">
              <h3>No current-care items were returned</h3>
              <p>This is not evidence that no care needs, questions, or risks exist. Add or review information through the record workflows.</p>
            </div>
          ) : (
            <div className="lcr-current-facts">
              <ul>
                {projection.items.map((item) => (
                  <li key={item.source_collection + ":" + item.id} className="lcr-current-fact">
                    <div className="lcr-entry-heading">
                      <strong>{item.title || item.kind || "Care record item"}</strong>
                      <span>{item.epistemic_status || "Status not recorded"}</span>
                    </div>
                    <p>{displayDescription(item.description)}</p>
                    <p className="lcr-entry-status">{item.kind} · {item.status || "Status not recorded"}</p>
                    <small>Source: {item.source_label || "Not recorded"} · Recorded: {formatWhen(item.recorded_at || item.occurred_at)}</small>
                    {item.evidence_ids?.length > 0 && <small>Linked evidence: {item.evidence_ids.join(", ")}</small>}
                    {item.evidence_ids?.length > 0 && <small>Evidence review coverage: {(item.evidence_assessment_coverage || "not returned").replaceAll("_", " ")}</small>}
                    {item.evidence_assessments?.map((review) => (
                      <div key={review.evidence_id + ":" + review.review_type} className="lcr-entry-status">
                        <small>{review.review_type.replaceAll("_", " ")}: {review.outcome.replaceAll("_", " ")} · policy {review.policy_version} · reviewed {formatWhen(review.reviewed_at)}</small>
                        <small>{review.rationale}</small>
                      </div>
                    ))}
                    {item.claim_count > 0 && <small>Competing claims linked: {item.claim_count}</small>}
                    {item.source_collection === "facts" && (
                      <div className="lcr-evidence-integrity">
                        <button type="button" onClick={() => void loadEvidenceIntegrity(item.id)} disabled={evidenceIntegrityLoadingId === item.id}>
                          {evidenceIntegrityLoadingId === item.id ? "Checking linked evidence…" : "Inspect linked evidence"}
                        </button>
                        {evidenceIntegrityErrors[item.id] && <p role="alert">{evidenceIntegrityErrors[item.id]}</p>}
                        {evidenceIntegrityByFact[item.id] && (
                          <div>
                            <small>Linked evidence records: {evidenceIntegrityByFact[item.id].linked_evidence_count} · Corroboration: {evidenceIntegrityByFact[item.id].independent_corroboration_status.replaceAll("_", " ")}</small>
                            {evidenceIntegrityByFact[item.id].duplicate_content_candidates.map(group => (
                              <p key={group.fingerprint}><small>Duplicate-content candidate: {group.evidence_ids.join(", ")}. {group.interpretation}</small></p>
                            ))}
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
          <p className="lcr-footer-note">View as of {formatWhen(projection.as_of)} · Coverage: {projection.history_coverage.replaceAll("_", " ")}.</p>
          <p className="lcr-footer-note">{projection.notice}</p>
        </>
      ) : null}
    </section>
  );
}
