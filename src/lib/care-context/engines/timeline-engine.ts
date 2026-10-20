import type { ContextCareEvent } from "../types";

/**
 * Timeline Reconstruction Engine
 * Reconstructs fragmented caregiver narratives into coherent chronological sequences.
 * Progression cannot be understood without accurate temporal ordering.
 */
export function reconstructTimeline(
  events: ContextCareEvent[],
): ContextCareEvent[] {
  return [...events].sort((a, b) => {
    if (a.date && b.date) {
      const dateCmp = a.date.localeCompare(b.date);
      if (dateCmp !== 0) return dateCmp;
    }
    if (a.date && !b.date) return -1;
    if (!a.date && b.date) return 1;
    return a.recordedAt.localeCompare(b.recordedAt);
  });
}

export function timelineGaps(events: ContextCareEvent[]): string[] {
  const dated = events.filter((e) => e.date).map((e) => e.date!);
  if (dated.length < 2) return [];

  const gaps: string[] = [];
  const sorted = [...new Set(dated)].sort();

  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(`${sorted[i - 1]}T12:00:00`);
    const curr = new Date(`${sorted[i]}T12:00:00`);
    const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > 7) {
      gaps.push(
        `No recorded events between ${sorted[i - 1]} and ${sorted[i]} (${Math.round(diffDays)} days).`,
      );
    }
  }

  return gaps;
}

export function formatTimeline(events: ContextCareEvent[]): string[] {
  return reconstructTimeline(events).map(
    (e) => `- ${e.dateLabel}: ${e.description}`,
  );
}
