"use client";

import { useState } from "react";
import type { SituationResponse } from "@/lib/situation-entry";
import { confidenceLevelLabel } from "@/lib/trust-provenance";

type Props = {
  layer: NonNullable<SituationResponse["trust_provenance_layer"]>;
  className?: string;
};

export function TrustProvenancePanel({ layer, className }: Props) {
  const [expandedEvidence, setExpandedEvidence] = useState<string | null>(null);

  if (
    layer.provenance_records.length === 0 &&
    layer.trust_indicators.length === 0 &&
    layer.confidence_assessment.level === "insufficient"
  ) {
    return null;
  }

  return (
    <section
      className={`situation-section trust-provenance${className ? ` ${className}` : ""}`}
      aria-label="Trust and provenance"
    >
      <h3 className="section-kicker">Trust & provenance</h3>
      <p className="panel-muted">
        Confidence: {confidenceLevelLabel(layer.confidence_assessment.level)}
      </p>

      {layer.trust_indicators.length > 0 && (
        <ul className="trust-indicators" aria-label="Trust indicators">
          {layer.trust_indicators.map((indicator) => (
            <li key={indicator.id} className={`trust-indicator trust-${indicator.kind}`}>
              {indicator.label}
            </li>
          ))}
        </ul>
      )}

      {layer.provenance_records.length > 0 && (
        <details className="provenance-records">
          <summary>Source details ({layer.provenance_records.length})</summary>
          <ul>
            {layer.provenance_records.slice(0, 5).map((record) => (
              <li key={record.fact_id} className="provenance-record">
                <strong>{record.fact_label.slice(0, 60)}</strong>
                <p className="panel-muted">
                  Source: {record.source_label}
                  {record.extracted_from ? ` — ${record.extracted_from}` : ""}
                  {" · "}
                  Captured: {record.captured_at.slice(0, 10)}
                  {" · "}
                  Confidence: {record.confidence}
                  {" · "}
                  {record.verification_status.replace(/_/g, " ")}
                </p>
              </li>
            ))}
          </ul>
        </details>
      )}

      {layer.audit_trail_summary.length > 0 && (
        <details className="audit-trail">
          <summary>Correction history ({layer.audit_trail_summary.length})</summary>
          <ul>
            {layer.audit_trail_summary.map((entry) => (
              <li key={`${entry.event_id}_${entry.changed_at}`}>
                <strong>{entry.field_label}</strong>
                {entry.original_value && entry.updated_value && (
                  <span>
                    {" "}
                    — {entry.original_value} → {entry.updated_value}
                  </span>
                )}
                <span className="panel-muted">
                  {" "}
                  (by {entry.changed_by}
                  {entry.reason ? `, ${entry.reason}` : ""})
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {layer.reasoning_chains.length > 0 && (
        <details className="reasoning-chains">
          <summary>Reasoning transparency</summary>
          {layer.reasoning_chains.map((chain, i) => (
            <div key={`chain_${i}`} className="reasoning-chain">
              {chain.question && <p className="panel-label">{chain.question}</p>}
              <ul>
                {chain.steps.map((step) => (
                  <li key={step.step}>{step.description}</li>
                ))}
              </ul>
              <p className="panel-muted">{chain.conclusion}</p>
            </div>
          ))}
        </details>
      )}

      {layer.evidence_bundles.length > 0 && (
        <div className="evidence-inspection">
          <p className="panel-label">Show evidence</p>
          <ul>
            {layer.evidence_bundles.slice(0, 5).map((bundle) => (
              <li key={bundle.insight_id}>
                <button
                  type="button"
                  className="workspace-secondary evidence-toggle"
                  onClick={() =>
                    setExpandedEvidence(
                      expandedEvidence === bundle.insight_id ? null : bundle.insight_id,
                    )
                  }
                >
                  {bundle.insight_label.slice(0, 60)}
                </button>
                {expandedEvidence === bundle.insight_id && (
                  <div className="evidence-detail">
                    {bundle.supporting_events.length > 0 && (
                      <>
                        <p className="panel-label">Supporting CareEvents</p>
                        <ul>
                          {bundle.supporting_events.map((e) => (
                            <li key={e.id}>{e.label}</li>
                          ))}
                        </ul>
                      </>
                    )}
                    {bundle.related_documents.length > 0 && (
                      <>
                        <p className="panel-label">Related documents</p>
                        <ul>
                          {bundle.related_documents.map((d) => (
                            <li key={d.id}>{d.label}</li>
                          ))}
                        </ul>
                      </>
                    )}
                    {bundle.user_corrections.length > 0 && (
                      <>
                        <p className="panel-label">User corrections</p>
                        <ul>
                          {bundle.user_corrections.map((c) => (
                            <li key={c.id}>{c.label}</li>
                          ))}
                        </ul>
                      </>
                    )}
                    {bundle.unresolved_uncertainties.length > 0 && (
                      <>
                        <p className="panel-label">Unresolved uncertainties</p>
                        <ul>
                          {bundle.unresolved_uncertainties.map((u) => (
                            <li key={u.id}>{u.label}</li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!layer.retrieval_context.sufficient_for_answer && (
        <p className="workspace-error" role="alert">
          {layer.insufficient_evidence_message}
        </p>
      )}
    </section>
  );
}
