"use client";

import type { RiskUncertaintyLayerPayload } from "@/lib/risk-uncertainty-engine";

type Props = {
  layer: RiskUncertaintyLayerPayload | null;
};

export function RiskUncertaintyPanel({ layer }: Props) {
  if (!layer) return null;

  const { output } = layer;

  return (
    <section className="clarity-section risk-uncertainty" aria-label="Risk and uncertainty assessment">
      <h2 className="section-kicker">Information check</h2>

      <dl className="risk-uncertainty-dl">
        <dt>Completeness</dt>
        <dd>{output.information_completeness.replace(/_/g, " ")}</dd>

        <dt>Confidence</dt>
        <dd>{output.confidence_level}</dd>

        <dt>Priority</dt>
        <dd className={output.priority_assessment === "Unable to Determine" ? "priority-undetermined" : ""}>
          {output.priority_assessment}
        </dd>
      </dl>

      {output.missing_information.length > 0 && (
        <div className="risk-uncertainty-missing">
          <h3>Missing information</h3>
          <ul>
            {output.missing_information.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {output.clarifying_questions.length > 0 && (
        <div className="risk-uncertainty-questions">
          <h3>Clarifying questions</h3>
          <ul>
            {output.clarifying_questions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </div>
      )}

      {output.decision_gate_blocked && (
        <p className="risk-uncertainty-blocked" role="status">
          Priority cannot be assigned until required safety context is provided.
        </p>
      )}
    </section>
  );
}
