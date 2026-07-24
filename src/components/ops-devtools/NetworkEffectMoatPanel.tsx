"use client";

import type { SituationResponse } from "@/lib/situation-entry";

type Props = {
  layer: NonNullable<SituationResponse["network_effect_moat_layer"]>;
  className?: string;
};

const OUTCOME_LABELS: Record<string, string> = {
  new_care_event: "New CareEvent",
  refined_care_event: "Refined existing event",
  resolved_uncertainty: "Resolved uncertainty",
  new_relationship: "New relationship",
  corrected_fact: "Corrected fact",
  completed_follow_up: "Completed follow-up",
  new_entity: "New entity",
  updated_timeline: "Updated timeline",
};

const MOAT_LEVEL_LABELS: Record<string, string> = {
  emerging: "Emerging continuity",
  growing: "Growing context",
  strong: "Strong moat",
  irreplaceable: "Irreplaceable continuity",
};

export function NetworkEffectMoatPanel({ layer, className }: Props) {
  if (!layer.context_grew && layer.compounding_metrics.total_events === 0) {
    return null;
  }

  return (
    <section
      className={`situation-section network-effect-moat${className ? ` ${className}` : ""}`}
      aria-label="Continuity compounding"
    >
      <h3 className="section-kicker">Continuity compounding</h3>
      <p className="panel-muted maturity-message">{layer.maturity_message}</p>
      <p className="panel-label">
        {MOAT_LEVEL_LABELS[layer.moat_strength.level] ?? layer.moat_strength.level}
        {" — "}
        {layer.moat_strength.reason}
      </p>

      {layer.interaction_outcomes.length > 0 && (
        <ul className="interaction-outcomes" aria-label="What this interaction added">
          {layer.interaction_outcomes.slice(0, 6).map((outcome, i) => (
            <li key={`${outcome.outcome_type}_${i}`}>
              <span className="extracted-type">
                {OUTCOME_LABELS[outcome.outcome_type] ?? outcome.outcome_type}
              </span>
              {" — "}
              {outcome.description}
            </li>
          ))}
        </ul>
      )}

      {layer.resolved_uncertainties.length > 0 && (
        <details className="resolved-uncertainties">
          <summary>
            Resolved uncertainties ({layer.resolved_uncertainties.length})
          </summary>
          <ul>
            {layer.resolved_uncertainties.map((r) => (
              <li key={r.id}>
                <strong>{r.question}</strong>
                <span className="panel-muted"> → {r.resolution}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {layer.enrichment_actions.length > 0 && (
        <details className="enrichment-actions">
          <summary>Context enrichment ({layer.enrichment_actions.length})</summary>
          <ul>
            {layer.enrichment_actions.slice(0, 5).map((a) => (
              <li key={a.id}>{a.description}</li>
            ))}
          </ul>
        </details>
      )}

      <dl className="compounding-metrics">
        <div>
          <dt>Events</dt>
          <dd>{layer.compounding_metrics.total_events}</dd>
        </div>
        <div>
          <dt>Relationships</dt>
          <dd>{layer.compounding_metrics.total_relationships}</dd>
        </div>
        <div>
          <dt>Entities</dt>
          <dd>{layer.compounding_metrics.total_entities}</dd>
        </div>
        <div>
          <dt>Corrections</dt>
          <dd>{layer.compounding_metrics.correction_count}</dd>
        </div>
        <div>
          <dt>Days of continuity</dt>
          <dd>{layer.compounding_metrics.days_of_continuity}</dd>
        </div>
      </dl>

      {layer.isolated_records > 0 && (
        <p className="panel-muted" role="status">
          {layer.isolated_records} record(s) pending linkage to existing context.
        </p>
      )}
    </section>
  );
}
