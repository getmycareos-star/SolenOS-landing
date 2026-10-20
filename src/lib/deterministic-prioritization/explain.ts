import type {
  IssueExplanation,
  InternalPriorityBucket,
  ScoredIssue,
} from "./types";

/**
 * Explanation object (INTERNAL) — REQUIRED for each issue.
 * If any of whyHere / whyNotHigher / whyNotLower is missing → throw (engine invalid).
 */

function requireNonEmpty(label: string, value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(
      `Deterministic Prioritization Engine invalid: missing explanation.${label}`,
    );
  }
  return trimmed;
}

export function buildExplanation(
  issue: ScoredIssue,
  bucket: InternalPriorityBucket,
): IssueExplanation {
  const { dimensions: d, priorityScore, prioritySignal, title } = issue;
  const short = title.length > 60 ? `${title.slice(0, 57)}…` : title;

  const whyHere = requireNonEmpty(
    "whyHere",
    prioritySignal === "HIGH_IMPACT"
      ? `"${short}" carries a human-impact safety/pain signal (HIGH_IMPACT sort privilege) with score ${priorityScore} (safety=${d.safety}, time=${d.time}). Internal class ${bucket}.`
      : `"${short}" scored ${priorityScore} from safety×3+time×2+cost×2+reversibility+relief (s=${d.safety} t=${d.time} c=${d.cost} r=${d.reversibility} rel=${d.relief}). Internal class ${bucket}.`,
  );

  const whyNotHigher = requireNonEmpty(
    "whyNotHigher",
    d.safety >= 3 && prioritySignal === "HIGH_IMPACT"
      ? "Already at top human-impact + max safety weight; cannot rank higher within this formula."
      : d.safety < 3
        ? `Safety dimension is ${d.safety}/3 — elevating would require a clearer immediate-harm signal (user remains final decision maker; SolenOS only highlights risk signals).`
        : `Time/cost caps keep this below absolute max (${priorityScore}/27); competing issues may share or exceed this score.`,
  );

  const whyNotLower = requireNonEmpty(
    "whyNotLower",
    prioritySignal === "HIGH_IMPACT"
      ? "Human-impact override prevents demotion below non-impact items even if some dimensions are moderate."
      : d.safety >= 2 || d.time >= 2
        ? "Safety/time weights would make a lower rank inconsistent with observed risk or urgency language."
        : "Score already reflects low-urgency heuristics; further demotion would erase remaining practical relevance.",
  );

  return { whyHere, whyNotHigher, whyNotLower };
}

/** Validate explanation completeness — throws if incomplete. */
export function assertExplanationComplete(explanation: IssueExplanation): void {
  requireNonEmpty("whyHere", explanation.whyHere);
  requireNonEmpty("whyNotHigher", explanation.whyNotHigher);
  requireNonEmpty("whyNotLower", explanation.whyNotLower);
}
