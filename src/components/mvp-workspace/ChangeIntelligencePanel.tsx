"use client";

import { useEffect, useRef, useState } from "react";
import { caregiverInformationLabel, caregiverSafeAssistantText, caregiverSafeChangeText, caregiverSafeErrorMessage, caregiverSafeGeneratedText, caregiverStatusLabel, caregiverSituationStateLabel } from "@/lib/caregiver-language";
import {
  getPersistedChangeDetail,
  getPersistedPatternDetail,
  listPersistedChanges,
  listPersistedPatterns,
  listPersistedSituations,
  getPersistedSituationDetail,
  reassessPersistedChangeIntelligence,
  type ChangeDetail,
  type PersistedChange,
  type PersistedPattern,
  type PersistedSituation,
  type SituationDetail,
  type PatternDetail,
  type SituationTrajectoryState,
  transitionChangeConfirmation,
  transitionSituationState,
} from "@/api/change-intelligence";

function caregiverChangeLabel(change: PersistedChange): string {
  // A first appearance in an incomplete history is not proof of a new onset.
  if (change.change_type === "emergence" && change.baseline_coverage_status !== "covered") {
    return "First observed";
  }
  if (
    ["cessation", "disappearance"].includes(change.change_type) &&
    change.baseline_coverage_status === "covered" &&
    change.current_coverage_status === "covered"
  ) {
    return caregiverStatusLabel(change.change_type) ?? "No longer reported";
  }
  if (change.significance_verdict === "insufficient_evidence" &&
    !["cessation", "disappearance"].includes(change.change_type)) {
    return "Needs more information";
  }
  // Frequency changes require comparable observation coverage. Without it,
  // show the uncertainty instead of presenting a directional change as settled.
  if (
    ["increase", "decrease", "cessation", "disappearance", "recurrence", "stabilization"].includes(change.change_type) &&
    (change.baseline_coverage_status !== "covered" || change.current_coverage_status !== "covered")
  ) {
    return "Needs more information";
  }
  return caregiverStatusLabel(change.change_type) ?? "Care change";
}

function formatWindow(start: string | null, end: string | null): string {
  if (!start || !end) return "Comparison window not recorded";
  const left = new Date(start);
  const right = new Date(end);
  if (Number.isNaN(left.getTime()) || Number.isNaN(right.getTime())) return "Comparison window unavailable";
  return `${left.toLocaleDateString()} – ${right.toLocaleDateString()}`;
}

/** Shows persisted backend assessments only; it never infers a care pattern from UI text. */
export function ChangeIntelligencePanel({ personId }: { personId: string }) {
  const personIdRef = useRef(personId);
  personIdRef.current = personId;
  const [changes, setChanges] = useState<PersistedChange[]>([]);
  const [patterns, setPatterns] = useState<PersistedPattern[]>([]);
  const [situations, setSituations] = useState<PersistedSituation[]>([]);
  const [situationStates, setSituationStates] = useState<Record<string, SituationTrajectoryState>>({});
  const [situationReasons, setSituationReasons] = useState<Record<string, string>>({});
  const [situationTransitioningIds, setSituationTransitioningIds] = useState<string[]>([]);
  const [situationDetails, setSituationDetails] = useState<Record<string, SituationDetail>>({});
  const [situationDetailLoadingIds, setSituationDetailLoadingIds] = useState<string[]>([]);
  const [expandedSituationIds, setExpandedSituationIds] = useState<string[]>([]);
  const [expandedPatternId, setExpandedPatternId] = useState<string | null>(null);
  const [patternDetails, setPatternDetails] = useState<Record<string, PatternDetail>>({});
  const [patternDetailErrors, setPatternDetailErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [expandedChangeId, setExpandedChangeId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, ChangeDetail>>({});
  const [detailErrors, setDetailErrors] = useState<Record<string, string>>({});
  const [confirmationReasons, setConfirmationReasons] = useState<Record<string, string>>({});
  const [transitioningIds, setTransitioningIds] = useState<string[]>([]);
  const [changeOffset, setChangeOffset] = useState(0);
  const [patternOffset, setPatternOffset] = useState(0);
  const [hasMoreChanges, setHasMoreChanges] = useState(false);
  const [hasMorePatterns, setHasMorePatterns] = useState(false);
  const [loadingMoreChanges, setLoadingMoreChanges] = useState(false);
  const [loadingMorePatterns, setLoadingMorePatterns] = useState(false);
  async function changeStatus(changeId: string, status: "awaiting_confirmation" | "confirmed" | "rejected" | "inconclusive" | "resolved") {
    const reason = confirmationReasons[changeId]?.trim() ?? "";
    if (status !== "awaiting_confirmation" && !reason) {
      setDetailErrors((current) => ({ ...current, [changeId]: "Please tell us why you are confirming or correcting this change before you continue." }));
      return;
    }
    setTransitioningIds((current) => [...current, changeId]);
    setDetailErrors((current) => { const next = { ...current }; delete next[changeId]; return next; });
    try {
      const detail = details[changeId];
      const supportingIds = [
        ...(detail?.evidence.map((item) => item.id) ?? []),
        ...(detail?.assertions.map((item) => item.id) ?? []),
        ...(detail?.observations.map((item) => item.id) ?? []),
      ];
      await transitionChangeConfirmation(changeId, status, reason, [...new Set(supportingIds)], personId);
      if (personIdRef.current !== personId) return;
      const [changeRows, patternRows, situationRows] = await Promise.all([
        listPersistedChanges(undefined, 100, 0, personId), listPersistedPatterns(undefined, 100, 0, personId), listPersistedSituations(personId),
      ]);
      if (personIdRef.current !== personId) return;
      setChanges(changeRows);
      setPatterns(patternRows);
      setSituations(situationRows);
      setSituationStates({});
      setSituationReasons({});
      setChangeOffset(0);
      setPatternOffset(0);
      setHasMoreChanges(changeRows.length === 100);
      setHasMorePatterns(patternRows.length === 100);
      const refreshedDetail = await getPersistedChangeDetail(changeId, personId);
      if (personIdRef.current !== personId) return;
      setDetails((current) => ({ ...current, [changeId]: refreshedDetail }));
      setConfirmationReasons((current) => ({ ...current, [changeId]: "" }));
    } catch (reason: unknown) {
      if (personIdRef.current === personId) setDetailErrors((current) => ({ ...current, [changeId]: caregiverSafeErrorMessage() }));
    } finally {
      if (personIdRef.current === personId) setTransitioningIds((current) => current.filter((id) => id !== changeId));
    }
  }

  async function togglePatternEvidence(patternId: string) {
    if (expandedPatternId === patternId) {
      setExpandedPatternId(null);
      return;
    }
    setExpandedPatternId(patternId);
    if (patternDetails[patternId] || patternDetailErrors[patternId]) return;
    try {
      const detail = await getPersistedPatternDetail(patternId, personId);
      if (personIdRef.current !== personId) return;
      setPatternDetails((current) => ({ ...current, [patternId]: detail }));
    } catch (reason: unknown) {
      if (personIdRef.current !== personId) return;
      setPatternDetailErrors((current) => ({
        ...current,
        [patternId]: caregiverSafeErrorMessage(),
      }));
    }
  }

  async function toggleEvidence(changeId: string) {
    if (expandedChangeId === changeId) {
      setExpandedChangeId(null);
      return;
    }
    setExpandedChangeId(changeId);
    if (details[changeId] || detailErrors[changeId]) return;
    try {
      const detail = await getPersistedChangeDetail(changeId, personId);
      if (personIdRef.current !== personId) return;
      setDetails((current) => ({ ...current, [changeId]: detail }));
    } catch (reason: unknown) {
      if (personIdRef.current !== personId) return;
      setDetailErrors((current) => ({
        ...current,
        [changeId]: caregiverSafeErrorMessage(),
      }));
    }
  }

  async function loadMoreChanges() {
    if (loadingMoreChanges || !hasMoreChanges) return;
    setLoadingMoreChanges(true);
    try {
      const nextOffset = changeOffset + 100;
      const rows = await listPersistedChanges(undefined, 100, nextOffset, personId);
      if (personIdRef.current !== personId) return;
      setChanges((current) => {
        const known = new Set(current.map((item) => item.id));
        return [...current, ...rows.filter((item) => !known.has(item.id))];
      });
      setChangeOffset(nextOffset);
      setHasMoreChanges(rows.length === 100);
    } catch {
      if (personIdRef.current === personId) setWarning("Earlier care changes could not be loaded. Your Care Record has not been changed.");
    } finally {
      if (personIdRef.current === personId) setLoadingMoreChanges(false);
    }
  }

  async function loadMorePatterns() {
    if (loadingMorePatterns || !hasMorePatterns) return;
    setLoadingMorePatterns(true);
    try {
      const nextOffset = patternOffset + 100;
      const rows = await listPersistedPatterns(undefined, 100, nextOffset, personId);
      if (personIdRef.current !== personId) return;
      setPatterns((current) => {
        const known = new Set(current.map((item) => item.id));
        return [...current, ...rows.filter((item) => !known.has(item.id))];
      });
      setPatternOffset(nextOffset);
      setHasMorePatterns(rows.length === 100);
    } catch {
      if (personIdRef.current === personId) setWarning("Earlier care patterns could not be loaded. The saved care record has not been changed.");
    } finally {
      if (personIdRef.current === personId) setLoadingMorePatterns(false);
    }
  }

  async function refreshSavedAssessments() {
    if (refreshing) return;
    setRefreshing(true);
    setWarning(null);
    try {
      await reassessPersistedChangeIntelligence(personId);
      if (personIdRef.current !== personId) return;
      const [changeRows, patternRows, situationRows] = await Promise.all([
        listPersistedChanges(undefined, 100, 0, personId), listPersistedPatterns(undefined, 100, 0, personId), listPersistedSituations(personId),
      ]);
      if (personIdRef.current !== personId) return;
      setChanges(changeRows);
      setPatterns(patternRows);
      setSituations(situationRows);
      setChangeOffset(0);
      setPatternOffset(0);
      setHasMoreChanges(changeRows.length === 100);
      setHasMorePatterns(patternRows.length === 100);
      setDetails({});
      setDetailErrors({});
      setPatternDetails({});
      setPatternDetailErrors({});
      setExpandedChangeId(null);
      setExpandedPatternId(null);
    } catch {
      if (personIdRef.current === personId) setWarning("SolenOS could not check for new changes. The last saved information is still shown.");
    } finally {
      if (personIdRef.current === personId) setRefreshing(false);
    }
  }

  function situationEvidenceIds(situation: PersistedSituation): string[] {
    const linkedChangeIds = new Set(situation.change_ids ?? []);
    const linkedPatterns = patterns.filter((pattern) => (situation.pattern_ids ?? []).includes(pattern.id));
    for (const pattern of linkedPatterns) {
      for (const changeId of pattern.change_ids ?? []) linkedChangeIds.add(changeId);
    }
    const linkedChanges = changes.filter((change) => linkedChangeIds.has(change.id));
    return [...new Set([
      ...(situation.signal_ids ?? []),
      ...linkedPatterns.flatMap((pattern) => pattern.event_ids ?? []),
      ...linkedChanges.flatMap((change) => change.evidence_ids ?? []),
    ].filter(Boolean))];
  }

  async function toggleSituationDetail(situationId: string) {
    if (expandedSituationIds.includes(situationId)) {
      setExpandedSituationIds((current) => current.filter((id) => id !== situationId));
      return;
    }
    setExpandedSituationIds((current) => [...current, situationId]);
    if (situationDetails[situationId]) return;
    setSituationDetailLoadingIds((current) => [...current, situationId]);
    try {
      const detail = await getPersistedSituationDetail(situationId, personId);
      if (personIdRef.current !== personId) return;
      setSituationDetails((current) => ({ ...current, [situationId]: detail }));
    } catch {
      if (personIdRef.current === personId) setWarning("The linked care records could not be loaded. The saved situation status has not changed.");
    } finally {
      if (personIdRef.current === personId) setSituationDetailLoadingIds((current) => current.filter((id) => id !== situationId));
    }
  }

  async function saveSituationState(situation: PersistedSituation) {
    const targetState = situationStates[situation.id] ?? (situation.state as SituationTrajectoryState);
    const reason = (situationReasons[situation.id] ?? "").trim();
    const evidenceIds = situationEvidenceIds(situation);
    if (!reason) {
      setWarning("Add a short reason before saving a care situation status.");
      return;
    }
    if (!evidenceIds.length) {
      setWarning("This situation has no linked notes and documents to support a status change.");
      return;
    }
    if (targetState === situation.state) return;
    setSituationTransitioningIds((current) => [...current, situation.id]);
    setWarning(null);
    try {
      await transitionSituationState(situation.id, targetState, reason, evidenceIds, personId);
      if (personIdRef.current !== personId) return;
      const [refreshed, refreshedDetail] = await Promise.all([
        listPersistedSituations(personId),
        getPersistedSituationDetail(situation.id, personId),
      ]);
      if (personIdRef.current !== personId) return;
      setSituations(refreshed);
      setSituationDetails((current) => ({ ...current, [situation.id]: refreshedDetail }));
      setSituationStates((current) => {
        const next = { ...current };
        delete next[situation.id];
        return next;
      });
      setSituationReasons((current) => ({ ...current, [situation.id]: "" }));
      setWarning(null);
    } catch {
      if (personIdRef.current === personId) setWarning("The care situation status could not be saved. The previous saved status remains in place.");
    } finally {
      if (personIdRef.current === personId) setSituationTransitioningIds((current) => current.filter((id) => id !== situation.id));
    }
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setWarning(null);
    setChanges([]);
    setPatterns([]);
    setSituations([]);
    setChangeOffset(0);
    setPatternOffset(0);
    setHasMoreChanges(false);
    setHasMorePatterns(false);
    setDetails({});
    setPatternDetails({});
    setSituationDetails({});
    setExpandedSituationIds([]);
    setSituationStates({});
    setSituationReasons({});
    setRefreshing(false);
    setTransitioningIds([]);
    setSituationTransitioningIds([]);
    setSituationDetailLoadingIds([]);
    setLoadingMoreChanges(false);
    setLoadingMorePatterns(false);
    async function load() {
      try {
        const [changeRows, patternRows, situationRows] = await Promise.all([
        listPersistedChanges(undefined, 100, 0, personId), listPersistedPatterns(undefined, 100, 0, personId), listPersistedSituations(personId),
      ]);
        if (!active) return;
        setChanges(changeRows);
        setPatterns(patternRows);
        setSituations(situationRows);
        setSituationStates({});
        setSituationReasons({});
        setChangeOffset(0);
        setPatternOffset(0);
        setHasMoreChanges(changeRows.length === 100);
        setHasMorePatterns(patternRows.length === 100);
      } catch (reason: unknown) {
        if (!active) return;
        setError(caregiverSafeErrorMessage());
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();

    return () => { active = false; };
  }, [personId]);

  // Daily Care dispatches this event only after its durable worker has finished
  // persisting the capture and its backend change assessments. Refresh the saved
  // projection here; do not trigger a second reconciliation from the browser.
  useEffect(() => {
    let active = true;
    async function refreshAfterSavedCareUpdate() {
      if (!active || personIdRef.current !== personId) return;
      setRefreshing(true);
      try {
        const [changeRows, patternRows, situationRows] = await Promise.all([
          listPersistedChanges(undefined, 100, 0, personId),
          listPersistedPatterns(undefined, 100, 0, personId),
          listPersistedSituations(personId),
        ]);
        if (!active || personIdRef.current !== personId) return;
        setChanges(changeRows);
        setPatterns(patternRows);
        setSituations(situationRows);
        setChangeOffset(0);
        setPatternOffset(0);
        setHasMoreChanges(changeRows.length === 100);
        setHasMorePatterns(patternRows.length === 100);
        setDetails({});
        setDetailErrors({});
        setPatternDetails({});
        setPatternDetailErrors({});
        setSituationDetails({});
        setSituationStates({});
        setSituationReasons({});
        setSituationDetailLoadingIds([]);
        setExpandedChangeId(null);
        setExpandedPatternId(null);
        setExpandedSituationIds([]);
        setWarning(null);
      } catch {
        if (active && personIdRef.current === personId) {
          setWarning("The care update was saved, but the latest changes could not be loaded. The previous saved information is still shown.");
        }
      } finally {
        if (active && personIdRef.current === personId) setRefreshing(false);
      }
    }
    window.addEventListener("careRecordUpdated", refreshAfterSavedCareUpdate);
    return () => {
      active = false;
      window.removeEventListener("careRecordUpdated", refreshAfterSavedCareUpdate);
    };
  }, [personId]);

  return (
    <section className="lcr-record-section" aria-labelledby="change-intelligence-heading">
      <div className="lcr-section-heading">
        <div>
          <p className="lcr-eyebrow">CHANGES IN CARE OVER TIME</p>
          <h2 id="change-intelligence-heading">Changes and patterns</h2>
        </div>
        <button
          type="button"
          className="lcr-text-action"
          disabled={refreshing || loading}
          onClick={() => void refreshSavedAssessments()}
        >
          {refreshing ? "Checking for updates…" : "Check for updates"}
        </button>
      </div>
      {loading ? <p role="status" className="panel-muted">Loading care changes…</p> : null}
      {warning ? <p role="status" className="panel-muted">{warning}</p> : null}
      {error ? (
        <p role="alert" className="panel-muted">
          Care changes could not be loaded right now. Your saved information is still here. We have not drawn a conclusion from this.
        </p>
      ) : null}
      {!loading && !error && changes.length === 0 && patterns.length === 0 && situations.length === 0 ? (
        <p className="panel-muted">
          There is not enough saved information to show changes or patterns yet. This does not mean nothing changed.
        </p>
      ) : null}
      {changes.length > 0 ? (
        <div className="lcr-timeline">
          {changes.map((change) => (
            <article key={change.id} className="lcr-timeline-item">
              <span className="lcr-timeline-marker" aria-hidden="true">↔</span>
              <div className="lcr-timeline-content">
                <div className="lcr-entry-heading">
                  <h3>{caregiverChangeLabel(change)}</h3>
                  <span>{change.is_active ? caregiverStatusLabel(change.confirmation_status) ?? "Needs review" : "Earlier review"}</span>
                  {change.significance_verdict ? <span>{caregiverStatusLabel(change.significance_verdict) ?? "Not reviewed"}</span> : null}
                </div>
                {change.explanation ? <p>{caregiverSafeChangeText(change.explanation) ?? "A possible change was found in the saved care information. Review the linked records before drawing a conclusion."}</p> : <p>{caregiverSafeChangeText(change.current_state) ?? "A possible change was found in the saved care information."}</p>}
                <p className="panel-muted">{formatWindow(change.comparison_window_start, change.comparison_window_end)}</p>
                <p className="panel-muted">
                  Based on {change.evidence_ids.length} saved care {change.evidence_ids.length === 1 ? "detail" : "details"}.
                </p>
                <p className="panel-muted">Some earlier care information may be missing. That does not mean the event did not happen.</p>
                <button type="button" className="lcr-text-action" onClick={() => void toggleEvidence(change.id)} aria-expanded={expandedChangeId === change.id}>
                  {expandedChangeId === change.id ? "Hide notes and documents" : "See the notes and documents"} <span aria-hidden="true">→</span>
                </button>
                {expandedChangeId === change.id && detailErrors[change.id] ? <p role="alert" className="panel-muted">{detailErrors[change.id]}</p> : null}
                {expandedChangeId === change.id && details[change.id] ? (
                  <div>
                    <label>
                      <span>Why are you saying this change is right or needs correcting?</span>
                      <textarea
                        value={confirmationReasons[change.id] ?? ""}
                        onChange={(event) => setConfirmationReasons((current) => ({ ...current, [change.id]: event.target.value }))}
                        rows={2}
                        maxLength={2000}
                      />
                    </label>
                    {change.is_active ? (
                      <div className="lcr-inline-actions">
                        {["confirmed", "rejected", "inconclusive", "resolved"].includes(change.confirmation_status) ? (
                          <>
                            <button type="button" disabled={transitioningIds.includes(change.id)} onClick={() => void changeStatus(change.id, "awaiting_confirmation")}>Review again</button>
                            {change.confirmation_status === "confirmed" &&
                              ["cessation", "disappearance"].includes(change.change_type) &&
                              change.baseline_coverage_status === "covered" &&
                              change.current_coverage_status === "covered" ? (
                              <button
                                type="button"
                                disabled={transitioningIds.includes(change.id) || !(confirmationReasons[change.id] ?? "").trim() || (details[change.id].evidence.length + details[change.id].assertions.length + details[change.id].observations.length === 0)}
                                onClick={() => void changeStatus(change.id, "resolved")}
                              >
                                Mark as no longer happening
                              </button>
                            ) : null}
                          </>
                        ) : (
                          <>
                            <button type="button" disabled={transitioningIds.includes(change.id) || !(confirmationReasons[change.id] ?? "").trim() || (details[change.id].evidence.length + details[change.id].assertions.length + details[change.id].observations.length === 0)} onClick={() => void changeStatus(change.id, "confirmed")}>This change is correct</button>
                            <button type="button" disabled={transitioningIds.includes(change.id) || !(confirmationReasons[change.id] ?? "").trim()} onClick={() => void changeStatus(change.id, "rejected")}>This change is not right</button>
                            <button type="button" disabled={transitioningIds.includes(change.id) || !(confirmationReasons[change.id] ?? "").trim()} onClick={() => void changeStatus(change.id, "inconclusive")}>I can’t confirm this</button>
                            {["cessation", "disappearance"].includes(change.change_type) &&
                              change.baseline_coverage_status === "covered" &&
                              change.current_coverage_status === "covered" ? (
                              <button
                                type="button"
                                disabled={transitioningIds.includes(change.id) || !(confirmationReasons[change.id] ?? "").trim() || (details[change.id].evidence.length + details[change.id].assertions.length + details[change.id].observations.length === 0)}
                                onClick={() => void changeStatus(change.id, "resolved")}
                              >
                                Mark as no longer happening
                              </button>
                            ) : null}
                          </>
                        )}
                      </div>
                    ) : (
                      <p className="panel-muted">This earlier review is kept in your care history and is no longer active.</p>
                    )}
                    {details[change.id].evidence.length === 0 && details[change.id].assertions.length === 0 && details[change.id].observations.length === 0 ? (
                      <p className="panel-muted">The notes or documents behind this change could not be loaded.</p>
                    ) : null}
                    {details[change.id].evidence.map((source) => (
                      <article key={source.id}>
                        <strong>{caregiverSafeAssistantText(source.title) ?? "Saved care update"}</strong>
                        <p>{caregiverSafeAssistantText(source.description) ?? "No further details are available."}</p>
                        <p className="panel-muted">{new Date(source.occurred_at).toLocaleString()} · {caregiverStatusLabel(source.status) ?? "Status not available"}</p>
                      </article>
                    ))}
                    {details[change.id].assertions.map((source) => (
                      <article key={source.id}>
                        <strong>{caregiverSafeAssistantText(source.field) ?? "Care detail"}: {caregiverSafeAssistantText(source.asserted_value) ?? "Saved care detail"}</strong>
                        <p>{caregiverSafeAssistantText(source.source_text ?? source.source_label) ?? "The original report is saved."}</p>
                        <p className="panel-muted">What we know: {caregiverInformationLabel(source.epistemic_state) ?? "Caregiver report"} · Has this been checked? {caregiverStatusLabel(source.assertion_status) ?? "Not checked"} · {source.observed_at ? new Date(source.observed_at).toLocaleString() : "Time not recorded"}</p>
                      </article>
                    ))}
                    {details[change.id].observations.map((source) => (
                      <article key={source.id}>
                        <strong>{caregiverSafeAssistantText(source.subject_label) ?? "Care detail"} · {caregiverSafeAssistantText(source.attribute) ?? "Recorded detail"}: {caregiverSafeAssistantText(source.normalized_value ?? source.value_text) ?? "Value not recorded"}{source.units ? ` ${source.units}` : ""}</strong>
                        <p>{caregiverSafeAssistantText(source.source_passage) ?? "The original wording is saved."}</p>
                        <p className="panel-muted">{caregiverInformationLabel(source.epistemic_status) ?? "Caregiver report"} · {source.observed_at ? new Date(source.observed_at).toLocaleString() : "Time not recorded"}</p>
                        {source.negated || source.hedge_marker || source.ambiguity_note ? (
                          <p className="panel-muted">{source.negated ? "The original report says this did not happen. " : ""}{source.hedge_marker ? "The original report expressed uncertainty. " : ""}{caregiverSafeAssistantText(source.ambiguity_note) ?? ""}</p>
                        ) : null}
                      </article>
                    ))}
                    {details[change.id].confirmation_history.length > 0 ? (
                      <div>
                        <strong>Review history</strong>
                        <ul>{details[change.id].confirmation_history.map((entry) => <li key={entry.id}>{caregiverStatusLabel(entry.previous_status) ?? "Previous review"} → {caregiverStatusLabel(entry.new_status) ?? "Updated review"}: {caregiverSafeAssistantText(entry.reason) ?? "No explanation recorded"} ({new Date(entry.created_at).toLocaleString()})</li>)}</ul>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : null}
      {hasMoreChanges ? (
        <button type="button" className="lcr-text-action" disabled={loadingMoreChanges} onClick={() => void loadMoreChanges()}>
          {loadingMoreChanges ? "Loading earlier changes…" : "Load earlier changes"}
        </button>
      ) : null}
      {patterns.length > 0 ? (
        <div className="lcr-timeline">
          {patterns.map((pattern) => (
            <article key={pattern.id} className="lcr-timeline-item">
              <span className="lcr-timeline-marker" aria-hidden="true">↻</span>
              <div className="lcr-timeline-content">
                <div className="lcr-entry-heading">
                  <h3>{caregiverStatusLabel(pattern.pattern_type) ?? "Repeated care change"}</h3>
                  <span>{pattern.is_active ? caregiverStatusLabel(pattern.pattern_strength) ?? "Not rated yet" : "Earlier pattern"}</span>
                </div>
                <p>When this happened: {formatWindow(pattern.temporal_start, pattern.temporal_end)}.</p>
                <p className="panel-muted">
                  Based on {pattern.event_ids.length} care update(s).
                </p>
                {pattern.pattern_metrics?.source_history_truncated === true ? <p className="panel-muted">Earlier care updates may not all be included in this review.</p> : null}
                {pattern.alternative_interpretations?.length ? (
                  <ul>
                    {pattern.alternative_interpretations.slice(0, 3).map((item, index) => (
                      <li key={`${pattern.id}-limit-${index}`}>{caregiverSafeGeneratedText(item) ?? "Another explanation may be possible."}</li>
                    ))}
                  </ul>
                ) : null}
                <button type="button" className="lcr-text-action" onClick={() => void togglePatternEvidence(pattern.id)} aria-expanded={expandedPatternId === pattern.id}>
                  {expandedPatternId === pattern.id ? "Hide notes and updates" : "Review notes and updates"} <span aria-hidden="true">→</span>
                </button>
                {expandedPatternId === pattern.id && patternDetailErrors[pattern.id] ? <p role="alert" className="panel-muted">{patternDetailErrors[pattern.id]}</p> : null}
                {expandedPatternId === pattern.id && patternDetails[pattern.id] ? (
                  <div>
                    <strong>Care updates included</strong>
                    {patternDetails[pattern.id].events.length === 0 ? <p className="panel-muted">No matching care updates were found.</p> : null}
                    {patternDetails[pattern.id].events.map((source) => (
                      <article key={source.id}>
                        <strong>{caregiverSafeAssistantText(source.title) ?? "Saved care update"}</strong>
                        <p>{caregiverSafeAssistantText(source.description) ?? "No further details are available."}</p>
                        <p className="panel-muted">{new Date(source.occurred_at).toLocaleString()} · {caregiverStatusLabel(source.status) ?? "Status not available"}</p>
                      </article>
                    ))}
                    {patternDetails[pattern.id].changes.length > 0 ? (
                      <>
                        <strong>Related changes</strong>
                        {patternDetails[pattern.id].changes.map((change) => (
                          <article key={change.id}>
                            <strong>{caregiverStatusLabel(change.change_type) ?? "Care change"} · {caregiverStatusLabel(change.change_direction) ?? "Direction not recorded"}</strong>
                            <p>{caregiverSafeChangeText(change.explanation) ?? "A change was recorded in the care history."}</p>
                            <p className="panel-muted">{caregiverStatusLabel(change.confirmation_status) ?? "Needs review"} · {change.evidence_ids.length} saved care {change.evidence_ids.length === 1 ? "detail" : "details"}</p>
                          </article>
                        ))}
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : null}
      {hasMorePatterns ? (
        <button type="button" className="lcr-text-action" disabled={loadingMorePatterns} onClick={() => void loadMorePatterns()}>
          {loadingMorePatterns ? "Loading earlier patterns…" : "Load earlier changes"}
        </button>
      ) : null}
      {situations.length > 0 ? (
        <div className="lcr-subsection">
          <h3>Care topics</h3>
          <p className="panel-muted">These updates were shared by a caregiver. They are not medical conclusions.</p>
          <div className="lcr-timeline">
            {situations.map((situation) => {
              const evidenceIds = situationEvidenceIds(situation);
              const selectedState = situationStates[situation.id] ?? (situation.state as SituationTrajectoryState);
              const situationDetail = situationDetails[situation.id];
              const allowedStates: SituationTrajectoryState[] = situation.state === "resolved"
                ? ["active"]
                : (["active", "worsening", "improving", "resolved", "unknown"] as SituationTrajectoryState[])
                    .filter((state) => state !== situation.state);
              const savedStateHistory = situation.context?.state_history ?? situationDetail?.state_history;
              const stateHistory = Array.isArray(savedStateHistory)
                ? savedStateHistory as Array<Record<string, unknown>>
                : [];
              return (
                <article key={situation.id} className="lcr-timeline-item">
                  <span className="lcr-timeline-marker" aria-hidden="true">◎</span>
                  <div className="lcr-timeline-content">
                    <div className="lcr-entry-heading">
                      <h3>{caregiverSafeAssistantText(situation.title) ?? "Saved care situation"}</h3>
                      <span>{caregiverSituationStateLabel(situation.state) ?? caregiverStatusLabel(situation.state) ?? "Needs review"}</span>
                    </div>
                    <p>{caregiverSafeChangeText(situation.description ?? situation.explanation) ?? "This care topic is based on saved information."}</p>
                    <p className="panel-muted">
                      {formatWindow(situation.temporal_start, situation.temporal_end)} · {evidenceIds.length} linked note(s) or document(s)
                    </p>
                    <button
                      type="button"
                      className="lcr-text-action"
                      disabled={situationDetailLoadingIds.includes(situation.id)}
                      onClick={() => void toggleSituationDetail(situation.id)}
                    >
                      {situationDetailLoadingIds.includes(situation.id)
                        ? "Loading related notes and documents…"
                        : expandedSituationIds.includes(situation.id)
                          ? "Hide related notes and documents"
                          : "Review related notes and documents"}
                    </button>
                    {expandedSituationIds.includes(situation.id) ? (
                      <div className="lcr-evidence-list">
                        {situationDetailLoadingIds.includes(situation.id) ? (
                          <p className="panel-muted">Loading notes and documents…</p>
                        ) : situationDetail && situationDetail.source_records.length > 0 ? (
                          situationDetail.source_records.map((record) => (
                            <article key={record.source_type + ":" + record.id} className="lcr-evidence-item">
                              <div className="lcr-entry-heading">
                                <strong>{caregiverSafeAssistantText(record.title) ?? "Saved care record"}</strong>
                                <span>{caregiverStatusLabel(record.status) ?? "Recorded"}</span>
                              </div>
                              <p className="panel-muted">
                                {caregiverSafeGeneratedText(record.source_label) || "Saved note or document"}
                                {record.occurred_at || record.recorded_at
                                  ? " · " + new Date(record.occurred_at ?? record.recorded_at ?? "").toLocaleString()
                                  : ""}
                              </p>
                              {record.excerpt ? (
                                <p>{caregiverSafeAssistantText(record.excerpt) || "The original wording could not be displayed."}</p>
                              ) : null}
                              {record.epistemic_status ? (
                                <p className="panel-muted">
                                  What was shared: {caregiverStatusLabel(record.epistemic_status) ?? "Reported"}
                                </p>
                              ) : null}
                              {record.negated ? <p className="panel-muted">Recorded as not present</p> : null}
                              {record.hedge_marker || record.ambiguity_note ? (
                                <p className="panel-muted">This information needs to be checked before we treat it as a confirmed change.</p>
                              ) : null}
                            </article>
                          ))
                        ) : (
                          <p className="panel-muted">No notes or documents are linked to this care topic yet.</p>
                        )}
                      </div>
                    ) : null}
                    {situation.is_active && situation.state !== "evolved" ? (
                      <div>
                        <label>
                          <span>Status shared by caregiver</span>
                          <select
                            value={selectedState}
                            onChange={(event) => setSituationStates((current) => ({
                              ...current,
                              [situation.id]: event.target.value as SituationTrajectoryState,
                            }))}
                          >
                            <option value={situation.state}>
                              {caregiverSituationStateLabel(situation.state) ?? caregiverStatusLabel(situation.state) ?? "Current status"} (current)
                            </option>
                            {allowedStates.map((state) => (
                              <option key={state} value={state}>{caregiverSituationStateLabel(state) ?? caregiverStatusLabel(state) ?? state}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <span>Why are you changing this?</span>
                          <textarea
                            value={situationReasons[situation.id] ?? ""}
                            onChange={(event) => setSituationReasons((current) => ({
                              ...current,
                              [situation.id]: event.target.value,
                            }))}
                            rows={2}
                            maxLength={1200}
                          />
                        </label>
                        <button
                          type="button"
                          disabled={
                            situationTransitioningIds.includes(situation.id) ||
                            selectedState === situation.state ||
                            !(situationReasons[situation.id] ?? "").trim() ||
                            evidenceIds.length === 0
                          }
                          onClick={() => void saveSituationState(situation)}
                        >
                          {situationTransitioningIds.includes(situation.id) ? "Saving status…" : "Save status"}
                        </button>
                      </div>
                    ) : (
                      <p className="panel-muted">This earlier situation is kept for history and cannot be changed.</p>
                    )}
                    {stateHistory.length > 0 ? (
                      <details>
                        <summary>Earlier updates ({stateHistory.length})</summary>
                        <ul>
                          {stateHistory.map((entry, index) => (
                            <li key={situation.id + "-state-" + index}>
                              <strong>{caregiverSituationStateLabel(String(entry.new_state ?? "")) ?? caregiverStatusLabel(String(entry.new_state ?? "")) ?? "Status updated"}</strong>
                              <p className="panel-muted">
                                {entry.recorded_at ? new Date(String(entry.recorded_at)).toLocaleString() : "Time not recorded"}
                              </p>
                              <p>{caregiverSafeChangeText(String(entry.reason ?? "")) ?? "A caregiver recorded a status update."}</p>
                              <p className="panel-muted">
                                {Array.isArray(entry.evidence_ids) ? entry.evidence_ids.length : 0} related {Array.isArray(entry.evidence_ids) && entry.evidence_ids.length === 1 ? "note or document" : "notes or documents"}
                              </p>
                            </li>
                          ))}
                        </ul>
                      </details>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}
