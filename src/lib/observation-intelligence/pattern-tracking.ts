import type { ObservationCategory, ObservationSignal } from "./ontology";
import type { StructuredObservationRecord } from "./stores/observation-store";

export type TrendDirection = "stable" | "increasing" | "decreasing";

export type SignalFrequencyPoint = {
  weekKey: string;
  weekStart: string;
  count: number;
};

export type SignalTrend = {
  category: ObservationCategory;
  signal: ObservationSignal;
  points: SignalFrequencyPoint[];
  direction: TrendDirection;
  changePercent?: number;
};

export type CategoryTrendSummary = {
  category: ObservationCategory;
  totalThisWeek: number;
  totalPriorWeek: number;
  direction: TrendDirection;
  label: string;
};

function weekKey(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function weekStartIso(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/**
 * Aggregate structured observations into weekly frequency buckets per signal.
 */
export function aggregateWeeklyFrequencies(
  records: StructuredObservationRecord[],
  weeksBack = 4,
  now = new Date(),
): SignalTrend[] {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - weeksBack * 7);

  const recent = records.filter((r) => r.created_at >= cutoff.toISOString());
  const bySignal = new Map<ObservationSignal, Map<string, number>>();

  for (const record of recent) {
    const key = weekKey(new Date(record.created_at));
    const bucket = bySignal.get(record.signal) ?? new Map<string, number>();
    bucket.set(key, (bucket.get(key) ?? 0) + 1);
    bySignal.set(record.signal, bucket);
  }

  const trends: SignalTrend[] = [];

  for (const [signal, buckets] of bySignal) {
    const sortedKeys = [...buckets.keys()].sort();
    const points: SignalFrequencyPoint[] = sortedKeys.map((wk) => ({
      weekKey: wk,
      weekStart: new Date(wk).toISOString(),
      count: buckets.get(wk) ?? 0,
    }));

    const direction = detectTrendDirection(points);
    const changePercent = computeChangePercent(points);

    trends.push({
      category: records.find((r) => r.signal === signal)!.category,
      signal,
      points,
      direction,
      changePercent,
    });
  }

  return trends.sort((a, b) => {
    const aLast = a.points[a.points.length - 1]?.count ?? 0;
    const bLast = b.points[b.points.length - 1]?.count ?? 0;
    return bLast - aLast;
  });
}

export function detectTrendDirection(points: SignalFrequencyPoint[]): TrendDirection {
  if (points.length < 2) return "stable";

  const recent = points.slice(-2);
  const prior = recent[0]!.count;
  const current = recent[1]!.count;

  if (current > prior) return "increasing";
  if (current < prior) return "decreasing";
  return "stable";
}

function computeChangePercent(points: SignalFrequencyPoint[]): number | undefined {
  if (points.length < 2) return undefined;
  const prior = points[points.length - 2]!.count;
  const current = points[points.length - 1]!.count;
  if (prior === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - prior) / prior) * 100);
}

export function summarizeCategoryTrends(
  records: StructuredObservationRecord[],
  now = new Date(),
): CategoryTrendSummary[] {
  const thisWeek = weekStartIso(now);
  const priorWeekStart = new Date(thisWeek);
  priorWeekStart.setDate(priorWeekStart.getDate() - 7);
  const priorWeekEnd = new Date(thisWeek);

  const categories = new Set(records.map((r) => r.category));
  const summaries: CategoryTrendSummary[] = [];

  for (const category of categories) {
    const catRecords = records.filter((r) => r.category === category);
    const totalThisWeek = catRecords.filter((r) => r.created_at >= thisWeek).length;
    const totalPriorWeek = catRecords.filter(
      (r) => r.created_at >= priorWeekStart.toISOString() && r.created_at < priorWeekEnd.toISOString(),
    ).length;

    let direction: TrendDirection = "stable";
    if (totalThisWeek > totalPriorWeek) direction = "increasing";
    else if (totalThisWeek < totalPriorWeek) direction = "decreasing";

    const label = buildCategoryTrendLabel(category, direction, totalThisWeek, totalPriorWeek);
    summaries.push({ category, totalThisWeek, totalPriorWeek, direction, label });
  }

  return summaries.sort((a, b) => b.totalThisWeek - a.totalThisWeek);
}

function buildCategoryTrendLabel(
  category: ObservationCategory,
  direction: TrendDirection,
  thisWeek: number,
  priorWeek: number,
): string {
  const name = category.replace(/_/g, "-");
  if (direction === "increasing") {
    return `${name}-related behaviors are increasing (${priorWeek} → ${thisWeek} observations this week)`;
  }
  if (direction === "decreasing") {
    return `${name}-related behaviors are decreasing (${priorWeek} → ${thisWeek} observations this week)`;
  }
  return `${name}-related behaviors appear stable (${thisWeek} observations this week)`;
}

export function findIncreasingTrends(trends: SignalTrend[]): SignalTrend[] {
  return trends.filter((t) => t.direction === "increasing");
}
