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

  return {
    whatChanged,
    whatMattersNow,
    whatCanWait,
    whatRemainsUncertain,
    whatShouldHappenNext: context.prioritizedActions,
  };
}

export function formatContinuityAssessment(
  assessment: ContinuityAssessment,
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
        (a) => `[${a.urgency}] ${a.action} — ${a.reason}`,
      ),
    ),
  ].join("\n");
}
