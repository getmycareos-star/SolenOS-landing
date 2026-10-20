"use client";

import type { FinalOutputContract } from "@/lib/final-output-contract";

type Props = {
  output: FinalOutputContract;
  rawInput?: string;
  className?: string;
  /** First situation — keep decision trace collapsed. */
  firstSituation?: boolean;
};

const RISK_LABELS: Record<string, string> = {
  low: "Low structural risk",
  medium: "Medium structural risk",
  high: "High structural risk",
};

export function FinalOutputPanel({ output, rawInput, className, firstSituation }: Props) {
  return (
    <section
      className={`final-output-contract${className ? ` ${className}` : ""}`}
      aria-label="Continuity output"
    >
      {rawInput && (
        <blockquote className="situation-raw-echo">{rawInput}</blockquote>
      )}

      {output.risk_level === "high" &&
        output.confidence_state.reasoning_limits.some((l) => l.includes("Crisis mode")) && (
          <p className="panel-label crisis-mode-banner">Crisis mode — read actions below first</p>
        )}

      <section className="situation-section" aria-labelledby="happening-heading">
        <h3 id="happening-heading" className="section-kicker">
          What is happening
        </h3>
        <p>{output.what_is_happening}</p>
      </section>

      <section className="situation-section" aria-labelledby="matters-heading">
        <h3 id="matters-heading" className="section-kicker">
          What matters now
        </h3>
        <p>{output.what_matters_now}</p>
        <p className="panel-label">
          Risk: {RISK_LABELS[output.risk_level] ?? output.risk_level}
        </p>
      </section>

      <section className="situation-section" aria-labelledby="ask-heading">
        <h3 id="ask-heading" className="section-kicker">
          What to ask next
        </h3>
        <p>{output.what_to_ask_next}</p>
      </section>

      <section className="situation-section" aria-labelledby="wait-heading">
        <h3 id="wait-heading" className="section-kicker">
          What can wait
        </h3>
        <p>{output.what_can_wait}</p>
      </section>

      {output.follow_up_items.length > 0 && (
        <section className="situation-section" aria-labelledby="followup-heading">
          <h3 id="followup-heading" className="section-kicker">
            Follow-up items
          </h3>
          <ul>
            {output.follow_up_items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      )}

      <details className="decision-trace" open={firstSituation ? false : undefined}>
        <summary>Decision trace</summary>
        {output.decision_trace.events.length > 0 && (
          <>
            <p className="panel-label">Events</p>
            <ul>
              {output.decision_trace.events.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </>
        )}
        {output.decision_trace.assumptions.length > 0 && (
          <>
            <p className="panel-label">Assumptions</p>
            <ul>
              {output.decision_trace.assumptions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </>
        )}
        {output.decision_trace.unknowns.length > 0 && (
          <>
            <p className="panel-label">Unknowns</p>
            <ul>
              {output.decision_trace.unknowns.map((u) => (
                <li key={u}>{u}</li>
              ))}
            </ul>
          </>
        )}
        {output.decision_trace.evidence_sources.length > 0 && (
          <>
            <p className="panel-label">Evidence sources</p>
            <ul>
              {output.decision_trace.evidence_sources.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </>
        )}
      </details>

      {!firstSituation && (
      <section className="situation-section confidence-state" aria-labelledby="confidence-heading">
        <h3 id="confidence-heading" className="section-kicker">
          Confidence
        </h3>
        <p className="panel-muted">
          Overall: {output.confidence_state.overall_confidence} —{" "}
          {output.confidence_state.completeness >= 70
            ? "mostly complete"
            : output.confidence_state.completeness >= 40
              ? "partial"
              : "early"}
        </p>
        {output.confidence_state.reasoning_limits.length > 0 && (
          <>
            <p className="panel-label">Reasoning limits</p>
            <ul>
              {output.confidence_state.reasoning_limits.map((limit) => (
                <li key={limit}>{limit}</li>
              ))}
            </ul>
          </>
        )}
      </section>
      )}

      {!firstSituation && (
      <section className="situation-section trust-layer" aria-labelledby="trust-heading">
        <h3 id="trust-heading" className="section-kicker">
          Trust layer
        </h3>
        <p className="panel-muted">
          Trust: {output.trust_layer.recency.interpretation} — freshness{" "}
          {output.trust_layer.recency.freshness_score >= 0.7
            ? "recent"
            : output.trust_layer.recency.freshness_score >= 0.4
              ? "aging"
              : "stale"}
        </p>

        {output.trust_layer.known.length > 0 && (
          <>
            <p className="panel-label">Known</p>
            <ul>
              {output.trust_layer.known.map((k) => (
                <li key={`${k.source}-${k.statement.slice(0, 40)}`}>{k.statement}</li>
              ))}
            </ul>
          </>
        )}

        {output.trust_layer.assumed.length > 0 && (
          <>
            <p className="panel-label">Assumed</p>
            <ul>
              {output.trust_layer.assumed.map((a) => (
                <li key={a.statement.slice(0, 60)}>{a.statement}</li>
              ))}
            </ul>
          </>
        )}

        {output.trust_layer.unknown.length > 0 && (
          <>
            <p className="panel-label">Unknown</p>
            <ul>
              {output.trust_layer.unknown.map((u) => (
                <li key={u.statement.slice(0, 60)}>{u.statement}</li>
              ))}
            </ul>
          </>
        )}
      </section>
      )}
    </section>
  );
}
