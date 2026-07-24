import {
  aggregateWeeklyFrequencies,
  findIncreasingTrends,
  summarizeCategoryTrends,
  type CategoryTrendSummary,
  type SignalTrend,
} from "./pattern-tracking";
import type { StructuredObservationRecord } from "./stores/observation-store";
import { OBSERVATION_SIGNALS } from "./ontology";

export type WeeklySummary = {
  weekStart: string;
  observationCount: number;
  signalTrends: SignalTrend[];
  categoryTrends: CategoryTrendSummary[];
  increasingSignals: SignalTrend[];
  /** Recurring signals (≥2 times this week). */
  recurringSignals: { signal: string; count: number }[];
  /** Mood-category incident count this week. */
  emotionalIncidents: number;
  /** Memory-category incident count this week. */
  memoryIncidents: number;
  /** Human-readable change notes vs prior week. */
  changes: string[];
  headline: string;
  trendSnippets: string[];
};

function currentWeekStart(now = new Date()): string {
  const d = new Date(now);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function weekBounds(now: Date): { thisWeekStart: Date; priorWeekStart: Date } {
  const thisWeekStart = new Date(currentWeekStart(now));
  const priorWeekStart = new Date(thisWeekStart);
  priorWeekStart.setDate(priorWeekStart.getDate() - 7);
  return { thisWeekStart, priorWeekStart };
}

/**
 * Weekly pattern summary — frequency trends only, never diagnosis.
 */
export function generateWeeklySummary(
  records: StructuredObservationRecord[],
  weeksBack = 4,
  now = new Date(),
): WeeklySummary {
  const weekStart = currentWeekStart(now);
  const { thisWeekStart, priorWeekStart } = weekBounds(now);

  const thisWeekRecords = records.filter((r) => r.created_at >= thisWeekStart.toISOString());
  const priorWeekRecords = records.filter(
    (r) =>
      r.created_at >= priorWeekStart.toISOString() &&
      r.created_at < thisWeekStart.toISOString(),
  );

  const observationCount = new Set(thisWeekRecords.map((r) => r.observation_id)).size;

  const signalTrends = aggregateWeeklyFrequencies(records, weeksBack, now);
  const categoryTrends = summarizeCategoryTrends(records, now);
  const increasingSignals = findIncreasingTrends(signalTrends);

  const recurringSignals = countRecurring(thisWeekRecords);
  const emotionalIncidents = thisWeekRecords.filter((r) => r.category === "mood").length;
  const memoryIncidents = thisWeekRecords.filter((r) => r.category === "memory").length;
  const changes = buildChanges(thisWeekRecords, priorWeekRecords, categoryTrends);

  const trendSnippets = buildTrendSnippets(
    increasingSignals,
    categoryTrends,
    emotionalIncidents,
    memoryIncidents,
  );
  const headline = buildHeadline(
    observationCount,
    increasingSignals,
    categoryTrends,
    emotionalIncidents,
    memoryIncidents,
  );

  return {
    weekStart,
    observationCount,
    signalTrends,
    categoryTrends,
    increasingSignals,
    recurringSignals,
    emotionalIncidents,
    memoryIncidents,
    changes,
    headline,
    trendSnippets,
  };
}

function countRecurring(
  records: StructuredObservationRecord[],
): { signal: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const r of records) {
    counts.set(r.signal, (counts.get(r.signal) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .map(([signal, count]) => ({ signal, count }))
    .sort((a, b) => b.count - a.count);
}

function buildChanges(
  thisWeek: StructuredObservationRecord[],
  priorWeek: StructuredObservationRecord[],
  categories: CategoryTrendSummary[],
): string[] {
  const changes: string[] = [];
  const thisCount = new Set(thisWeek.map((r) => r.observation_id)).size;
  const priorCount = new Set(priorWeek.map((r) => r.observation_id)).size;

  if (priorCount === 0 && thisCount > 0) {
    changes.push(`${thisCount} observation(s) recorded this week (none prior week)`);
  } else if (thisCount > priorCount) {
    changes.push(`Observation volume up (${priorCount} → ${thisCount})`);
  } else if (thisCount < priorCount && thisCount > 0) {
    changes.push(`Observation volume down (${priorCount} → ${thisCount})`);
  }

  for (const cat of categories.filter((c) => c.direction === "increasing").slice(0, 3)) {
    changes.push(cat.label);
  }

  const moodSignals = OBSERVATION_SIGNALS.mood as readonly string[];
  const thisMood = thisWeek.filter((r) => moodSignals.includes(r.signal)).length;
  const priorMood = priorWeek.filter((r) => moodSignals.includes(r.signal)).length;
  if (thisMood > priorMood) {
    changes.push(`More emotional mood signals this week (${priorMood} → ${thisMood})`);
  }

  const thisMem = thisWeek.filter((r) => r.category === "memory").length;
  const priorMem = priorWeek.filter((r) => r.category === "memory").length;
  if (thisMem > priorMem) {
    changes.push(`More memory-related signals this week (${priorMem} → ${thisMem})`);
  }

  return changes;
}

function buildTrendSnippets(
  increasing: SignalTrend[],
  categories: CategoryTrendSummary[],
  emotionalIncidents: number,
  memoryIncidents: number,
): string[] {
  const snippets: string[] = [];

  for (const trend of increasing.slice(0, 3)) {
    const last = trend.points[trend.points.length - 1]?.count ?? 0;
    const prior = trend.points[trend.points.length - 2]?.count ?? 0;
    snippets.push(
      `increase in ${trend.signal.replace(/_/g, " ")} observed (${prior} → ${last} this week)`,
    );
  }

  for (const cat of categories.filter((c) => c.direction === "increasing").slice(0, 2)) {
    if (!snippets.some((s) => s.includes(cat.category))) {
      snippets.push(cat.label);
    }
  }

  if (emotionalIncidents > 0) {
    snippets.push(`${emotionalIncidents} emotional (mood) signal(s) this week`);
  }
  if (memoryIncidents > 0) {
    snippets.push(`${memoryIncidents} memory signal(s) this week`);
  }

  return snippets;
}

function buildHeadline(
  count: number,
  increasing: SignalTrend[],
  categories: CategoryTrendSummary[],
  emotionalIncidents: number,
  memoryIncidents: number,
): string {
  if (count === 0) {
    return "No observations recorded this week yet.";
  }

  const topIncreasing = categories.find((c) => c.direction === "increasing");
  if (topIncreasing) {
    return `${count} observation(s) this week — ${topIncreasing.category.replace(/_/g, " ")} patterns increasing`;
  }

  if (increasing.length > 0) {
    const signal = increasing[0]!.signal.replace(/_/g, " ");
    return `${count} observation(s) this week — increase in ${signal} observed`;
  }

  if (emotionalIncidents > 0 || memoryIncidents > 0) {
    return `${count} observation(s) this week — ${memoryIncidents} memory, ${emotionalIncidents} emotional signal(s)`;
  }

  return `${count} observation(s) recorded this week — patterns appear stable`;
}
