import type { CareContext } from "./types";
import type { SuccessMetricsSnapshot } from "./failure-model-types";
import { timelineGaps } from "./engines/timeline-engine";
import { planProactiveSurface } from "./proactive-surface";

/** Tracks question text to detect repeated asks — symptom of unresolved continuity. */
export interface QuestionHistory {
  questions: { text: string; askedAt: string }[];
}

/**
 * Inverse product metrics — success is reduction, not engagement.
 * Do NOT optimize for conversations, AI responses, or session length.
 */
export function assessSuccessMetrics(
  context: CareContext,
  history: QuestionHistory = { questions: [] },
): SuccessMetricsSnapshot {
  const now = new Date().toISOString();

  const normalized = history.questions.map((q) =>
    q.text.toLowerCase().replace(/[^\w\s]/g, "").trim(),
  );
  const unique = new Set(normalized);
  const repeatedQuestionCount = normalized.length - unique.size;

  const openUncertaintyCount = context.uncertainties.length;
  const timelineGapCount = timelineGaps(context.timeline).length;

  const proactive = planProactiveSurface(context);
  const commonQuestions = 6; // archetypes from failure model
  const proactiveCoveragePercent = Math.min(
    Math.round((proactive.items.length / commonQuestions) * 100),
    100,
  );

  let reconstructionBurden: SuccessMetricsSnapshot["reconstructionBurden"];
  if (
    context.timeline.length < 3 ||
    openUncertaintyCount >= 3 ||
    timelineGapCount >= 2
  ) {
    reconstructionBurden = "high";
  } else if (context.timeline.length < 8 || openUncertaintyCount >= 1) {
    reconstructionBurden = "moderate";
  } else {
    reconstructionBurden = "low";
  }

  return {
    repeatedQuestionCount,
    openUncertaintyCount,
    timelineGapCount,
    proactiveCoveragePercent,
    reconstructionBurden,
    assessedAt: now,
  };
}

export function formatSuccessMetrics(m: SuccessMetricsSnapshot): string {
  return [
    "SUCCESS METRICS (inverse — lower/re higher is better)",
    "",
    `Repeated questions: ${m.repeatedQuestionCount} (lower is better)`,
    `Open uncertainties: ${m.openUncertaintyCount} (lower is better)`,
    `Timeline gaps: ${m.timelineGapCount} (lower is better)`,
    `Proactive coverage: ${m.proactiveCoveragePercent}% (higher is better)`,
    `Reconstruction burden: ${m.reconstructionBurden} (lower is better)`,
    "",
    "Do NOT optimize for: conversations, AI responses, session length.",
  ].join("\n");
}
