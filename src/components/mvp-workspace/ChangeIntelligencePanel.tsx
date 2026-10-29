"use client";

import { useEffect, useState } from "react";
import {
  getPersistedChangeDetail,
  listPersistedChanges,
  listPersistedPatterns,
  reassessPersistedChangeIntelligence,
  type ChangeDetail,
  type PersistedChange,
  type PersistedPattern,
  transitionChangeConfirmation,
} from "@/api/change-intelligence";

function readable(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
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
    if ((status === "rejected" || status === "inconclusive") && !reason) {
      setDetailErrors((current) => ({ ...current, [changeId]: "A reason is required to dispute or mark this assessment inconclusive." }));
      return;
    }
    setTransitioningIds((current) => [...current, changeId]);
    setDetailErrors((current) => { const next = { ...current }; delete next[changeId]; return next; });
    try {
      await transitionChangeConfirmation(changeId, status, reason, details[changeId]?.evidence.map((item) => item.id) ?? []);
      const [changeRows, patternRows] = await Promise.all([listPersistedChanges(), listPersistedPatterns()]);
      setChanges(changeRows.filter((row) => row.is_active));
      setPatterns(patternRows.filter((row) => row.is_active));
      const detail = await getPersistedChangeDetail(changeId);
      setDetails((current) => ({ ...current, [changeId]: detail }));
      setConfirmationReasons((current) => ({ ...current, [changeId]: "" }));
    } catch (reason: unknown) {
      setDetailErrors((current) => ({ ...current, [changeId]: reason instanceof Error ? reason.message : "The confirmation decision could not be saved." }));
    } finally {
      setTransitioningIds((current) => current.filter((id) => id !== changeId));
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
        [changeId]: reason instanceof Error ? reason.message : "Source evidence could not be loaded.",
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
        setError(reason instanceof Error ? reason.message : "Persisted change assessments could not be loaded.");
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
      {loading ? <p role="status" className="panel-muted">Loading persisted change assessments…</p> : null}
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
                  <h3>{readable(change.change_type)} · {readable(change.subject_type)}</h3>
                  <span>{readable(change.confirmation_status)}</span>
                </div>
                {change.explanation ? <p>{change.explanation}</p> : <p>{change.current_state ?? "Change assessment recorded; explanation unavailable."}</p>}
                <p className="panel-muted">{formatWindow(change.comparison_window_start, change.comparison_window_end)}</p>
                <p className="panel-muted">
                  Evidence references: {change.evidence_ids.length}. Confidence: {change.confidence == null ? "not calibrated" : `${Math.round(change.confidence * 100)}%`}.
                </p>
                <button type="button" className="lcr-text-action" onClick={() => void toggleEvidence(change.id)} aria-expanded={expandedChangeId === change.id}>
                  {expandedChangeId === change.id ? "Hide source evidence" : "Review source evidence"} <span aria-hidden="true">→</span>
                </button>
                {expandedChangeId === change.id && detailErrors[change.id] ? <p role="alert" className="panel-muted">{detailErrors[change.id]}</p> : null}
                {expandedChangeId === change.id && details[change.id] ? (
                  <div>
                    <label>
                      <span>Decision rationale (required to dispute or mark inconclusive)</span>
                      <textarea
                        value={confirmationReasons[change.id] ?? ""}
                        onChange={(event) => setConfirmationReasons((current) => ({ ...current, [change.id]: event.target.value }))}
                        rows={2}
                        maxLength={2000}
                      />
                    </label>
                    <div className="lcr-inline-actions">
                      <button type="button" disabled={transitioningIds.includes(change.id)} onClick={() => void changeStatus(change.id, "confirmed")}>Confirm supported</button>
                      <button type="button" disabled={transitioningIds.includes(change.id) || !(confirmationReasons[change.id] ?? "").trim()} onClick={() => void changeStatus(change.id, "rejected")}>Dispute assessment</button>
                      <button type="button" disabled={transitioningIds.includes(change.id) || !(confirmationReasons[change.id] ?? "").trim()} onClick={() => void changeStatus(change.id, "inconclusive")}>Mark inconclusive</button>
                    </div>
                    {details[change.id].evidence.length === 0 && details[change.id].assertions.length === 0 ? (
                      <p className="panel-muted">No source records could be resolved for this assessment. Its evidence references should be reviewed.</p>
                    ) : null}
                    {details[change.id].evidence.map((source) => (
                      <article key={source.id}>
                        <strong>{source.title}</strong>
                        <p>{source.description ?? "No source description recorded."}</p>
                        <p className="panel-muted">{new Date(source.occurred_at).toLocaleString()} · {source.event_type} · {source.status}</p>
                      </article>
                    ))}
                    {details[change.id].assertions.map((source) => (
                      <article key={source.id}>
                        <strong>{source.field}: {source.asserted_value}</strong>
                        <p>{source.source_text ?? source.source_label}</p>
                        <p className="panel-muted">{source.assertion_kind} · {source.assertion_status} · {source.observed_at ? new Date(source.observed_at).toLocaleString() : "Observation time unknown"}</p>
                      </article>
                    ))}
                    {details[change.id].confirmation_history.length > 0 ? (
                      <div>
                        <strong>Confirmation history</strong>
                        <ul>{details[change.id].confirmation_history.map((entry) => <li key={entry.id}>{entry.previous_status} → {entry.new_status}: {entry.reason ?? "No reason recorded"} ({new Date(entry.created_at).toLocaleString()})</li>)}</ul>
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
                  <h3>{readable(pattern.pattern_type)} · {readable(pattern.subject_type)}</h3>
                  <span>{readable(pattern.pattern_strength)}</span>
                </div>
                <p>Observed interval: {formatWindow(pattern.temporal_start, pattern.temporal_end)}.</p>
                <p className="panel-muted">
                  Source events: {pattern.event_ids.length}. Confidence: {pattern.confidence == null ? "not calibrated" : `${Math.round(pattern.confidence * 100)}%`}.
                </p>
                {pattern.alternative_interpretations?.length ? (
                  <ul>
                    {pattern.alternative_interpretations.slice(0, 3).map((item, index) => (
                      <li key={`${pattern.id}-limit-${index}`}>{typeof item === "string" ? item : JSON.stringify(item)}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
