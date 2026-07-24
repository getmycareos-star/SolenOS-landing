import type { FactualReflection, ResolvedItemRecord } from "../types";

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Plain factual weekly record — evidence, not reassurance.
 */
export function generateFactualReflection(
  resolved: ResolvedItemRecord[],
  now = new Date(),
): FactualReflection {
  const weekStart = startOfWeek(now);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const inWeek = resolved.filter((r) => {
    const t = new Date(r.resolved_at).getTime();
    return t >= weekStart.getTime() && t < weekEnd.getTime();
  });

  const lines: string[] = [];
  if (inWeek.length === 0) {
    lines.push("This week: no items marked resolved in the record.");
  } else {
    lines.push(`This week: ${inWeek.length} item${inWeek.length === 1 ? "" : "s"} marked resolved.`);
    for (const item of inWeek.slice(-12)) {
      const who = item.subject === "caregiver" ? "Caregiver" : "Care recipient";
      lines.push(`${who}: ${item.description} (${item.resolved_at.slice(0, 10)}).`);
    }
  }

  return {
    period: "weekly",
    period_start: weekStart.toISOString(),
    period_end: weekEnd.toISOString(),
    lines,
    generated_at: now.toISOString(),
  };
}
