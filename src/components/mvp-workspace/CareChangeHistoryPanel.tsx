"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getJSON } from "@/api/client";
import { caregiverSourceText, caregiverSafeAssistantText, caregiverSafeChangeText, caregiverStatusLabel } from "@/lib/caregiver-language";

type SourceReference = {
  record_type?: string;
  record_id?: string;
  label?: string;
  source_excerpt?: string;
  occurred_at?: string | null;
  recorded_at?: string | null;
  reported_by?: string | null;
  entered_by?: string | null;
};

type ComputedChange = {
  domain?: string;
  name?: string;
  change_type?: string;
  classification?: string;
  previous?: string | null;
  current?: string | null;
  certainty?: string;
  evidence_supported?: boolean;
  claim_supported?: boolean | null;
  source_record_refs?: SourceReference[];
  source_reference_status?: string;
  comparison_basis?: string;
  historical_only?: boolean;
};

type DeltaRun = {
  id: string;
  source?: string;
  event_date?: string;
  created_at?: string;
  source_freshness?: { status?: string; reasons?: string[] };
  delta?: {
    computed_changes?: ComputedChange[];
    contradictions?: Array<{
      topic?: string;
      reports?: string[];
      why_conflicting?: string;
      source_record_refs?: SourceReference[];
      source_reference_status?: string;
    }>;
  } | null;
};

function formatDate(value?: string | null): string {
  if (!value) return "Date not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date not recorded"
    : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function display(value: unknown): string {
  return caregiverSafeAssistantText(String(value ?? "")) || "Not recorded";
}

function displayChangeText(value: unknown, fallback = "Saved care information"): string {
  return caregiverSafeChangeText(value) || fallback;
}

function readableSource(value?: string | null): string {
  if (!value) return "Saved care information";
  const labels: Record<string, string> = {
    caregiver_report: "Caregiver report",
    daily_care: "Daily care",
    daily_care_entry: "Daily care update",
    daily_care_capture: "Daily care",
    solenos_daily_capture: "Daily care",
    situation_understanding_assessment: "Care situation review",
    document: "Document",
    document_upload: "Document",
    appointment: "Appointment",
    care_handoff: "Care handoff",
  };
  return labels[value.trim().toLowerCase()] || displayChangeText(value);
}

function readableChangeType(value?: string | null, classification?: string | null): string {
  const candidateLabels: Record<string, string> = {
    potential_worsening: "May be getting worse",
    potential_improvement: "May be improving",
    potential_resolution: "May no longer be happening",
    recurring: "Reported again",
    persistent: "Still reported",
    unchanged: "No meaningful change identified",
    new: "Newly reported",
    uncertain: "Direction is unclear",
  };
  const classificationKey = String(classification || "").trim().toLowerCase();
  return candidateLabels[classificationKey]
    || caregiverStatusLabel(value || "")
    || displayChangeText(value, "Care change");
}

function supported(change: ComputedChange): boolean {
  return change.certainty === "supported" &&
    change.evidence_supported === true &&
    change.claim_supported === true &&
    Array.isArray(change.source_record_refs) &&
    change.source_record_refs.length > 0 &&
    change.historical_only !== true;
}

export default function CareChangeHistoryPanel({ personId }: { personId: string }) {
  const [runs, setRuns] = useState<DeltaRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [earlierError, setEarlierError] = useState("");
  const requestSequence = useRef(0);
  const earlierRequestActive = useRef(false);

  const load = useCallback(async () => {
    if (!personId) {
      setRuns([]);
      setHasMore(false);
      setLoading(false);
      return;
    }
    const requestId = ++requestSequence.current;
    setLoading(true);
    setError("");
    try {
      const result = await getJSON(`/care-delta/runs/${encodeURIComponent(personId)}?limit=20&offset=0`);
      if (!Array.isArray(result)) throw new Error("Unexpected care-change history response");
      if (requestId !== requestSequence.current) return;
      setRuns(result as DeltaRun[]);
      setHasMore(result.length === 20);
      setEarlierError("");
    } catch {
      if (requestId === requestSequence.current) {
        setError("Earlier care-change comparisons could not be loaded. Your saved care information has not been changed.");
      }
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
  }, [personId]);

  const loadEarlier = useCallback(async () => {
    if (!personId || loadingEarlier || earlierRequestActive.current || !hasMore) return;
    earlierRequestActive.current = true;
    const requestId = requestSequence.current;
    setLoadingEarlier(true);
    setEarlierError("");
    try {
      const result = await getJSON(`/care-delta/runs/${encodeURIComponent(personId)}?limit=20&offset=${runs.length}`);
      if (!Array.isArray(result)) throw new Error("Unexpected care-change history response");
      if (requestId !== requestSequence.current) return;
      setRuns((current) => {
        const knownIds = new Set(current.map((run) => run.id));
        return [...current, ...(result as DeltaRun[]).filter((run) => !knownIds.has(run.id))];
      });
      setHasMore(result.length === 20);
    } catch {
      if (requestId === requestSequence.current) {
        setEarlierError("Earlier comparisons could not be loaded. The comparisons already shown are still available.");
      }
    } finally {
      earlierRequestActive.current = false;
      setLoadingEarlier(false);
    }
  }, [hasMore, loadingEarlier, personId, runs.length]);

  useEffect(() => {
    void load();
    const refresh = () => { void load(); };
    window.addEventListener("careRecordUpdated", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("careRecordUpdated", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [load]);

  if (!personId) return null;
  if (loading) return <section aria-label="Care changes over time"><p>Loading saved care changes…</p></section>;
  if (error) return (
    <section aria-label="Care changes over time">
      <h2>What has changed over time</h2>
      <p role="alert">{error}</p>
      <button type="button" onClick={() => void load()}>Try again</button>
    </section>
  );
  if (runs.length === 0) return (
    <section aria-label="Care changes over time">
      <h2>What has changed over time</h2>
      <p>No saved comparisons are available yet. New care updates can be compared with earlier recorded information.</p>
    </section>
  );

  return (
    <section aria-label="Care changes over time">
      <h2>What has changed over time</h2>
      <p>These comparisons use saved care reports. A reported change is not, by itself, a medical conclusion.</p>
      <ol>
        {runs.map((run) => {
          const changes = run.delta?.computed_changes ?? [];
          const freshnessStatus = run.source_freshness?.status ?? "not_checked";
          const comparisonCurrent = freshnessStatus === "current";
          // Only a comparison whose complete source/context check succeeded may
          // be presented as currently supported. Stale, missing, and unchecked
          // freshness are all fail-closed review states.
          const confirmed = comparisonCurrent ? changes.filter(supported) : [];
          const needsReview = comparisonCurrent ? changes.filter((item) => !supported(item)) : changes;
          const conflicts = run.delta?.contradictions ?? [];
          return (
            <li key={run.id}>
              <article>
                <h3>{formatDate(run.event_date || run.created_at)}</h3>
                <p>Compared with earlier information · {readableSource(run.source)}</p>
                {confirmed.length > 0 && (
                  <div>
                    <h4>Changes supported by saved records</h4>
                    <ul>
                      {confirmed.map((item, index) => (
                        <li key={`${run.id}-supported-${index}`}>
                          <strong>{display(item.name || item.domain)}</strong>
                          <p>
                            {readableChangeType(item.change_type, item.classification)}.
                            {item.previous != null ? ` Previous: ${displayChangeText(item.previous, "Earlier details are not available.")}.` : ""}
                            {item.current != null ? ` Reported now: ${displayChangeText(item.current, "Current details are saved but need a closer look.")}.` : ""}
                          </p>
                          {item.source_record_refs?.map((source, sourceIndex) => (
                            <details key={`${run.id}-source-${index}-${sourceIndex}`}>
                              <summary>Where this information came from</summary>
                              <p>{displayChangeText(source.label || readableSource(source.record_type))}</p>
                              {source.source_excerpt && <blockquote>{caregiverSourceText(source.source_excerpt) || "Original wording not available"}</blockquote>}
                              <p>Happened: {formatDate(source.occurred_at)} · Recorded: {formatDate(source.recorded_at)}</p>
                              {source.reported_by && <p>Reported by: {caregiverSourceText(source.reported_by) || "Not recorded"}</p>}
                            </details>
                          ))}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {needsReview.length > 0 && (
                  <div>
                    <h4>What still needs checking</h4>
                    <ul>
                      {needsReview.map((item, index) => (
                        <li key={`${run.id}-review-${index}`}>
                          {display(item.name || item.domain)}: {readableChangeType(item.change_type, item.classification)}.
                          {item.comparison_basis ? ` ${displayChangeText(item.comparison_basis, "The available records do not support a reliable comparison yet.")}` : " The available records do not support a reliable comparison yet."}
                          {item.source_reference_status === "partial" && <p>Some source details are missing or could not be matched.</p>}
                          {item.source_record_refs?.length ? (
                            <details>
                              <summary>Review available source details</summary>
                              {item.source_record_refs.map((source, sourceIndex) => (
                                <div key={`${run.id}-review-source-${index}-${sourceIndex}`}>
                                  <p>{displayChangeText(source.label || readableSource(source.record_type))}</p>
                                  {source.source_excerpt && <blockquote>{caregiverSourceText(source.source_excerpt) || "Original wording not available"}</blockquote>}
                                  <p>Happened: {formatDate(source.occurred_at)} · Recorded: {formatDate(source.recorded_at)}</p>
                                  {source.reported_by && <p>Reported by: {caregiverSourceText(source.reported_by) || "Not recorded"}</p>}
                                </div>
                              ))}
                            </details>
                          ) : <p>No linked source details are available for this comparison.</p>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {conflicts.length > 0 && (
                  <div>
                    <h4>Reports that differ</h4>
                    <ul>
                      {conflicts.map((item, index) => (
                        <li key={`${run.id}-conflict-${index}`}>
                          {display(item.topic)}: {display(item.why_conflicting)}
                          {item.reports?.map((report, reportIndex) => <blockquote key={reportIndex}>{display(report)}</blockquote>)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {!comparisonCurrent && (
                  <p role="note">
                    {freshnessStatus === "stale"
                      ? "The care record changed after this comparison. Treat this result as unverified until it is reviewed again."
                      : "SolenOS could not confirm that the source history for this comparison is current. Treat this result as unverified."}
                  </p>
                )}
                {comparisonCurrent && confirmed.length === 0 && needsReview.length === 0 && conflicts.length === 0 && (
                  <p>No supported change was established by this comparison.</p>
                )}
              </article>
            </li>
          );
        })}
      </ol>
      {earlierError && <p role="alert">{earlierError}</p>}
      {hasMore && (
        <button type="button" onClick={() => void loadEarlier()} disabled={loadingEarlier}>
          {loadingEarlier ? "Loading earlier comparisons…" : "Load earlier comparisons"}
        </button>
      )}
      <button type="button" onClick={() => void load()}>Refresh saved comparisons</button>
    </section>
  );
}
