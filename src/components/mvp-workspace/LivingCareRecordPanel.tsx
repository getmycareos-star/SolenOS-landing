"use client";

import type { LivingCareRecordResponseView } from "@/lib/living-care-record-ux";
import { UnderstandingFeedbackPrompt } from "./UnderstandingFeedbackPrompt";

type Props = {
  view: LivingCareRecordResponseView;
  onContinue?: () => void;
  onAddUpdate?: () => void;
  /** Durable care key — required for research feedback persistence. */
  careKey?: string | null;
  rawInputExcerpt?: string | null;
};

/**
 * Sole caregiver surface for a turn — ADR-019 + Visual Language.
 * Living Care Record cards — never chatbot bubbles.
 */
export function LivingCareRecordPanel({
  view,
  onContinue,
  onAddUpdate,
  careKey = null,
  rawInputExcerpt = null,
}: Props) {
  const { care_event_added: event, disclosure_plan: plan } = view;
  const facts = view.what_understood.slice(0, 2);
  const stillUnclear =
    plan.show_questions && view.what_needs_context.length > 0
      ? view.what_needs_context.slice(0, plan.max_questions)
      : [];
  const showMatters =
    plan.show_what_matters_now &&
    Boolean(view.what_matters_now || view.what_can_wait || view.what_may_become_serious);
  const showChanged =
    plan.show_what_changed &&
    Boolean(view.what_changed_in_understanding) &&
    view.observation_count > 1;
  const showKnow =
    plan.show_current_understanding &&
    (Boolean(view.what_seems_happening) || facts.length > 0);
  const remembered =
    plan.show_remembered && view.what_will_be_remembered.length > 0
      ? view.what_will_be_remembered.slice(0, 3)
      : [];
  const supportingEvidence =
    view.evidence_maturity >= 2 && (view.expandable.evidence?.length ?? 0) > 0
      ? (view.expandable.evidence ?? []).slice(0, 4)
      : [];
  const renderEvidenceMeta = view.has_documents && Boolean(event.event);

  return (
    <section className="living-care-record-panel" aria-label="Living Care Record update">
      <h2 className="workspace-headline">Living Care Record</h2>
      {view.recognition_line && (
        <p className="workspace-lede lcr-recognition">{view.recognition_line}</p>
      )}
      {plan.show_confirmation && (
        <p className={view.recognition_line ? "panel-muted" : "workspace-lede"}>
          {event.confirmation}
        </p>
      )}
      {view.evidence_line && view.evidence_maturity >= 1 && (
        <p className="panel-muted lcr-evidence-line">{view.evidence_line}</p>
      )}
      {view.disclosure_plan.show_attention_level && view.attention_label && (
        <p className="panel-muted lcr-attention" aria-label="Attention from what is held">
          {view.attention_label}
        </p>
      )}

      {showKnow && (
        <section
          className="care-card-understanding"
          aria-labelledby="lcr-know-heading"
        >
          <h3 id="lcr-know-heading" className="section-kicker">
            {view.show_attention_sections
              ? "What is happening"
              : "What is understood about this situation"}
          </h3>
          {plan.show_situation_summary && view.what_seems_happening && (
            <p>{view.what_seems_happening}</p>
          )}
          {facts.length > 0 && (
            <ul>
              {facts.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
          {renderEvidenceMeta && (
            <p className="panel-muted">
              {event.event}
              {event.date ? ` · ${event.date}` : ""}
            </p>
          )}
        </section>
      )}

      {showChanged && (
        <section className="care-card-changed" aria-labelledby="lcr-delta-heading">
          <h3 id="lcr-delta-heading" className="section-kicker">
            What changed
          </h3>
          <p>{view.what_changed_in_understanding}</p>
        </section>
      )}

      {plan.show_connection && view.connection_note && (
        <section className="care-card-changed" aria-labelledby="lcr-connect-heading">
          <h3 id="lcr-connect-heading" className="section-kicker">
            How this connects
          </h3>
          <p>{view.connection_note}</p>
        </section>
      )}

      {showMatters && (
        <section className="care-card-matters" aria-labelledby="lcr-matters-heading">
          <h3 id="lcr-matters-heading" className="section-kicker">
            What matters
          </h3>
          <dl className="lcr-pillars">
            {view.what_matters_now && (
              <div>
                <dt>What matters now</dt>
                <dd>{view.what_matters_now}</dd>
              </div>
            )}
            {view.what_can_wait && (
              <div>
                <dt>What can wait</dt>
                <dd>{view.what_can_wait}</dd>
              </div>
            )}
            {view.what_may_become_serious && (
              <div>
                <dt>What may become serious</dt>
                <dd>{view.what_may_become_serious}</dd>
              </div>
            )}
          </dl>
        </section>
      )}

      {stillUnclear.length > 0 && (
        <section className="care-card-unknowns" aria-labelledby="lcr-unclear-heading">
          <h3 id="lcr-unclear-heading" className="section-kicker">
            Still unclear
          </h3>
          <p className="panel-muted">Optional — skip if you do not know.</p>
          <ul>
            {stillUnclear.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          {view.why_asking && (
            <details className="lcr-expandable lcr-why-asking">
              <summary className="panel-muted">Why these questions?</summary>
              <p className="panel-muted">{view.why_asking}</p>
            </details>
          )}
        </section>
      )}

      {remembered.length > 0 && (
        <section
          className="care-card-remembered"
          aria-labelledby="lcr-remembered-heading"
        >
          <h3 id="lcr-remembered-heading" className="section-kicker">
            What will be remembered
          </h3>
          <ul>
            {remembered.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      )}

      {supportingEvidence.length > 0 && (
        <details className="lcr-expandable">
          <summary className="panel-muted">What supports this understanding</summary>
          <ul>
            {supportingEvidence.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </details>
      )}

      {view.follow_up_items.length > 0 && (
        <p className="panel-muted lcr-follow-hint">
          Also worth adding when you can: {view.follow_up_items.slice(0, 2).join(" · ")}
        </p>
      )}

      {view.care_story_update && (
        <p className="panel-muted lcr-care-story">{view.care_story_update}</p>
      )}

      {careKey?.trim() && (
        <UnderstandingFeedbackPrompt
          careKey={careKey.trim()}
          situationId={view.care_reality_state_id}
          rawInputExcerpt={rawInputExcerpt ?? view.original_input}
        />
      )}

      <div className="situation-actions">
        {onAddUpdate && (
          <button type="button" className="workspace-secondary" onClick={onAddUpdate}>
            Tell us what happened
          </button>
        )}
        {onContinue && (
          <button type="button" className="workspace-primary" onClick={onContinue}>
            Done for now
          </button>
        )}
      </div>
    </section>
  );
}
