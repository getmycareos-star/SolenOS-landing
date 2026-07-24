import type { CanonicalCareEvent } from "../situation-entry/types";
import type { CompressedTrend } from "./types";

export function compressRepetitiveEvents(events: CanonicalCareEvent[]): CompressedTrend[] {
  const groups = new Map<string, CanonicalCareEvent[]>();

  for (const event of events) {
    if (!/\b(no fall|stable|unchanged|no change)\b/i.test(event.raw_input)) continue;
    const key = "mobility_stability";
    const list = groups.get(key) ?? [];
    list.push(event);
    groups.set(key, list);
  }

  const trends: CompressedTrend[] = [];
  for (const [key, group] of groups) {
    if (group.length < 2) continue;
    trends.push({
      trend_id: `trend_${key}`,
      label: key.replace(/_/g, " "),
      event_count: group.length,
      source_event_ids: group.map((e) => e.id),
      narrative: `Mobility remained stable across ${group.length} recorded confirmations — original events preserved for audit.`,
    });
  }

  return trends;
}

export function extractPersonalHints(events: CanonicalCareEvent[]): import("./types").PersonalMemoryHint[] {
  const hints: import("./types").PersonalMemoryHint[] = [];

  for (const event of events) {
    const text = event.raw_input;
    if (/\b(calm|music|photo|familiar|home|garden|walk)\b/i.test(text)) {
      hints.push({
        hint_id: `ph_${event.id}`,
        category: "calming",
        label: text.slice(0, 80),
        confidence_pct: 55,
      });
    }
    if (/\b(routine|morning|evening|schedule)\b/i.test(text)) {
      hints.push({
        hint_id: `ph_r_${event.id}`,
        category: "routine",
        label: text.slice(0, 80),
        confidence_pct: 60,
      });
    }
  }

  return hints.slice(-5);
}
