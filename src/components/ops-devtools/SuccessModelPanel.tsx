"use client";

import type { SituationResponse } from "@/lib/situation-entry";

type Props = {
  layer: NonNullable<SituationResponse["success_model_layer"]>;
  className?: string;
};

const PRIMARY_LABELS: Record<string, string> = {
  cognitive_load_reduction: "Cognitive load reduction",
  continuity_restoration: "Continuity restoration",
  meeting_preparation_efficiency: "Meeting preparation",
  follow_up_reliability: "Follow-up reliability",
  recall_accuracy: "Recall accuracy",
};

const LEVEL_LABELS: Record<string, string> = {
  strong: "Strong",
  moderate: "Moderate",
  weak: "Developing",
  insufficient: "Insufficient data",
};

export function SuccessModelPanel({ layer, className }: Props) {
  return (
    <section
      className={`situation-section success-model${className ? ` ${className}` : ""}`}
      aria-label="Outcome success metrics"
    >
      <h3 className="section-kicker">Outcome success</h3>
      <p className="panel-muted">{layer.outcome_summary}</p>
      <p className="panel-label">
        Overall: {layer.overall_success_score}/100 —{" "}
        {LEVEL_LABELS[layer.overall_level] ?? layer.overall_level}
      </p>

      <dl className="primary-success-metrics">
        {Object.entries(layer.primary).map(([key, metric]) => (
          <div key={key}>
            <dt>{PRIMARY_LABELS[key] ?? key.replace(/_/g, " ")}</dt>
            <dd>
              {metric.score}/100 ({LEVEL_LABELS[metric.level]})
              {metric.signals.length > 0 && (
                <ul className="metric-signals">
                  {metric.signals.slice(0, 2).map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              )}
            </dd>
          </div>
        ))}
      </dl>

      {layer.recall_probes.some((p) => p.answered) && (
        <details className="recall-probes">
          <summary>Recall from continuity</summary>
          <ul>
            {layer.recall_probes.map((probe) => (
              <li key={probe.question}>
                <strong>{probe.question}</strong>
                {probe.answered ? (
                  <span className="panel-muted"> — answered from Care Context</span>
                ) : (
                  <span className="panel-muted"> — insufficient evidence</span>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}

      <p className="panel-muted activity-excluded">
        Not measured: {layer.activity_metrics_excluded.join(", ").replace(/_/g, " ")}
      </p>
    </section>
  );
}
