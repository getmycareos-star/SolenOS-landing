import type { CareContext, ContinuityAssessment } from "./types";
import { computeDiff } from "./engines/diff-engine";
import { assessStateOfCare } from "./engines/state-of-care-engine";

/**
 * Answer the five continuity questions from longitudinal CareContext.
 * Integrates Diff Engine and State of Care — not isolated prompt responses.
 */
export function assessContinuity(context: CareContext): ContinuityAssessment {
  const diff = computeDiff(context);
  const stateOfCare = assessStateOfCare(context);

  const whatChanged = [
    diff.headline,
    ...diff.summary,
  ];

  const whatMattersNow: string[] = [];
  const whatCanWait: string[] = [];

  for (const action of context.prioritizedActions) {
    if (action.urgency === "now" || action.urgency === "soon") {
      whatMattersNow.push(`${action.action} — ${action.reason}`);
    } else {
      whatCanWait.push(`${action.action} — ${action.reason}`);
    }
  }

  if (whatMattersNow.length === 0 && diff.changes.length > 0) {
    whatMattersNow.push(
      `Review recent changes (${stateOfCare.trajectory}) before making new decisions.`,
    );
  }

  if (whatCanWait.length === 0) {
    whatCanWait.push(
      "Routine documentation and timeline updates can continue as notes arrive.",
    );
  }

  const whatRemainsUncertain = [...context.uncertainties];

  if (whatRemainsUncertain.length === 0 && context.timeline.length > 0) {
    whatRemainsUncertain.push(
      "Complete care history may still be incomplete — additional observations will refine understanding.",
    );
  }

  // Add decision-specific considerations to what matters now
  const decisionMattersNow = assessDecisionMattersNow(context);
  whatMattersNow.push(...decisionMattersNow);

  // Add decision-specific considerations to what can wait
  const decisionCanWait = assessDecisionCanWait(context);
  whatCanWait.push(...decisionCanWait);

  return {
    whatChanged,
    whatMattersNow,
    whatCanWait,
    whatRemainsUncertain,
    whatShouldHappenNext: context.prioritizedActions,
  };
}

/**
 * Assess what decision-related matters need immediate attention.
 */
function assessDecisionMattersNow(context: CareContext): string[] {
  const mattersNow: string[] = [];
  
  if (!context.decisions || context.decisions.length === 0) {
    return mattersNow;
  }
  
  // Find current decisions that need review
  const currentDecisions = context.decisions.filter(
    d => d.status === "CURRENT"
  );
  
  // Check for decisions with pending outcomes that should have been observed by now
  const pendingOutcomeDecisions = currentDecisions.filter(
    d => d.actual_outcome === null && d.expected_outcome !== null && d.follow_up_date !== null
  );
  
  for (const decision of pendingOutcomeDecisions) {
    mattersNow.push(
      `Decision "${decision.decision}" has an expected outcome that should be reviewable now.`
    );
  }
  
  // Check for decisions with planned follow-up that is due
  const dueFollowUpDecisions = currentDecisions.filter(
    d => d.follow_up !== null && d.follow_up_date !== null
  );
  
  for (const decision of dueFollowUpDecisions) {
    mattersNow.push(
      `Decision "${decision.decision}" has a planned follow-up that is due.`
    );
  }
  
  // Check for decisions that were recently superseded
  const recentlySuperseded = context.decisions.filter(
    d => d.status === "SUPERSEDED" && d.superseded_by !== null
  );
  
  if (recentlySuperseded.length > 0) {
    mattersNow.push(
      `${recentlySuperseded.length} decision(s) have been recently superseded — review the care plan evolution.`
    );
  }
  
  return mattersNow;
}

/**
 * Assess what decision-related matters can wait for later attention.
 */
function assessDecisionCanWait(context: CareContext): string[] {
  const canWait: string[] = [];
  
  if (!context.decisions || context.decisions.length === 0) {
    return canWait;
  }
  
  // Add general decision tracking matters
  canWait.push(
    "Monitor decision outcomes and update care plan as new information becomes available."
  );
  
  // Check for historical decisions that provide context
  const historicalDecisions = context.decisions.filter(
    d => d.status === "HISTORICAL"
  );
  
  if (historicalDecisions.length > 0) {
    canWait.push(
      `${historicalDecisions.length} historical decision(s) provide context for current care approach.`
    );
  }
  
  return canWait;
}

export function formatContinuityAssessment(
  assessment: ContinuityAssessment
): string {
  const section = (title: string, items: string[]) => {
    const body =
      items.length === 0
        ? "None identified from available context."
        : items.map((i) => `- ${i}`).join("\n");
    return `${title}\n${body}`;
  };

  return [
    "STATE OF CARE (Continuity Assessment)",
    "",
    section("What changed?", assessment.whatChanged),
    "",
    section("What matters now?", assessment.whatMattersNow),
    "",
    section("What can wait?", assessment.whatCanWait),
    "",
    section("What remains uncertain?", assessment.whatRemainsUncertain),
    "",
    section(
      "What should happen next?",
      assessment.whatShouldHappenNext.map(
        (a) => `[${a.urgency}] ${a.action} — ${a.reason}`
      ),
    ),
  ].join("\n");
}