import type { CareContext, ClarificationRequest } from "../types";
import { timelineGaps } from "./timeline-engine";

/**
 * Clarification Engine — questions exist only to reduce uncertainty
 * that blocks a meaningful recommendation. Never collect data for its own sake.
 */
export function deriveClarifications(
  context: CareContext,
): ClarificationRequest[] {
  const clarifications: ClarificationRequest[] = [];

  if (context.timeline.length < 3) {
    clarifications.push({
      question: "Can you describe what has happened in the past week?",
      reducesUncertainty:
        "Insufficient timeline depth to assess progression or changes.",
      enables: "State of Care and Diff Engine assessments",
      priority: "blocking",
    });
  }

  const gaps = timelineGaps(context.timeline);
  if (gaps.length > 0) {
    clarifications.push({
      question: "Were there any notable events during gaps in what we currently understand?",
      reducesUncertainty: gaps[0],
      enables: "Accurate timeline reconstruction and change detection",
      priority: "helpful",
    });
  }

  const hasNightEvents = context.timeline.some((e) =>
    /\b(night|overnight|evening|wander(?:ing)?)\b/i.test(e.description),
  );
  const hasSupervisionQuestion = context.uncertainties.some((u) =>
    u.includes("Care level threshold"),
  );
  if (hasSupervisionQuestion && !hasNightEvents) {
    clarifications.push({
      question: "Have there been any nighttime incidents or supervision concerns?",
      reducesUncertainty:
        "Supervision demand cannot be assessed without nighttime observation data.",
      enables: "Professional care threshold reasoning",
      priority: "blocking",
    });
  }

  const hasMedEvents = context.timeline.some((e) =>
    /\b(medication|med|pill|dose)\b/i.test(e.description),
  );
  if (!hasMedEvents && context.timeline.length >= 2) {
    clarifications.push({
      question: "Have there been any recent medication changes or missed doses?",
      reducesUncertainty: "Medication status unknown — affects care complexity assessment.",
      enables: "Complete care context for provider conversations",
      priority: "optional",
    });
  }

  return clarifications.sort((a, b) => {
    const order = { blocking: 0, helpful: 1, optional: 2 };
    return order[a.priority] - order[b.priority];
  });
}
