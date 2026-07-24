"use client";

import { useCallback, useState } from "react";

import type { MemoryReconstructionResult } from "@/lib/memory-reconstruction-engine";

type Props = {
  className?: string;
};

export function MemoryReconstructionPanel({ className }: Props) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<MemoryReconstructionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reconstruct = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/memory/reconstruct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q.trim() }),
      });
      const data = (await res.json()) as {
        result?: MemoryReconstructionResult;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "Reconstruction failed");
      }
      setResult(data.result ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reconstruction failed");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <section
      className={`memory-reconstruction-panel${className ? ` ${className}` : ""}`}
      aria-label="Memory reconstruction"
    >
      <h3 className="memory-reconstruction-title">What happened over time?</h3>
      <p className="memory-reconstruction-note">
        solenos reconstructs your care journey — not keyword search over notes.
      </p>

      <form
        className="memory-reconstruction-search"
        onSubmit={(e) => {
          e.preventDefault();
          void reconstruct(query);
        }}
      >
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="When did confusion start? How has appetite changed?"
          aria-label="Memory reconstruction question"
        />
        <button type="submit" disabled={loading || !query.trim()}>
          Reconstruct
        </button>
      </form>

      {loading && <p className="memory-reconstruction-muted">Reconstructing timeline…</p>}
      {error && (
        <p className="memory-reconstruction-error" role="alert">
          {error}
        </p>
      )}

      {result && (
        <article className="memory-reconstruction-result">
          <p className="memory-confidence">
            Confidence: <span className={`conf-${result.confidence}`}>{result.confidence.replace(/_/g, " ")}</span>
            {" · "}
            {result.events_analyzed} event(s) analyzed
          </p>

          <section>
            <h4>Continuity insight</h4>
            <p>{result.continuity_insight}</p>
          </section>

          {result.timeline_summary.length > 0 && (
            <section>
              <h4>Timeline</h4>
              <ul>
                {result.timeline_summary.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>
          )}

          {result.reconstructed_memory.length > 0 && (
            <section>
              <h4>Reconstructed memory</h4>
              <ul className="memory-reconstructed-list">
                {result.reconstructed_memory.map((entry) => (
                  <li key={`${entry.timestamp}-${entry.event}`}>
                    <strong>{entry.event}</strong>
                    <span className="memory-entry-meta">
                      {entry.timestamp} · trend: {entry.trend}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {result.causal_chain.length > 0 && (
            <section>
              <h4>Causal chain</h4>
              <ul>
                {result.causal_chain.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </section>
          )}

          {result.continuity_gaps.length > 0 && (
            <section>
              <h4>Continuity gaps</h4>
              <ul>
                {result.continuity_gaps.map((gap) => (
                  <li key={gap}>{gap}</li>
                ))}
              </ul>
            </section>
          )}

          {result.correlated_events.length > 0 && (
            <section>
              <h4>Correlated events</h4>
              <ul>
                {result.correlated_events.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          )}

          {result.current_state && (
            <section>
              <h4>Current state</h4>
              <p>{result.current_state}</p>
            </section>
          )}

          {result.confidence === "insufficient_data" && (
            <p className="memory-reconstruction-muted" role="status">
              Not enough structured events in the care journey to reconstruct this yet. Record
              observations as they happen.
            </p>
          )}
        </article>
      )}
    </section>
  );
}
