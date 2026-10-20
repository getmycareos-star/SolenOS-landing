import type { CareContext, StateOfCare } from "../types";
import { computeDiff } from "./diff-engine";

const IMPROVEMENT_SIGNALS =
  /\b(better|improved|improving|recovering|appetite returned|more active|feeling good|stable day)\b/i;
const DETERIORATION_SIGNALS =
  /\b(worse|worsening|declin(?:e|ing)|reduced appetite|less active|weaker|new symptom|fell|wander(?:ing)?)\b/i;

/**
 * State of Care — continuously answers whether the situation is
 * improving, stable, or deteriorating.
 */
export function assessStateOfCare(context: CareContext): StateOfCare {
  const now = new Date().toISOString();
  const allText = context.timeline.map((e) => e.description).join(" ");
  const diff = computeDiff(context);

  const improvementCount = context.timeline.filter((e) =>
    IMPROVEMENT_SIGNALS.test(e.description),
  ).length;
  const deteriorationCount = context.timeline.filter((e) =>
    DETERIORATION_SIGNALS.test(e.description),
  ).length;

  const evidenceFor: string[] = [];
  const evidenceAgainst: string[] = [];

  if (improvementCount > 0) {
    evidenceFor.push(
      `${improvementCount} event(s) with improvement signals in timeline`,
    );
  }
  if (deteriorationCount > 0) {
    evidenceFor.push(
      `${deteriorationCount} event(s) with deterioration signals in timeline`,
    );
  }

  for (const change of diff.changes) {
    if (
      change.category === "progression" ||
      change.category === "behavior_change" ||
      change.category === "mobility"
    ) {
      evidenceFor.push(change.description);
    }
  }

  if (context.timeline.length < 3) {
    return {
      trajectory: "insufficient_data",
      summary:
        "Not enough recorded events to assess trajectory — additional observations needed.",
      evidenceFor: [],
      evidenceAgainst: ["Timeline has fewer than 3 events"],
      assessedAt: now,
    };
  }

  let trajectory: StateOfCare["trajectory"];

  if (deteriorationCount > improvementCount && diff.changes.length > 0) {
    trajectory = "deteriorating";
    evidenceAgainst.push("Improvement signals are outweighed by deterioration indicators");
  } else if (improvementCount > deteriorationCount && diff.changes.length === 0) {
    trajectory = "improving";
    evidenceAgainst.push("No recent changes detected in diff window");
  } else if (improvementCount === deteriorationCount && diff.changes.length === 0) {
    trajectory = "stable";
  } else if (diff.changes.length > 0) {
    trajectory = "deteriorating";
  } else {
    trajectory = "stable";
  }

  const summaryMap: Record<StateOfCare["trajectory"], string> = {
    improving: "Available evidence suggests the care situation may be improving.",
    stable: "Available evidence suggests the care situation appears stable.",
    deteriorating:
      "Available evidence suggests changes consistent with deterioration or increased care needs.",
    insufficient_data: "Insufficient data to assess trajectory.",
  };

  if (IMPROVEMENT_SIGNALS.test(allText) && trajectory === "deteriorating") {
    evidenceAgainst.push(
      "Mixed signals: some improvement language present alongside deterioration indicators",
    );
  }

  return {
    trajectory,
    summary: summaryMap[trajectory],
    evidenceFor,
    evidenceAgainst,
    assessedAt: now,
  };
}
