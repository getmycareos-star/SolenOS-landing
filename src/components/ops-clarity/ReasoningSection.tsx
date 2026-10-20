"use client";

import type { MvpReasoningContext } from "@/lib/mvp-workspace";

type Props = {
  reasoning: MvpReasoningContext;
};

export function ReasoningSection({ reasoning }: Props) {
  const { humanTrust, deterministicPriority, caregiverLoadEngine, loadInterpretation } =
    reasoning;

  const hasTrust =
    humanTrust &&
    (humanTrust.whyThisWasChosen ||
      humanTrust.whatWasIgnored.length > 0 ||
      humanTrust.riskIfIgnored ||
      humanTrust.burdenSummary ||
      humanTrust.confidenceExplanation);

  const topScores = deterministicPriority?.scores?.slice(0, 3) ?? [];
  const hasPriority = topScores.length > 0;
  const hasLoad =
    caregiverLoadEngine &&
    (caregiverLoadEngine.burdenSummary ||
      caregiverLoadEngine.primaryContributors.length > 0 ||
      caregiverLoadEngine.cognitiveLoadScore > 0);

  const hasLoadInterpretation =
    loadInterpretation &&
    (loadInterpretation.burdenSummary ||
      (loadInterpretation.primaryContributors?.length ?? 0) > 0);

  if (!hasTrust && !hasPriority && !hasLoad && !hasLoadInterpretation) {
    return null;
  }

  return (
    <section className="clarity-section reasoning-section" aria-label="Why this was concluded">
      <h2 className="section-kicker">Why this was concluded</h2>

      {hasTrust && humanTrust && (
        <div className="reasoning-block">
          {humanTrust.whyThisWasChosen && (
            <p>
              <span className="reasoning-label">Why this focus</span>
              {humanTrust.whyThisWasChosen}
            </p>
          )}
          {humanTrust.whatWasIgnored.length > 0 && (
            <div>
              <span className="reasoning-label">Deprioritized for now</span>
              <ul className="reasoning-list">
                {humanTrust.whatWasIgnored.map((item) => (
                  <li key={item.slice(0, 48)}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          {humanTrust.riskIfIgnored && (
            <p>
              <span className="reasoning-label">If ignored</span>
              {humanTrust.riskIfIgnored}
            </p>
          )}
          {humanTrust.burdenSummary && (
            <p>
              <span className="reasoning-label">Your load</span>
              {humanTrust.burdenSummary}
            </p>
          )}
          {humanTrust.confidenceExplanation && (
            <p>
              <span className="reasoning-label">Confidence</span>
              {humanTrust.confidenceExplanation}
            </p>
          )}
        </div>
      )}

      {hasPriority && (
        <div className="reasoning-block">
          <span className="reasoning-label">Priority scoring</span>
          <ul className="reasoning-scores">
            {topScores.map((item) => (
              <li key={item.id}>
                <strong>{item.title}</strong>
                <span className="score-chip">score {item.priorityScore}</span>
                {item.explanation?.whyHere && (
                  <span className="score-why">{item.explanation.whyHere}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasLoad && caregiverLoadEngine && (
        <div className="reasoning-block">
          <span className="reasoning-label">Attention &amp; burden</span>
          <ul className="reasoning-metrics">
            <li>Cognitive load: {caregiverLoadEngine.cognitiveLoadScore}</li>
            <li>Emotional load: {caregiverLoadEngine.emotionalLoadScore}</li>
            <li>Burnout trend: {caregiverLoadEngine.burnoutTrend}</li>
          </ul>
          {caregiverLoadEngine.burdenSummary && <p>{caregiverLoadEngine.burdenSummary}</p>}
          {caregiverLoadEngine.primaryContributors.length > 0 && (
            <ul className="reasoning-list">
              {caregiverLoadEngine.primaryContributors.map((c) => (
                <li key={c.slice(0, 48)}>{c}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {hasLoadInterpretation && loadInterpretation && (
        <div className="reasoning-block">
          {loadInterpretation.burdenSummary && (
            <p>
              <span className="reasoning-label">Load read</span>
              {loadInterpretation.burdenSummary}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
