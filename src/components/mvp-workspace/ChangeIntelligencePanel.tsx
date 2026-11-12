"use client";

import { useEffect, useState } from "react";
import { caregiverInformationLabel, caregiverSafeAssistantText, caregiverSafeErrorMessage, caregiverStatusLabel } from "@/lib/caregiver-language";
import {
  getPersistedChangeDetail,
  getPersistedPatternDetail,
  listPersistedChanges,
  listPersistedPatterns,
  reassessPersistedChangeIntelligence,
  type ChangeDetail,
  type PersistedChange,
  type PersistedPattern,
  type PatternDetail,
  transitionChangeConfirmation,
} from "@/api/change-intelligence";

function caregiverChangeLabel(change: PersistedChange): string {
  // A database "emergence" with unknown/partial historical observation is only
  // first appearance in available records, not proof that the event began now.
  if (change.change_type === "emergence" && change.baseline_coverage_status !== "covered") {
    return "First observed";
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
export function ChangeIntelligencePanel() {
  const [changes, setChanges] = useState<PersistedChange[]>([]);
  const [patterns, setPatterns] = useState<PersistedPattern[]>([]);
  const [expandedPatternId, setExpandedPatternId] = useState<string | null>(null);
  const [patternDetails, setPatternDetails] = useState<Record<string, PatternDetail>>({});
  const [patternDetailErrors, setPatternDetailErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [expandedChangeId, setExpandedChangeId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, ChangeDetail>>({});
  const [detailErrors, setDetailErrors] = useState<Record<string, string>>({});
  const [confirmationReasons, setConfirmationReasons] = useState<Record<string, string>>({});
  const [transitioningIds, setTransitioningIds] = useState<string[]>([]);
  async function changeStatus(changeId: string, status: "awaiting_confirmation" | "confirmed" | "rejected" | "inconclusive") {
    const reason = confirmationReasons[changeId]?.trim() ?? "";
    if (status !== "awaiting_confirmation" && !reason) {
      setDetailErrors((current) => ({ ...current, [changeId]: "A decision rationale is required to confirm, dispute, or mark this assessment inconclusive." }));
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
      await transitionChangeConfirmation(changeId, status, reason, [...new Set(supportingIds)]);
      const [changeRows, patternRows] = await Promise.all([listPersistedChanges(), listPersistedPatterns()]);
      setChanges(changeRows.filter((row) => row.is_active));
      setPatterns(patternRows.filter((row) => row.is_active));
      const refreshedDetail = await getPersistedChangeDetail(changeId);
      setDetails((current) => ({ ...current, [changeId]: refreshedDetail }));
      setConfirmationReasons((current) => ({ ...current, [changeId]: "" }));
    } catch (reason: unknown) {
      setDetailErrors((current) => ({ ...current, [changeId]: caregiverSafeErrorMessage() }));
    } finally {
      setTransitioningIds((current) => current.filter((id) => id !== changeId));
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
      const detail = await getPersistedPatternDetail(patternId);
      setPatternDetails((current) => ({ ...current, [patternId]: detail }));
    } catch (reason: unknown) {
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
      const detail = await getPersistedChangeDetail(changeId);
      setDetails((current) => ({ ...current, [changeId]: detail }));
    } catch (reason: unknown) {
      setDetailErrors((current) => ({
        ...current,
        [changeId]: caregiverSafeErrorMessage(),
      }));
    }
  }

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        await reassessPersistedChangeIntelligence();
      } catch {
        if (active) setWarning("A fresh reassessment could not be completed. Previously persisted results will still be loaded; no result is inferred from this failure.");
      }
      try {
        const [changeRows, patternRows] = await Promise.all([listPersistedChanges(), listPersistedPatterns()]);
        if (!active) return;
        setChanges(changeRows.filter((row) => row.is_active));
        setPatterns(patternRows.filter((row) => row.is_active));
      } catch (reason: unknown) {
        if (!active) return;
        setError(caregiverSafeErrorMessage());
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  return (
    <section className="lcr-record-section" aria-labelledby="change-intelligence-heading">
      <div className="lcr-section-heading">
        <div>
          <p className="lcr-eyebrow">LONGITUDINAL UNDERSTANDING</p>
          <h2 id="change-intelligence-heading">Changes and patterns</h2>
        </div>
      </div>
      {loading ? <p role="status" className="panel-muted">Reviewing saved care changes…</p> : null}
      {warning ? <p role="status" className="panel-muted">{warning}</p> : null}
      {error ? (
        <p role="alert" className="panel-muted">
          Change assessments are unavailable right now. The record is preserved; no conclusion is inferred from this loading failure.
        </p>
      ) : null}
      {!loading && !error && changes.length === 0 && patterns.length === 0 ? (
        <p className="panel-muted">
          No persisted change or pattern assessments are available yet. This does not mean that no changes occurred.
        </p>
      ) : null}
      {changes.length > 0 ? (
        <div className="lcr-timeline">
          {changes.slice(0, 8).map((change) => (
            <article key={change.id} className="lcr-timeline-item">
              <span className="lcr-timeline-marker" aria-hidden="true">↔</span>
              <div className="lcr-timeline-content">
                <div className="lcr-entry-heading">
                  <h3>{caregiverChangeLabel(change)}</h3>
                  <span>{caregiverStatusLabel(change.confirmation_status) ?? "Needs review"}</span>
                </div>
                {change.explanation ? <p>{caregiverSafeAssistantText(change.explanation) ?? "A possible change was found in the saved care information."}</p> : <p>{caregiverSafeAssistantText(change.current_state) ?? "A possible change was found in the saved care information."}</p>}
                <p className="panel-muted">{formatWindow(change.comparison_window_start, change.comparison_window_end)}</p>
                <p className="panel-muted">
                  Supporting saved information: {change.evidence_ids.length}.
                </p>
                <p className="panel-muted">The comparison may be incomplete if earlier care information was not available.</p>            </p>
                <button type="button" className="lcr-text-action" onClick={() => void toggleEvidence(change.id)} aria-expanded={expandedChangeId === change.id}>
                  {expandedChangeId === change.id ? "Hide source evidence" : "Review source evidence"} <span aria-hidden="true">→</span>
                </button>
                {expandedChangeId === change.id && detailErrors[change.id] ? <p role="alert" className="panel-muted">{detailErrors[change.id]}</p> : null}
                {expandedChangeId === change.id && details[change.id] ? (
                  <div>
                    <label>
                      <span>Decision rationale (required to confirm, dispute, or mark inconclusive)</span>
                      <textarea
                        value={confirmationReasons[change.id] ?? ""}
                        onChange={(event) => setConfirmationReasons((current) => ({ ...current, [change.id]: event.target.value }))}
                        rows={2}
                        maxLength={2000}
                      />
                    </label>
                    <div className="lcr-inline-actions">
                      {["confirmed", "rejected", "inconclusive"].includes(change.confirmation_status) ? (
                        <button type="button" disabled={transitioningIds.includes(change.id)} onClick={() => void changeStatus(change.id, "awaiting_confirmation")}>Reopen for review</button>
                      ) : (
                        <>
                          <button type="button" disabled={transitioningIds.includes(change.id) || !(confirmationReasons[change.id] ?? "").trim() || (details[change.id].evidence.length + details[change.id].assertions.length + details[change.id].observations.length === 0)} onClick={() => void changeStatus(change.id, "confirmed")}>Confirm supported</button>
                          <button type="button" disabled={transitioningIds.includes(change.id) || !(confirmationReasons[change.id] ?? "").trim()} onClick={() => void changeStatus(change.id, "rejected")}>Dispute assessment</button>
                          <button type="button" disabled={transitioningIds.includes(change.id) || !(confirmationReasons[change.id] ?? "").trim()} onClick={() => void changeStatus(change.id, "inconclusive")}>Mark inconclusive</button>
                        </>
                      )}
                    </div>
                    {details[change.id].evidence.length === 0 && details[change.id].assertions.length === 0 && details[change.id].observations.length === 0 ? (
                      <p className="panel-muted">No source records could be resolved for this assessment. Its evidence references should be reviewed.</p>
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
                        <p className="panel-muted">Information: {caregiverInformationLabel(source.epistemic_state) ?? "Caregiver report"} · Review: {caregiverStatusLabel(source.assertion_status) ?? "Not checked"} · {source.observed_at ? new Date(source.observed_at).toLocaleString() : "Observation time unknown"}</p>
                      </article>
                    ))}
                    {details[change.id].observations.map((source) => (
                      <article key={source.id}>
                        <strong>{caregiverSafeAssistantText(source.subject_label) ?? "Care detail"} · {caregiverSafeAssistantText(source.attribute) ?? "Recorded detail"}: {caregiverSafeAssistantText(source.normalized_value ?? source.value_text) ?? "Value not recorded"}{source.units ? ` ${source.units}` : ""}</strong>
                        <p>{caregiverSafeAssistantText(source.source_passage) ?? "The original wording is saved."}</p>
                        <p className="panel-muted">{caregiverInformationLabel(source.epistemic_status) ?? "Caregiver report"} · {source.observed_at ? new Date(source.observed_at).toLocaleString() : "Observation time unknown"}</p>
                        {source.negated || source.hedge_marker || source.ambiguity_note ? (
                          <p className="panel-muted">{source.negated ? "The original report says this did not happen. " : ""}{source.hedge_marker ? "The original report expressed uncertainty. " : ""}{caregiverSafeAssistantText(source.ambiguity_note) ?? ""}</p>
                        ) : null}
                      </article>
                    ))}
                    {details[change.id].confirmation_history.length > 0 ? (
                      <div>
                        <strong>Confirmation history</strong>
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
      {patterns.length > 0 ? (
        <div className="lcr-timeline">
          {patterns.slice(0, 8).map((pattern) => (
            <article key={pattern.id} className="lcr-timeline-item">
              <span className="lcr-timeline-marker" aria-hidden="true">↻</span>
              <div className="lcr-timeline-content">
                <div className="lcr-entry-heading">
                  <h3>{caregiverStatusLabel(pattern.pattern_type) ?? "Repeated care change"}</h3>
                  <span>{caregiverStatusLabel(pattern.pattern_strength) ?? "Pattern not rated"}</span>
                </div>
                <p>Observed interval: {formatWindow(pattern.temporal_start, pattern.temporal_end)}.</p>
                <p className="panel-muted">
                  Saved care updates considered: {pattern.event_ids.length}.
                </p>
                {pattern.pattern_metrics?.source_history_truncated === true ? <p className="panel-muted">Earlier care updates may not all be included in this review.</p> : null}
                {pattern.alternative_interpretations?.length ? (
                  <ul>
                    {pattern.alternative_interpretations.slice(0, 3).map((item, index) => (
                      <li key={`${pattern.id}-limit-${index}`}>{typeof item === "string" ? caregiverSafeAssistantText(item) ?? "Another explanation may be possible." : "Another explanation may be possible."}</li>
                    ))}
                  </ul>
                ) : null}
                <button type="button" className="lcr-text-action" onClick={() => void togglePatternEvidence(pattern.id)} aria-expanded={expandedPatternId === pattern.id}>
                  {expandedPatternId === pattern.id ? "Hide pattern sources" : "Review pattern sources"} <span aria-hidden="true">→</span>
                </button>
                {expandedPatternId === pattern.id && patternDetailErrors[pattern.id] ? <p role="alert" className="panel-muted">{patternDetailErrors[pattern.id]}</p> : null}
                {expandedPatternId === pattern.id && patternDetails[pattern.id] ? (
                  <div>
                    <strong>Supporting source events</strong>
                    {patternDetails[pattern.id].events.length === 0 ? <p className="panel-muted">No same-record source events could be resolved for this pattern.</p> : null}
                    {patternDetails[pattern.id].events.map((source) => (
                      <article key={source.id}>
                        <strong>{caregiverSafeAssistantText(source.title) ?? "Saved care update"}</strong>
                        <p>{caregiverSafeAssistantText(source.description) ?? "No further details are available."}</p>
                        <p className="panel-muted">{new Date(source.occurred_at).toLocaleString()} · {caregiverStatusLabel(source.status) ?? "Status not available"}</p>
                      </article>
                    ))}
                    {patternDetails[pattern.id].changes.length > 0 ? (
                      <>
                        <strong>Linked change assessments</strong>
                        {patternDetails[pattern.id].changes.map((change) => (
                          <article key={change.id}>
                            <strong>{caregiverStatusLabel(change.change_type) ?? "Care change"} · {caregiverStatusLabel(change.change_direction) ?? "Direction not recorded"}</strong>
                            <p>{caregiverSafeAssistantText(change.explanation) ?? "A change was recorded in the care history."}</p>
                            <p className="panel-muted">{caregiverStatusLabel(change.confirmation_status) ?? "Needs review"} · {change.evidence_ids.length} saved item(s)</p>
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
    </section>
  );
}
