"use client";

import type { LivingCareRecordResponseView } from "@/lib/living-care-record-ux";
import { caregiverFieldLabel, caregiverInformationLabel, caregiverSourceText, caregiverSafeGeneratedText } from "@/lib/caregiver-language";
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
  const factCandidates = view.what_understood.slice(0, 2);
  const facts = factCandidates
    .map((item) => caregiverSafeGeneratedText(item))
    .filter((item): item is string => Boolean(item));
  const questionCandidates =
    plan.show_questions ? view.what_needs_context.slice(0, plan.max_questions) : [];
  const stillUnclear = questionCandidates
    .map((item) => caregiverSafeGeneratedText(item))
    .filter((item): item is string => Boolean(item));
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
  const rememberedCandidates =
    plan.show_remembered ? view.what_will_be_remembered.slice(0, 3) : [];
  const remembered = rememberedCandidates
    .map((item) => caregiverSafeGeneratedText(item))
    .filter((item): item is string => Boolean(item));
  const supportingEvidenceCandidates =
    view.evidence_maturity >= 2 ? (view.expandable.evidence ?? []).slice(0, 4) : [];
  const supportingEvidence = supportingEvidenceCandidates
    .map((item) => caregiverSourceText(item))
    .filter((item): item is string => Boolean(item));
  const followUpCandidates = view.follow_up_items.slice(0, 2);
  const followUpItems = followUpCandidates
    .map((item) => caregiverSafeGeneratedText(item))
    .filter((item): item is string => Boolean(item));
  const careStoryUpdate = caregiverSafeGeneratedText(view.care_story_update);
  const eventLabel = caregiverFieldLabel(event.event) || caregiverInformationLabel(event.event) || "Care update";
  const mattersCandidateCount = [
    view.what_matters_now, view.what_can_wait, view.what_may_become_serious, view.trajectory,
  ].filter(Boolean).length;
  const mattersVisibleCount = [mattersNow, canWait, mayBecomeSerious, trajectory].filter(Boolean).length;
  const showMatters = plan.show_what_matters_now && mattersCandidateCount > 0;
  const showChanged =
    plan.show_what_changed &&
    Boolean(view.what_changed_in_understanding) &&
    view.observation_count > 1;
  const showKnow =
    plan.show_current_understanding &&
    (Boolean(view.what_seems_happening) || factCandidates.length > 0);
  const renderEvidenceMeta = view.has_documents && Boolean(eventLabel);

  return (
    <section className="living-care-record-panel" aria-label="Care Record update">
      <h2 className="workspace-headline">Care Record</h2>
      {view.recognition_line && (
        <p className="workspace-lede lcr-recognition">{recognitionLine || "Some wording in this update could not be shown clearly. Your saved information has not changed."}</p>
      )}
      {plan.show_confirmation && (
        <p className={recognitionLine ? "panel-muted" : "workspace-lede"}>
          {confirmation || "Your update was saved."}
        </p>
      )}
      {view.evidence_line && view.evidence_maturity >= 1 && (
        <p className="panel-muted lcr-evidence-line">{evidenceLine || "The saved notes and documents are available, but their wording could not be shown clearly here."}</p>
      )}
      {view.disclosure_plan.show_attention_level && view.attention_label && (
        <p className="panel-muted lcr-attention" aria-label="Attention level">
          {attentionLabel || "The level of attention could not be explained clearly here."}
        </p>
      )}

      {view.mental_load_signal && (
        <p className="panel-muted lcr-mental-load" aria-label="A note about how much you are managing">
          {mentalLoadSignal || "A note about how much you are managing could not be shown clearly."}
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
              {situationSummary ? "You shared: " + situationSummary : "The summary could not be shown clearly. Your saved care information remains available in the Care Record."}
            </p>
          )}
          {facts.length > 0 && (
            <ul aria-label="Care details you shared">
              {facts.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
          {factCandidates.length > facts.length && (
            <p className="panel-muted">Some details could not be shown clearly. The saved information remains in your Care Record.</p>
          )}
          {renderEvidenceMeta && (
            <p className="panel-muted">
              {eventLabel || "Care update"}
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
          <p>{changedSummary || "The explanation of this change could not be shown clearly. Check the saved care updates before drawing a conclusion."}</p>
        </section>
      )}

      {plan.show_connection && view.connection_note && (
        <section className="care-card-changed" aria-labelledby="lcr-connect-heading">
          <h3 id="lcr-connect-heading" className="section-kicker">
            What may matter
          </h3>
          <p className="panel-muted">This may be connected. It still needs checking.</p>
          <p>{connectionNote || "The possible connection could not be explained clearly. It still needs checking."}</p>
        </section>
      )}

      {showMatters && (
        <section className="care-card-matters" aria-labelledby="lcr-matters-heading">
          <h3 id="lcr-matters-heading" className="section-kicker">
            What to watch
          </h3>
          <dl className="lcr-pillars">
            {mattersNow && (
              <div>
                <dt>Most important now</dt>
                <dd>{mattersNow}</dd>
              </div>
            )}
            {canWait && (
              <div>
                <dt>Can wait</dt>
                <dd>{canWait}</dd>
              </div>
            )}
            {mayBecomeSerious && (
              <div>
                <dt>May need attention later</dt>
                <dd>{mayBecomeSerious}</dd>
              </div>
            )}
            {trajectory && (
              <div>
                <dt>How things seem to be changing</dt>
                <dd>{trajectory}</dd>
              </div>
            )}
          </dl>
          {mattersCandidateCount > mattersVisibleCount && (
            <p className="panel-muted">Some suggested details could not be explained clearly. Check the saved care updates before relying on them.</p>
          )}
        </section>
      )}

      {view.baseline_summary && (
        <section className="care-card-baseline" aria-labelledby="lcr-baseline-heading">
          <h3 id="lcr-baseline-heading" className="section-kicker">
            What is usual
          </h3>
          <p className="panel-muted">Based on earlier care updates.</p>
          <p>{baselineSummary || "The earlier care summary could not be shown clearly. The saved care updates remain available."}</p>
        </section>
      )}

      {view.contradictions.length > 0 && (
        <section className="care-card-contradictions" aria-labelledby="lcr-conflict-heading">
          <h3 id="lcr-conflict-heading" className="section-kicker">
            Information that does not match
          </h3>
          <p className="panel-muted">We’ve kept both versions because they do not match yet.</p>
          {contradictions.length > 0 ? (
            <ul>
              {contradictions.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="panel-muted">We could not show the explanation clearly. Check the original notes before drawing a conclusion.</p>
          )}
          {contradictions.length > 0 && view.contradictions.length > contradictions.length && (
            <p className="panel-muted">Some other reports that do not match could not be shown clearly. Check the original notes before drawing a conclusion.</p>
          )}
        </section>
      )}

      {plan.show_questions && view.what_needs_context.length > 0 && (
        <section className="care-card-unknowns" aria-labelledby="lcr-unclear-heading">
          <h3 id="lcr-unclear-heading" className="section-kicker">
            Questions that may help
          </h3>
          <p className="panel-muted">Some details are missing. You can skip these questions if you do not know.</p>
          {stillUnclear.length > 0 ? (
            <ul>
              {stillUnclear.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="panel-muted">Some questions are saved, but their wording could not be shown clearly. You can review the original care information instead.</p>
          )}
          {stillUnclear.length > 0 && questionCandidates.length > stillUnclear.length && (
            <p className="panel-muted">Some other questions could not be shown clearly. You can review the original care information instead.</p>
          )}
          {view.why_asking && (
            <details className="lcr-expandable lcr-why-asking">
              <summary className="panel-muted">Why these questions?</summary>
              <p className="panel-muted">{whyAsking || "The reason for these questions could not be explained clearly. You can skip questions you do not know."}</p>
            </details>
          )}
        </section>
      )}

      {plan.show_remembered && view.what_will_be_remembered.length > 0 && (
        <section
          className="care-card-remembered"
          aria-labelledby="lcr-remembered-heading"
        >
          <h3 id="lcr-remembered-heading" className="section-kicker">
            What will be kept in your Care Record
          </h3>
          {remembered.length > 0 ? (
            <ul>
              {remembered.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="panel-muted">Some details could not be shown clearly. Nothing has been removed from your Care Record.</p>
          )}
          {remembered.length > 0 && rememberedCandidates.length > remembered.length && (
            <p className="panel-muted">Some other details could not be shown clearly. Nothing has been removed from your Care Record.</p>
          )}
        </section>
      )}

      {supportingEvidenceCandidates.length > 0 && (
        <details className="lcr-expandable">
          <summary className="panel-muted">Notes and documents behind this summary</summary>
          {supportingEvidence.length > 0 ? (
            <ul aria-label="Notes and documents behind this information">
              {supportingEvidence.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="panel-muted">The saved notes and documents are available, but their wording could not be shown clearly here.</p>
          )}
          {supportingEvidence.length > 0 && supportingEvidenceCandidates.length > supportingEvidence.length && (
            <p className="panel-muted">Some other notes or documents could not be shown clearly.</p>
          )}
        </details>
      )}

      {view.follow_up_items.length > 0 && (
        <section className="care-card-actions" aria-labelledby="lcr-actions-heading">
          <h3 id="lcr-actions-heading" className="section-kicker">
            What you can do next
          </h3>
          <p className="panel-muted">These are suggestions. Choose what works for you.</p>
          {followUpItems.length > 0 ? (
            <ul>
              {followUpItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="panel-muted">Suggested next steps could not be shown clearly. Your saved care information has not changed.</p>
          )}
          {followUpItems.length > 0 && followUpCandidates.length > followUpItems.length && (
            <p className="panel-muted">Some other suggestions could not be shown clearly. Your saved care information has not changed.</p>
          )}
        </section>
      )}

      {view.care_story_update && (
        <p className="panel-muted lcr-care-story">{careStoryUpdate || "The care history update could not be shown clearly. Your saved information has not changed."}</p>
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
