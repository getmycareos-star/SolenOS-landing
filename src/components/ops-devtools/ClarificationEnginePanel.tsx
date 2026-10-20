"use client";

import type { ClarificationEngineResult } from "@/lib/clarification-engine";

type Props = {
  layer: ClarificationEngineResult;
};

export function ClarificationEnginePanel({ layer }: Props) {
  if (!layer.triggered) return null;

  return (
    <div className="clarification-engine-panel">
      <h4>Clarification engine</h4>
      <p className="panel-muted">{layer.defining_principle}</p>
      <p>
        Uncertainty: {layer.uncertainty_level} — confidence {layer.confidence_before_pct}% →
        estimated {layer.confidence_after_estimated_pct}% after clarification
      </p>
      <p>
        Budget: {layer.budget_used} / {layer.budget_max} questions
      </p>
      {layer.explain_why.length > 0 && (
        <section>
          <h5>Why we&apos;re asking</h5>
          <ul>
            {layer.explain_why.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      )}
      {layer.questions.length > 0 && (
        <section>
          <h5>High-value questions</h5>
          <ol>
            {layer.questions.map((q) => (
              <li key={q.id}>
                {q.question}
                <span className="panel-muted"> — {q.rationale}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
