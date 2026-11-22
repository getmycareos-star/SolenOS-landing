"use client";

import type { LivingCareRecordResponseView } from "@/lib/living-care-record-ux";
import { caregiverFieldLabel, caregiverInformationLabel, caregiverSafeAssistantText, caregiverSafeGeneratedText } from "@/lib/caregiver-language";
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
 * Care Record cards — never chatbot bubbles.
 */
export function LivingCareRecordPanel({
  view,
  onContinue,
  onAddUpdate,
  careKey = null,
  rawInputExcerpt = null,
}: Props) {
  const { care_event_added: event, disclosure_plan: plan } = view;
  const facts = view.what_understood.slice(0, 2)
    .map((item) => caregiverSafeGeneratedText(item))
    .filter((item): item is string => Boolean(item));
  const stillUnclear =
    plan.show_questions && view.what_needs_context.length > 0
      ? view.what_needs_context
          .map((item) => caregiverSafeGeneratedText(item))
          .filter((item): item is string => Boolean(item))
          .slice(0, plan.max_questions)
      : [];
  const recognitionLine = caregiverSafeGeneratedText(view.recognition_line);
  const confirmation = caregiverSafeGeneratedText(event.confirmation);
  const evidenceLine = caregiverSafeGeneratedText(view.evidence_line);
  const attentionLabel = caregiverSafeGeneratedText(view.attention_label);
  const mentalLoadSignal = caregiverSafeGeneratedText(view.mental_load_signal);
  const situationSummary = caregiverSafeGeneratedText(view.what_seems_happening);
  const changedSummary = caregiverSafeGeneratedText(view.what_changed_in_understanding);
  const connectionNote = caregiverSafeGeneratedText(view.connection_note);
  const mattersNow = caregiverSafeGeneratedText(view.what_matters_now);
  const canWait = caregiverSafeGeneratedText(view.what_can_wait);
  const mayBecomeSerious = caregiverSafeGeneratedText(view.what_may_become_serious);
  const trajectory = caregiverSafeGeneratedText(view.trajectory);
  const baselineSummary = caregiverSafeGeneratedText(view.baseline_summary);
  const contradictions = view.contradictions
    .map((item) => caregiverSafeGeneratedText(item))
    .filter((item): item is string => Boolean(item));
  const whyAsking = caregiverSafeGeneratedText(view.why_asking);
  const remembered =
    plan.show_remembered && view.what_will_be_remembered.length > 0
      ? view.what_will_be_remembered
          .map((item) => caregiverSafeGeneratedText(item))
          .filter((item): item is string => Boolean(item))
          .slice(0, 3)
      : [];
  const supportingEvidence =
    view.evidence_maturity >= 2 && (view.expandable.evidence?.length ?? 0) > 0
      ? (view.expandable.evidence ?? [])
          .map((item) => caregiverSafeAssistantText(item))
          .filter((item): item is string => Boolean(item))
          .slice(0, 4)
      : [];
  const followUpItems = view.follow_up_items
    .slice(0, 2)
    .map((item) => caregiverSafeGeneratedText(item))
    .filter((item): item is string => Boolean(item));
  const careStoryUpdate = caregiverSafeGeneratedText(view.care_story_update);
  const eventLabel = caregiverFieldLabel(event.event) || caregiverInformationLabel(event.event) || caregiverSafeAssistantText(event.event);
  const renderEvidenceMeta = view.has_documents && Boolean(eventLabel);
  const showMentalLoad = Boolean(mentalLoadSignal);

  return (
    <section className="living-care-record-panel" aria-label="Care Record update">
      <h2 className="workspace-headline">Care Record</h2>
      {view.recognition_line && (
        <p className="workspace-lede lcr-recognition">{recognitionLine}</p>
      )}
      {plan.show_confirmation && (
        <p className={view.recognition_line ? "panel-muted" : "workspace-lede"}>
          {confirmation || "Your update was saved."}
        </p>
      )}
      {view.evidence_line && view.evidence_maturity >= 1 && (
        <p className="panel-muted lcr-evidence-line">{evidenceLine}</p>
      )}
      {view.disclosure_plan.show_attention_level && view.attention_label && (
        <p className="panel-muted lcr-attention" aria-label="Attention level">
          {attentionLabel}
        </p>
      )}

      {showMentalLoad && (
        <p className="panel-muted lcr-mental-load" aria-label="A note about how much you are managing">
          {mentalLoadSignal}
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
              : "What we know so far"}
          </h3>
          {plan.show_situation_summary && view.what_seems_happening && (
            <p className="panel-muted" aria-label="What you shared">
              You shared: {situationSummary}
            </p>
          )}
          {facts.length > 0 && (
            <ul aria-label="Care details you shared">
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
          <p className="panel-muted">This is what SolenOS thinks may be happening. Please check if it matches what you know.</p>
          <p>{changedSummary}</p>
        </section>
      )}

      {plan.show_connection && view.connection_note && (
        <section className="care-card-changed" aria-labelledby="lcr-connect-heading">
          <h3 id="lcr-connect-heading" className="section-kicker">
            What may matter
          </h3>
          <p className="panel-muted">This may be connected. It still needs checking.</p>
          <p>{connectionNote}</p>
        </section>
      )}

      {showMatters && (
        <section className="care-card-matters" aria-labelledby="lcr-matters-heading">
          <h3 id="lcr-matters-heading" className="section-kicker">
            What to watch
          </h3>
          <dl className="lcr-pillars">
            {view.what_matters_now && (
              <div>
                <dt>Most important now</dt>
                <dd>{mattersNow}</dd>
              </div>
            )}
            {view.what_can_wait && (
              <div>
                <dt>Can wait</dt>
                <dd>{canWait}</dd>
              </div>
            )}
            {view.what_may_become_serious && (
              <div>
                <dt>May need attention later</dt>
                <dd>{mayBecomeSerious}</dd>
              </div>
            )}
            {view.trajectory && (
              <div>
                <dt>How things seem to be changing</dt>
                <dd>{trajectory}</dd>
              </div>
            )}
          </dl>
        </section>
      )}

      {view.baseline_summary && (
        <section className="care-card-baseline" aria-labelledby="lcr-baseline-heading">
          <h3 id="lcr-baseline-heading" className="section-kicker">
            What is usual
          </h3>
          <p className="panel-muted">Based on earlier care updates.</p>
          <p>{baselineSummary}</p>
        </section>
      )}

      {contradictions.length > 0 && (
        <section className="care-card-contradictions" aria-labelledby="lcr-conflict-heading">
          <h3 id="lcr-conflict-heading" className="section-kicker">
            Information that does not match
          </h3>
          <p className="panel-muted">We’ve kept both versions because they do not match yet.</p>
          <ul>
            {contradictions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      )}

      {stillUnclear.length > 0 && (
        <section className="care-card-unknowns" aria-labelledby="lcr-unclear-heading">
          <h3 id="lcr-unclear-heading" className="section-kicker">
            Questions that may help
          </h3>
          <p className="panel-muted">Some details are missing. You can skip these questions if you do not know.</p>
          <ul>
            {stillUnclear.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          {whyAsking && (
            <details className="lcr-expandable lcr-why-asking">
              <summary className="panel-muted">Why these questions?</summary>
              <p className="panel-muted">{whyAsking}</p>
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
            What will be kept in your Care Record
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
          <summary className="panel-muted">Notes and documents behind this summary</summary>
          <ul aria-label="Notes and documents behind this information">
            {supportingEvidence.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </details>
      )}

      {followUpItems.length > 0 && (
        <section className="care-card-actions" aria-labelledby="lcr-actions-heading">
          <h3 id="lcr-actions-heading" className="section-kicker">
            What you can do next
          </h3>
          <p className="panel-muted">These are suggestions. Choose what works for you.</p>
          <ul>
            {followUpItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      )}

      {careStoryUpdate && (
        <p className="panel-muted lcr-care-story">{careStoryUpdate}</p>
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
