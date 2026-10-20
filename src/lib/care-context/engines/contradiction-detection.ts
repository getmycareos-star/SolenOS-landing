import type { CareContext, ContextCareEvent } from "../types";

export interface Contradiction {
  eventA: string;
  eventB: string;
  description: string;
}

/**
 * Contradiction Detection — surfaces conflicting observations.
 * Eliminates failure: contradictory reports.
 */
export function detectContradictions(context: CareContext): Contradiction[] {
  const contradictions: Contradiction[] = [];
  const events = context.timeline;

  const improvement = /\b(better|improved|stable|doing well)\b/i;
  const deterioration = /\b(worse|declin|worsening|deteriorat)\b/i;

  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const a = events[i];
      const b = events[j];
      if (sameTimeWindow(a, b) && improvement.test(a.description) && deterioration.test(b.description)) {
        contradictions.push({
          eventA: a.description,
          eventB: b.description,
          description: "Conflicting trajectory signals in same time window",
        });
      }
    }
  }

  return contradictions;
}

function sameTimeWindow(a: ContextCareEvent, b: ContextCareEvent): boolean {
  if (a.date && b.date) {
    const diff = Math.abs(
      new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    return diff <= 7 * 24 * 60 * 60 * 1000;
  }
  return a.recordedAt.slice(0, 10) === b.recordedAt.slice(0, 10);
}
