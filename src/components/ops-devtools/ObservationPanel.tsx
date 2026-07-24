"use client";

import type { SystemAggregation } from "@/lib/observation-intelligence";
import type { StructuredObservation } from "@/lib/observation-intelligence";

export type ObservationPanelData = {
  latestStructured: StructuredObservation[];
  aggregation: SystemAggregation | null;
  weeklySnippet: string | null;
  observationsThisWeek: number;
};

interface ObservationPanelProps {
  data: ObservationPanelData;
}

export function ObservationPanel({ data }: ObservationPanelProps) {
  const { latestStructured, aggregation, weeklySnippet, observationsThisWeek } = data;

  if (latestStructured.length === 0 && !weeklySnippet) {
    return (
      <p className="sidebar-empty">
        No observations recorded yet. Use Record Observation to capture what you see.
      </p>
    );
  }

  return (
    <div className="observation-panel">
      <dl className="sidebar-dl">
        <dt>Observations this week</dt>
        <dd>{observationsThisWeek}</dd>
        {weeklySnippet && (
          <>
            <dt>Weekly trend</dt>
            <dd>{weeklySnippet}</dd>
          </>
        )}
      </dl>

      {latestStructured.length > 0 && (
        <div className="observation-signals">
          <h3>Latest signals</h3>
          <ul>
            {latestStructured.map((s) => (
              <li key={`${s.category}-${s.signal}`}>
                <span className={`severity-badge severity-${s.severity}`}>{s.severity}</span>
                <span className="signal-category">{s.category.replace(/_/g, " ")}</span>
                <span className="signal-name">{s.signal.replace(/_/g, " ")}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {aggregation && (
        <div className="observation-aggregation">
          <h3>What matters now</h3>
          <p>{aggregation.what_matters_now}</p>
          <p className="sidebar-meta">
            Risk level (observation-based):{" "}
            <span className={`risk-badge risk-${aggregation.risk_level}`}>
              {aggregation.risk_level}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}

export function ObservationResultCard({
  structured,
  aggregation,
  weeklySnippet,
  onListen,
  listenLoading,
}: {
  structured: StructuredObservation[];
  aggregation: SystemAggregation;
  weeklySnippet: string;
  onListen?: () => void;
  listenLoading?: boolean;
}) {
  return (
    <section className="observation-result" aria-label="Latest observation result">
      <div className="observation-result-header">
        <h2 className="observation-result-title">Observation Recorded</h2>
        {onListen && (
          <button
            type="button"
            className="btn-listen"
            onClick={onListen}
            disabled={listenLoading}
            aria-label="Listen to weekly summary"
          >
            {listenLoading ? "…" : "Listen"}
          </button>
        )}
      </div>
      {structured.length > 0 ? (
        <ul className="observation-result-signals">
          {structured.map((s) => (
            <li key={`${s.category}-${s.signal}`}>
              <code>
                {JSON.stringify({
                  category: s.category,
                  extracted_signal: s.signal,
                  severity: s.severity,
                })}
              </code>
            </li>
          ))}
        </ul>
      ) : (
        <p className="sidebar-note">No specific signals detected — try adding more detail.</p>
      )}
      <p className="observation-result-matters">{aggregation.what_matters_now}</p>
      {weeklySnippet && <p className="observation-result-trend">{weeklySnippet}</p>}
    </section>
  );
}
