"use client";

import { useCallback, useEffect, useState } from "react";

import type { PatternIntelligenceResult } from "@/lib/pattern-intelligence";

type Props = {
  className?: string;
};

export function PatternIntelligencePanel({ className }: Props) {
  const [result, setResult] = useState<PatternIntelligenceResult | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/pattern-intelligence");
      const data = (await res.json()) as { result?: PatternIntelligenceResult };
      setResult(data.result ?? null);
    } catch {
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section
      className={`pattern-intelligence-panel${className ? ` ${className}` : ""}`}
      aria-label="Pattern and proactive intelligence"
    >
      <h3 className="pattern-intelligence-title">Patterns noticed</h3>
      <p className="pattern-intelligence-note">
        Temporal patterns across your care journey — structure detected, not medical advice.
      </p>

      {loading && <p className="pattern-intelligence-muted">Analyzing care journey…</p>}

      {!loading && result && result.proactive_signals.length > 0 && (
        <div className="pattern-proactive-block">
          <h4>Proactive signals</h4>
          <ul>
            {result.proactive_signals.map((signal) => (
              <li key={signal.id} className={`signal-${signal.output_type}`}>
                <strong>{signal.title}</strong>
                <p>{signal.message}</p>
                <span className="signal-confidence">Confidence: {signal.confidence}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!loading && result && result.patterns.length > 0 && (
        <div className="pattern-detected-block">
          <h4>Pattern detected</h4>
          <ul>
            {result.patterns.map((pattern) => (
              <li key={pattern.id}>
                <strong>{pattern.label}</strong>
                <span className="pattern-type">{pattern.pattern_type.replace(/_/g, " ")}</span>
                <p>{pattern.description}</p>
                <p className="pattern-discussion">{pattern.discussion_note}</p>
                <span className="signal-confidence">Confidence: {pattern.confidence}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!loading && result?.low_confidence_note && (
        <p className="pattern-low-confidence" role="status">
          {result.low_confidence_note}
        </p>
      )}

      {!loading &&
        result &&
        result.patterns.length === 0 &&
        result.proactive_signals.length === 0 && (
          <p className="pattern-intelligence-muted">
            No patterns detected yet. As care events accumulate, solenos will surface connections
            across time.
          </p>
        )}

      <button type="button" className="pattern-refresh-btn" onClick={() => void load()} disabled={loading}>
        Refresh patterns
      </button>
    </section>
  );
}
