import type { CareContext, ChangeCategory, ChangeRecord, ContextCareEvent, DiffResult } from "../types";

const CATEGORY_PATTERNS: { category: ChangeCategory; pattern: RegExp }[] = [
  { category: "behavior_change", pattern: /\b(wander(?:ing)?|agitat(?:ed|ion)?|confus(?:ed|ion)?)\b/i },
  { category: "mobility", pattern: /\b(fell|fall|mobility|walk(?:ing)?|wheelchair|unsteady)\b/i },
  { category: "nighttime_event", pattern: /\b(night|overnight|midnight|evening|sundown(?:ing)?)\b/i },
  { category: "medication", pattern: /\b(medication|med|pill|dose|prescription|insulin)\b/i },
  { category: "crisis", pattern: /\b(emergency|er\b|hospital|911|crisis|urgent)\b/i },
  { category: "caregiver_burden", pattern: /\b(exhaust(?:ed|ion)|burn(?:out|ed)|overwhelm(?:ed)?|can't cope)\b/i },
  { category: "progression", pattern: /\b(worse|worsening|declin(?:e|ing)|progress(?:ion|ing))\b/i },
  { category: "new_symptom", pattern: /\b(pain|headache|fever|nausea|appetite|symptom|ache)\b/i },
  { category: "care_level", pattern: /\b(24\s*\/\s*7|professional care|nursing|memory care|supervision)\b/i },
];

function classifyChange(description: string): ChangeCategory {
  for (const { category, pattern } of CATEGORY_PATTERNS) {
    if (pattern.test(description)) return category;
  }
  return "other";
}

function countByCategory(
  events: ContextCareEvent[],
  category: ChangeCategory,
): ContextCareEvent[] {
  return events.filter((e) => classifyChange(e.description) === category);
}

/**
 * Diff Engine — answers the caregiver's most common hidden question: "What has changed?"
 * One of the highest-value outputs in the system.
 */
export function computeDiff(
  context: CareContext,
  options: { windowDays?: number } = {},
): DiffResult {
  const windowDays = options.windowDays ?? 30;
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - windowDays);

  const recentEvents = context.timeline.filter((e) => {
    const ref = e.date ?? e.recordedAt.slice(0, 10);
    return new Date(`${ref}T12:00:00`) >= cutoff;
  });

  const olderEvents = context.timeline.filter((e) => {
    const ref = e.date ?? e.recordedAt.slice(0, 10);
    return new Date(`${ref}T12:00:00`) < cutoff;
  });

  const changes: ChangeRecord[] = [];
  const summary: string[] = [];
  const nowIso = now.toISOString();

  const categories: ChangeCategory[] = [
    "behavior_change",
    "mobility",
    "nighttime_event",
    "medication",
    "crisis",
    "caregiver_burden",
    "progression",
    "new_symptom",
    "care_level",
  ];

  for (const category of categories) {
    const recent = countByCategory(recentEvents, category);
    const older = countByCategory(olderEvents, category);

    if (recent.length > older.length) {
      const evidence = recent.map((e) => e.description);
      changes.push({
        description: `${category.replace(/_/g, " ")} activity increased (${recent.length} recent vs ${older.length} prior)`,
        detectedAt: nowIso,
        category,
        evidence,
      });
      summary.push(
        `${formatCategoryLabel(category)}: increased (${recent.length} recent event${recent.length > 1 ? "s" : ""})`,
      );
    } else if (recent.length > 0 && older.length === 0) {
      const evidence = recent.map((e) => e.description);
      changes.push({
        description: `New ${category.replace(/_/g, " ")} observed in recent period`,
        detectedAt: nowIso,
        category,
        evidence,
      });
      summary.push(`${formatCategoryLabel(category)}: newly observed`);
    }
  }

  for (const change of context.recentChanges) {
    if (!changes.some((c) => c.description === change.description)) {
      changes.push({ ...change, evidence: change.evidence ?? [change.description] });
    }
  }

  const headline =
    summary.length > 0
      ? summary[0]
      : context.timeline.length === 0
        ? "No care events recorded yet — continuity cannot be assessed."
        : "No significant changes detected in the recent window.";

  return {
    changes,
    summary,
    headline: `What changed: ${headline}`,
    computedAt: nowIso,
  };
}

function formatCategoryLabel(category: ChangeCategory): string {
  return category
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function formatDiffResult(diff: DiffResult): string {
  const lines = [diff.headline, ""];

  if (diff.summary.length === 0) {
    lines.push("No changes identified from available context.");
  } else {
    lines.push("Summary:");
    for (const s of diff.summary) lines.push(`- ${s}`);
    lines.push("");
    lines.push("Evidence:");
    for (const change of diff.changes) {
      for (const e of change.evidence.slice(0, 3)) {
        lines.push(`- ${e}`);
      }
    }
  }

  return lines.join("\n");
}
