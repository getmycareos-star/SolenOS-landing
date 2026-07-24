import type { CareContext } from "./types";
import type { ProactiveSurfaceItem, ProactiveSurfacePlan } from "./failure-model-types";
import { IDEAL_EXPERIENCE } from "./failure-model-types";
import { buildOpeningSurface } from "./opening-surface";
import { computeDiff } from "./engines/diff-engine";
import { assessStateOfCare } from "./engines/state-of-care-engine";
import { assessCaregiverLoad } from "./engines/caregiver-load-engine";
import { assessContinuity } from "./continuity-engine";
import { detectPatterns } from "./engines/pattern-learning-engine";
import { formatTimeline, timelineGaps } from "./engines/timeline-engine";

/**
 * Determine what SolenOS should surface proactively so caregivers
 * don't need to ask common continuity questions.
 */
export function planProactiveSurface(context: CareContext): ProactiveSurfacePlan {
  const items: ProactiveSurfaceItem[] = [];

  const diff = computeDiff(context);
  if (diff.changes.length > 0) {
    items.push({
      preventsQuestion: "What changed? / Is this getting worse?",
      engine: "diff_engine",
      output: diff.headline,
      evidence: diff.changes.flatMap((c) => c.evidence).slice(0, 5),
    });
  }

  const state = assessStateOfCare(context);
  if (state.trajectory !== "insufficient_data") {
    items.push({
      preventsQuestion: "Is this getting worse? / Should I worry?",
      engine: "state_of_care",
      output: `${state.trajectory}: ${state.summary}`,
      evidence: state.evidenceFor,
    });
  }

  const load = assessCaregiverLoad(context);
  if (load.level === "high" || load.level === "critical") {
    items.push({
      preventsQuestion: "Should I hire professional help? / Am I doing enough?",
      engine: "caregiver_load_engine",
      output: `Caregiver load is ${load.level} — ${load.factors.map((f) => f.factor).join("; ")}`,
      evidence: load.factors.flatMap((f) => f.evidence).slice(0, 4),
    });
  }

  const continuity = assessContinuity(context);
  if (continuity.whatShouldHappenNext.length > 0) {
    items.push({
      preventsQuestion: "What should I do next? / What can wait?",
      engine: "prioritization_engine",
      output: continuity.whatMattersNow.join(" | ") || "See prioritized actions",
      evidence: continuity.whatShouldHappenNext.map((a) => a.reason),
    });
  }

  const patterns = detectPatterns(context);
  for (const p of patterns.slice(0, 2)) {
    items.push({
      preventsQuestion: "Is this normal? / Should I worry?",
      engine: "pattern_learning_engine",
      output: `${p.pattern} (${p.occurrences}x)`,
      evidence: p.relatedEvents.slice(0, 3),
    });
  }

  if (context.timeline.length >= +2) {
    items.push({
      preventsQuestion: "What do I tell the doctor?",
      engine: "clinical_summary_generator",
      output: "Structured care timeline available for export",
      evidence: formatTimeline(context.timeline).slice(0, 4),
    });
  }

  const gaps = timelineGaps(context.timeline);
  if (gaps.length === 0 && context.timeline.length >= 3) {
    items.push({
      preventsQuestion: "Am I forgetting something?",
      engine: "care_context",
      output: `${context.timeline.length} care events maintained in CareContext`,
      evidence: context.timeline.slice(-3).map((e) => e.description),
    });
  }

  return {
    items,
    idealExperience: IDEAL_EXPERIENCE,
    openingSurface: buildOpeningSurface(context),
  };
}

export function formatProactiveSurfacePlan(plan: ProactiveSurfacePlan): string {
  const lines = [
    "PROACTIVE SURFACE PLAN",
    "",
    `Ideal: "${plan.idealExperience}"`,
    "",
  ];

  if (plan.items.length === 0) {
    lines.push("Insufficient CareContext — capture observations to enable proactive surfacing.");
    return lines.join("\n");
  }

  for (const item of plan.items) {
    lines.push(`Prevents: "${item.preventsQuestion}"`);
    lines.push(`Engine: ${item.engine}`);
    lines.push(`Surface: ${item.output}`);
    if (item.evidence.length > 0) {
      lines.push(`Evidence: ${item.evidence.slice(0, 2).join("; ")}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
