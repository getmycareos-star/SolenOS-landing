"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { ensureAnonymousSession, getJSON } from "@/api/client";

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

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    else setLoading(true);
    setError(null);
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
    } catch (cause) {
      setProjection(null);
      setError(cause instanceof Error ? cause.message : "The longitudinal care record could not be loaded.");
    } finally {
      setLoading(false);
      setRefreshing(false);
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
                    {item.claim_count > 0 && <small>Competing claims linked: {item.claim_count}</small>}
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
