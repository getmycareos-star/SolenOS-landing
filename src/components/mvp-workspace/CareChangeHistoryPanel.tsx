"use client";

import { useCallback, useEffect, useState } from "react";
import { getJSON } from "@/api/client";
import { caregiverSafeAssistantText, caregiverStatusLabel } from "@/lib/caregiver-language";

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
  previous?: string | null;
  current?: string | null;
  certainty?: string;
  evidence_supported?: boolean;
  claim_supported?: boolean | null;
  source_record_refs?: SourceReference[];
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

function supported(change: ComputedChange): boolean {
  return change.certainty === "supported" &&
    change.evidence_supported === true &&
    change.claim_supported !== false &&
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

  const load = useCallback(async () => {
    if (!personId) {
      setRuns([]);
      setHasMore(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await getJSON(`/care-delta/runs/${encodeURIComponent(personId)}?limit=20&offset=0`);
      if (!Array.isArray(result)) throw new Error("Unexpected care-change history response");
      setRuns(result as DeltaRun[]);
      setHasMore(result.length === 20);
      setEarlierError("");
    } catch {
      setError("Earlier care-change comparisons could not be loaded. Your saved care information has not been changed.");
    } finally {
      setLoading(false);
    }
  }, [personId]);

  const loadEarlier = useCallback(async () => {
    if (!personId || loadingEarlier || !hasMore) return;
    setLoadingEarlier(true);
    setEarlierError("");
    try {
      const result = await getJSON(`/care-delta/runs/${encodeURIComponent(personId)}?limit=20&offset=${runs.length}`);
      if (!Array.isArray(result)) throw new Error("Unexpected care-change history response");
      setRuns((current) => [...current, ...(result as DeltaRun[])]);
      setHasMore(result.length === 20);
    } catch {
      setEarlierError("Earlier comparisons could not be loaded. The comparisons already shown are still available.");
    } finally {
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
          const confirmed = changes.filter(supported);
          const needsReview = changes.filter((item) => !supported(item));
          const conflicts = run.delta?.contradictions ?? [];
          return (
            <li key={run.id}>
              <article>
                <h3>{formatDate(run.event_date || run.created_at)}</h3>
                <p>Compared with earlier information · {display(run.source || "Caregiver report")}</p>
                {confirmed.length > 0 && (
                  <div>
                    <h4>Changes supported by saved records</h4>
                    <ul>
                      {confirmed.map((item, index) => (
                        <li key={`${run.id}-supported-${index}`}>
                          <strong>{display(item.name || item.domain)}</strong>
                          <p>
                            {display(caregiverStatusLabel(item.change_type || "") || item.change_type)}.
                            {item.previous != null ? ` Previous: ${display(item.previous)}.` : ""}
                            {item.current != null ? ` Reported now: ${display(item.current)}.` : ""}
                          </p>
                          {item.source_record_refs?.map((source, sourceIndex) => (
                            <details key={`${run.id}-source-${index}-${sourceIndex}`}>
                              <summary>Where this information came from</summary>
                              <p>{display(source.label || source.record_type)}</p>
                              {source.source_excerpt && <blockquote>{display(source.source_excerpt)}</blockquote>}
                              <p>Happened: {formatDate(source.occurred_at)} · Recorded: {formatDate(source.recorded_at)}</p>
                              {source.reported_by && <p>Reported by: {display(source.reported_by)}</p>}
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
                          {display(item.name || item.domain)}: {display(item.change_type)}.
                          {item.comparison_basis ? ` ${display(item.comparison_basis)}` : " The available records do not support a reliable comparison yet."}
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
                {run.source_freshness?.status === "stale" && (
                  <p role="note">A source record changed after this comparison. This result may need to be reviewed again.</p>
                )}
                {confirmed.length === 0 && needsReview.length === 0 && conflicts.length === 0 && (
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
