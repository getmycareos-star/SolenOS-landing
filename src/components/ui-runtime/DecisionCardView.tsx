import type { DecisionCard, DecisionRiskLevel } from "@/lib/ui-runtime";
import type { TrustLayerPayload } from "@/lib/trust-disclaimer-footer";

const RISK_CLASS: Record<DecisionRiskLevel, string> = {
  LOW: "risk-low",
  MEDIUM: "risk-medium",
  HIGH: "risk-high",
};

interface DecisionCardViewProps {
  card: DecisionCard;
  trustLayer?: TrustLayerPayload;
  onUndoRecommendation?: () => void;
  onIgnoreRecommendation?: () => void;
  onChooseAlternative?: (alternativeId: string) => void;
}

/** Sole live decision card — never stacked; parent replaces on new inference. */
export function DecisionCardView({
  card,
  trustLayer,
  onUndoRecommendation,
  onIgnoreRecommendation,
  onChooseAlternative,
}: DecisionCardViewProps) {
  const explanation = card.explanation;
  const reversibility = card.reversibility;

  return (
    <article className="decision-card" data-situation-id={card.situationId}>
      {trustLayer?.disclaimers && trustLayer.disclaimers.length > 0 && (
        <aside className="trust-disclaimers" aria-label="Domain safety disclaimers">
          {trustLayer.disclaimers.map((disclaimer) => (
            <p key={disclaimer.domain} className="trust-disclaimer">
              {disclaimer.text}
            </p>
          ))}
        </aside>
      )}

      {card.attentionPriority ? (
        <div
          className="output-block attention-priority"
          data-attention-class={card.attentionClass ?? undefined}
          data-attention-priority={card.attentionPriority}
        >
          <h2>Attention</h2>
          <p className={`attention-badge attention-${card.attentionPriority.toLowerCase()}`}>
            {card.attentionPriority === "Now"
              ? "Now"
              : card.attentionPriority === "Watch"
                ? "Watch"
                : "Later"}
            {card.attentionLabel ? ` — ${card.attentionLabel}` : ""}
          </p>
        </div>
      ) : null}

      <div className="output-block">
        <h2>What is happening</h2>
        <p>{card.whatIsHappening}</p>
      </div>

      <div
        className={`output-block${card.riskLevel === "HIGH" ? " urgency-high" : ""}`}
      >
        <h2>What matters now</h2>
        <p>{card.whatMattersNow}</p>
        {card.confidenceExplanation ? (
          <p className="confidence-reassurance" data-confidence-layer="true">
            {card.confidenceExplanation}
          </p>
        ) : null}
        {card.emotionalValidation?.normalizeExperience ? (
          <p
            className="emotional-validation"
            data-emotional-validation="true"
          >
            {card.emotionalValidation.message}
          </p>
        ) : null}
        {card.containmentMode ? (
          <p className="containment-mode-hint" data-containment-mode="true">
            One simple next step is enough for now.
          </p>
        ) : null}
      </div>

      <div className="output-block">
        <h2>What helps now</h2>
        <p>{card.nextBestAction}</p>
        {card.owner ? (
          <p className="decision-owner" data-ownership={card.ownershipState ?? undefined}>
            Owner: {card.owner}
            {card.ownershipState && card.ownershipState !== "assigned"
              ? ` (${card.ownershipState})`
              : ""}
          </p>
        ) : card.ownershipState === "unassigned" ? (
          <p className="decision-owner decision-owner-unassigned">Owner: Unassigned</p>
        ) : null}
      </div>

      {card.topDemands && card.topDemands.length > 0 && (
        <div className="output-block" data-demand-surface="true">
              <h2>Needs attention</h2>
          <ol className="demand-priority-list">
            {card.topDemands.map((d) => (
              <li key={d.id}>
                <strong>{d.title}</strong>
                {d.ownerName ? (
                  <span className="demand-owner"> · Owner: {d.ownerName}</span>
                ) : (
                  <span className="demand-owner demand-owner-unassigned">
                    {" "}
                    · Owner: Unassigned
                  </span>
                )}
                {card.topDemands!.length === 1 ? (
                  <p>{d.description}</p>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      )}

      {card.crisisWarnings && card.crisisWarnings.length > 0 && (
        <div className="output-block crisis-prevention-hint" data-crisis-prevention="true">
          <h2>Looking ahead</h2>
          <ul className="crisis-warning-list">
            {card.crisisWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {card.delegationSuggestions && card.delegationSuggestions.length > 0 && (
        <div className="output-block delegation-hint" data-delegation-layer="true">
          <h2>Could be handled by someone else</h2>
          <ul>
            {card.delegationSuggestions.map((s) => (
              <li key={`${s.task}-${s.recommendedPerson}`}>
                <strong>{s.task}</strong> could be handled by {s.recommendedPerson}. {s.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {explanation && (
        <div
          className="output-block human-trust-explanation"
          data-human-trust="true"
          data-emotional-readability={
            card.humanTrustEmotionalReadabilityApplied ? "true" : "false"
          }
        >
          <h2>Why this was chosen</h2>
          <p>{explanation.whyThisWasChosen}</p>
          <h3>What was ignored</h3>
          {explanation.whatWasIgnored.length === 1 ? (
            <p>{explanation.whatWasIgnored[0]}</p>
          ) : (
            <ul>
              {explanation.whatWasIgnored.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
          <h3>Risk if ignored</h3>
          <p>{explanation.riskIfIgnored}</p>
        </div>
      )}

      {reversibility && (
        <div
          className="output-block human-trust-reversibility"
          data-reversibility="true"
          role="group"
          aria-label="Change or undo this recommendation"
        >
          <h2>Your choice</h2>
          <p className="reversibility-hint">
            You can undo this recommendation, ignore it for now, or pick another option.
          </p>
          <div className="reversibility-actions">
            {reversibility.canUndo && (
              <button
                type="button"
                className="reversibility-btn"
                onClick={onUndoRecommendation}
              >
                {reversibility.undoLabel}
              </button>
            )}
            {reversibility.canIgnore && (
              <button
                type="button"
                className="reversibility-btn"
                onClick={onIgnoreRecommendation}
              >
                {reversibility.ignoreLabel}
              </button>
            )}
          </div>
          {reversibility.canChooseAlternative &&
            reversibility.alternatives.length > 0 && (
              <div className="alternative-list">
                <p className="reversibility-hint">{reversibility.chooseAlternativeLabel}</p>
                <ul>
                  {reversibility.alternatives.map((alt) => (
                    <li key={alt.id}>
                      <button
                        type="button"
                        className="reversibility-btn reversibility-btn-alt"
                        onClick={() => onChooseAlternative?.(alt.id)}
                      >
                        {alt.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
        </div>
      )}

      <div className="output-block">
        <h2>Risk level</h2>
        <span className={`risk-badge ${RISK_CLASS[card.riskLevel]}`}>{card.riskLevel}</span>
      </div>

      {card.unresolvedQuestions.length > 0 && (
        <div className="output-block">
          <h2>Unresolved questions</h2>
          <ul>
            {card.unresolvedQuestions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </div>
      )}

      {card.whatCanWait.length > 0 && (
        <div
          className={`output-block${card.containmentMode ? " containment-what-can-wait" : ""}`}
          data-emphasize-wait={card.containmentMode ? "true" : undefined}
        >
          <h2>{card.containmentMode || card.loadFirstMode ? "What can be ignored safely today" : "What can wait"}</h2>
          {card.whatCanWait.length === 1 ? (
            <p>{card.whatCanWait[0]}</p>
          ) : (
            <ul>
              {card.whatCanWait.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {card.whatNotToDoToday && card.whatNotToDoToday.length > 0 && (
        <div className="output-block what-not-to-do" data-containment="true">
          <h2>What NOT to do today</h2>
          <ul>
            {card.whatNotToDoToday.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {card.whatSolenOSNeedsNext && card.whatSolenOSNeedsNext.length > 0 && (
        <div className="output-block">
          <h2>What to clarify next</h2>
          <ul>
            {card.whatSolenOSNeedsNext.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {trustLayer?.footers && trustLayer.footers.length > 0 && (
        <footer className="trust-footers" aria-label="Audit footers">
          {trustLayer.footers.map((footer) => (
            <p key={footer.kind} className="trust-footer" data-footer-kind={footer.kind}>
              {footer.text}
            </p>
          ))}
        </footer>
      )}
    </article>
  );
}
