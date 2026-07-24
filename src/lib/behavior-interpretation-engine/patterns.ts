import type { CanonicalCareEvent } from "../situation-entry/types";
import type { ConfidenceLevel, LongitudinalPattern, ObservedBehavior } from "./types";

const patternStore = new Map<string, LongitudinalPattern[]>();

function patternKey(caregiverId: string, behaviorId: string): string {
  return `${caregiverId}:${behaviorId}`;
}

export function learnLongitudinalPatterns(input: {
  caregiver_id: string;
  observed: ObservedBehavior[];
  all_events: CanonicalCareEvent[];
}): LongitudinalPattern[] {
  const patterns: LongitudinalPattern[] = [];

  for (const behavior of input.observed) {
    const priorEvents = input.all_events.filter(
      (e) => e.id !== behavior.source_event_id && e.ingestion_time < behavior.observed_at,
    );

    const occurs_after: string[] = [];
    const occurs_before: string[] = [];
    const occurs_during: string[] = [];

    const recentPrior = priorEvents.slice(-5);
    for (const prior of recentPrior) {
      if (/\b(poor\s+sleep|night\s+wander|didn'?t\s+sleep)\b/i.test(prior.raw_input)) {
        occurs_after.push("Poor sleep");
      }
      if (/\b(evening|medication|dinner)\b/i.test(prior.raw_input)) {
        occurs_before.push("Evening routine or medication time");
      }
      if (/\b(loud|visitor|noise|party)\b/i.test(prior.raw_input)) {
        occurs_during.push("Loud environment");
      }
    }

    const key = patternKey(input.caregiver_id, behavior.behavior_id);
    const existing = patternStore.get(key);
    const observation_count = (existing?.[0]?.observation_count ?? 0) + 1;

    let confidence: ConfidenceLevel = "low";
    if (observation_count >= 3) confidence = "high";
    else if (observation_count >= 2) confidence = "medium";

    const pattern: LongitudinalPattern = {
      behavior_id: behavior.behavior_id,
      label: behavior.label,
      occurs_after: [...new Set(occurs_after)],
      occurs_before: [...new Set(occurs_before)],
      occurs_during: [...new Set(occurs_during)],
      confidence,
      observation_count,
    };

    patternStore.set(key, [pattern]);
    if (occurs_after.length + occurs_before.length + occurs_during.length > 0) {
      patterns.push(pattern);
    }
  }

  return patterns;
}

export function resetBehaviorPatternStore(): void {
  patternStore.clear();
}
