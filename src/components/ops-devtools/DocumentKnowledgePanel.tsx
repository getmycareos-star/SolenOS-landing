"use client";

import { DOMAIN_LABELS } from "@/lib/universal-knowledge-extraction/classify-domain";
import type { UniversalKnowledgeLayerPayload } from "@/lib/universal-knowledge-extraction/types";

type Props = {
  knowledge: UniversalKnowledgeLayerPayload[] | null;
  className?: string;
};

export function DocumentKnowledgePanel({ knowledge, className }: Props) {
  if (!knowledge || knowledge.length === 0) return null;

  return (
    <section
      className={`document-knowledge-panel${className ? ` ${className}` : ""}`}
      aria-label="Document knowledge integrated into care journey"
    >
      <h3 className="document-knowledge-title">What was understood</h3>
      <p className="document-knowledge-note">
        Documents become structured knowledge — not files to reopen.
      </p>

      {knowledge.map((doc) => (
        <article key={doc.document_id} className="document-knowledge-card">
          <header>
            <strong>{doc.document_name}</strong>
            <span className="document-knowledge-domain">{DOMAIN_LABELS[doc.domain]}</span>
          </header>

          {doc.changes_summary.length > 0 && (
            <div className="document-knowledge-block">
              <h4>What changed</h4>
              <ul>
                {doc.changes_summary.map((change) => (
                  <li key={change}>{change}</li>
                ))}
              </ul>
            </div>
          )}

          {doc.clarity.key_facts.length > 0 && (
            <div className="document-knowledge-block">
              <h4>Key facts</h4>
              <ul>
                {doc.clarity.key_facts.slice(0, 5).map((fact) => (
                  <li key={fact}>{fact}</li>
                ))}
              </ul>
            </div>
          )}

          {doc.follow_ups.length > 0 && (
            <div className="document-knowledge-block">
              <h4>Follow-up required</h4>
              <ul>
                {doc.follow_ups.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {doc.pending_review_items > 0 && (
            <p className="document-knowledge-review" role="status">
              {doc.pending_review_items} item(s) need review before becoming permanent journey
              knowledge.
            </p>
          )}

          <p className="document-knowledge-meta">
            {doc.approved_items} facts integrated · {doc.journey_event_ids.length} journey events
            linked
          </p>
        </article>
      ))}
    </section>
  );
}
