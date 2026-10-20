"use client";

import type { SituationResponse } from "@/lib/situation-entry";
import { recoveryActionLabel, type RecoveryAction } from "@/lib/failure-resilience";

type Props = {
  layer: NonNullable<SituationResponse["failure_resilience_layer"]>;
  onRetry?: () => void;
  className?: string;
};

const CATEGORY_LABELS: Record<string, string> = {
  extraction_failure: "Extraction incomplete",
  incomplete_context: "Incomplete context",
  ambiguous_interpretation: "Ambiguous interpretation",
  graph_linking_failure: "Relationship unresolved",
  conflicting_information: "Conflicting information",
  processing_failure: "Processing pending",
};

const STATUS_LABELS: Record<string, string> = {
  complete: "Complete",
  partial: "Partial — review recommended",
  pending: "Pending retry",
  deferred: "Deferred",
  failed_recoverable: "Retry available",
};

export function FailureResiliencePanel({ layer, onRetry, className }: Props) {
  if (layer.failures.length === 0 && layer.processing_status === "complete") {
    return null;
  }

  return (
    <section
      className={`situation-section failure-resilience${className ? ` ${className}` : ""}`}
      aria-label="Failure handling and recovery"
    >
      <h3 className="section-kicker">Resilience & recovery</h3>
      <p className="panel-muted">
        Status: {STATUS_LABELS[layer.processing_status] ?? layer.processing_status}
        {layer.continuity_preserved && " — your input is preserved."}
      </p>

      {layer.failures.length > 0 && (
        <ul className="failure-records">
          {layer.failures.slice(0, 5).map((f) => (
            <li key={f.id} className={`failure-record failure-${f.category}`}>
              <strong>{CATEGORY_LABELS[f.category] ?? f.category}</strong>
              <span className="failure-outcome"> ({f.outcome.replace(/_/g, " ")})</span>
              <p>{f.message}</p>
              {f.extracted_partial.length > 0 && (
                <p className="panel-label">
                  Extracted: {f.extracted_partial.join("; ")}
                </p>
              )}
              {f.not_understood.length > 0 && (
                <p className="panel-label">
                  Not understood: {f.not_understood.join("; ")}
                </p>
              )}
              {f.clarification_questions.length > 0 && (
                <ul>
                  {f.clarification_questions.map((q) => (
                    <li key={q}>{q}</li>
                  ))}
                </ul>
              )}
              {f.possible_interpretations.length > 1 && (
                <>
                  <p className="panel-label">Possible interpretations:</p>
                  <ul>
                    {f.possible_interpretations.map((opt) => (
                      <li key={opt}>{opt}</li>
                    ))}
                  </ul>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {layer.confidence_summaries.length > 0 && (
        <details className="confidence-summaries">
          <summary>Confidence details ({layer.confidence_summaries.length})</summary>
          <ul>
            {layer.confidence_summaries.slice(0, 5).map((c) => (
              <li key={c.object_id}>
                <span className="extracted-type">{c.confidence_level}</span>
                {" — "}
                {c.uncertainty_reason}
                {c.unknown_facts.length > 0 && (
                  <span className="panel-muted"> — unknown: {c.unknown_facts.join(", ")}</span>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}

      {layer.pending_processing.length > 0 && (
        <p className="panel-muted" role="status">
          {layer.pending_processing.length} submission
          {layer.pending_processing.length === 1 ? "" : "s"} queued for automatic retry.
        </p>
      )}

      {layer.recovery_actions.length > 0 && (
        <div className="failure-recovery-actions">
          <p className="panel-label">You can:</p>
          <ul>
            {layer.recovery_actions.map((action) => (
              <li key={action}>
                {recoveryActionLabel(action as RecoveryAction)}
              </li>
            ))}
          </ul>
          {onRetry && layer.recovery_actions.includes("retry_processing") && (
            <button type="button" className="workspace-secondary" onClick={onRetry}>
              Retry processing
            </button>
          )}
        </div>
      )}
    </section>
  );
}
