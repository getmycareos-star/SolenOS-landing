import type { JourneyGraphEvent } from "../care-journey-graph/types";
import type { MemoryConfidence, MemoryTrend, ReconstructionType } from "./types";
import { formatDate } from "./temporal-aggregator";

const WORSENING = /\b(worse|declin\w*|increas\w*|more|less|stopped|unable|fell|emergency)\b/i;
const IMPROVING = /\b(better|improv\w*|increased appetite|stable|resolved|recovered)\b/i;
const FLUCTUATING = /\b(sometimes|fluctuat\w*|on and off|varies|comes and goes)\b/i;

export function detectTrend(events: JourneyGraphEvent[]): MemoryTrend {
  if (events.length === 0) return "unknown";
  if (events.length === 1) return "ongoing";

  const texts = events.map((e) => `${e.title} ${e.description}`);
  const worseningCount = texts.filter((t) => WORSENING.test(t)).length;
  const improvingCount = texts.filter((t) => IMPROVING.test(t)).length;
  const fluctuatingCount = texts.filter((t) => FLUCTUATING.test(t)).length;

  if (fluctuatingCount >= 2) return "fluctuating";
  if (worseningCount > improvingCount && worseningCount >= 2) return "worsening";
  if (improvingCount > worseningCount && improvingCount >= 2) return "improving";
  if (events.length >= 2) {
    const first = texts[0]!;
    const last = texts[texts.length - 1]!;
    if (WORSENING.test(last) && !WORSENING.test(first)) return "worsening";
    if (IMPROVING.test(last) && !IMPROVING.test(first)) return "improving";
  }

  return events.length >= 2 ? "ongoing" : "stable";
}

export function computeConfidence(
  eventCount: number,
  hasConceptMatch: boolean,
): MemoryConfidence {
  if (eventCount === 0 || !hasConceptMatch) return "insufficient_data";
  if (eventCount >= 3) return "high";
  if (eventCount >= 2) return "medium";
  return "low";
}

export function buildContinuityInsight(params: {
  conceptLabel: string;
  events: JourneyGraphEvent[];
  trend: MemoryTrend;
  reconstructionType: ReconstructionType;
  causalChain: string[];
  gaps: string[];
}): string {
  const { conceptLabel, events, trend, reconstructionType, causalChain, gaps } = params;

  if (events.length === 0) {
    return `No structured events found for ${conceptLabel} in the care journey. Additional observations may not yet be recorded.`;
  }

  const first = events[0]!;
  const last = events[events.length - 1]!;
  const parts: string[] = [];

  if (reconstructionType === "event_onset") {
    parts.push(
      `${conceptLabel} was first recorded on ${formatDate(first.timestamp)}: ${first.title}.`,
    );
  } else if (reconstructionType === "last_known_state") {
    parts.push(
      `Most recent record (${formatDate(last.timestamp)}): ${last.title}.`,
    );
  } else {
    parts.push(
      `${conceptLabel} appears across ${events.length} recorded event(s) from ${formatDate(first.timestamp)} to ${formatDate(last.timestamp)}.`,
    );
  }

  if (trend === "worsening") {
    parts.push("Pattern suggests ongoing worsening across the recorded timeline.");
  } else if (trend === "improving") {
    parts.push("Pattern suggests improvement over the recorded period.");
  } else if (trend === "fluctuating") {
    parts.push("Pattern appears fluctuating — not consistently improving or worsening.");
  } else if (trend === "ongoing") {
    parts.push("Concern remains active across multiple recorded observations.");
  }

  if (causalChain.length > 0) {
    parts.push(`Possible continuity chain: ${causalChain[0]}.`);
  }

  if (gaps.length > 0) {
    parts.push(gaps[0]!);
  }

  return parts.join(" ");
}

export function buildTimelineSummary(events: JourneyGraphEvent[]): string[] {
  return events.map((e) => `${formatDate(e.timestamp)}: ${e.title}`);
}

export function buildReconstructedMemory(params: {
  events: JourneyGraphEvent[];
  conceptLabel: string;
  trend: MemoryTrend;
  reconstructionType: ReconstructionType;
}): import("./types").ReconstructedMemoryEntry[] {
  const { events, conceptLabel, trend, reconstructionType } = params;
  if (events.length === 0) return [];

  const entries: import("./types").ReconstructedMemoryEntry[] = [];

  if (reconstructionType === "event_onset") {
    const first = events[0]!;
    entries.push({
      event: `${conceptLabel} first recorded`,
      timestamp: first.timestamp.slice(0, 10),
      supporting_events: [first.id],
      trend,
    });
    if (events.length > 1) {
      const related = events.slice(1, 4);
      entries.push({
        event: `Subsequent ${conceptLabel.toLowerCase()} observations`,
        timestamp: related[related.length - 1]!.timestamp.slice(0, 10),
        supporting_events: related.map((e) => e.id),
        trend,
      });
    }
    return entries;
  }

  if (reconstructionType === "last_known_state") {
    const last = events[events.length - 1]!;
    entries.push({
      event: `Most recent ${conceptLabel.toLowerCase()} status`,
      timestamp: last.timestamp.slice(0, 10),
      supporting_events: [last.id, ...last.related_event_ids.slice(0, 2)],
      trend,
    });
    return entries;
  }

  if (reconstructionType === "causality" && events.length >= 2) {
    for (let i = 0; i < Math.min(events.length - 1, 3); i++) {
      const from = events[i]!;
      const to = events[i + 1]!;
      entries.push({
        event: `${from.title} → ${to.title}`,
        timestamp: to.timestamp.slice(0, 10),
        supporting_events: [from.id, to.id],
        trend,
      });
    }
    return entries;
  }

  const chunkSize = Math.max(1, Math.ceil(events.length / 3));
  for (let i = 0; i < events.length; i += chunkSize) {
    const chunk = events.slice(i, i + chunkSize);
    const label =
      i === 0
        ? `${conceptLabel} early trajectory`
        : i + chunkSize >= events.length
          ? `${conceptLabel} recent trajectory`
          : `${conceptLabel} mid-period observations`;
    entries.push({
      event: label,
      timestamp: chunk[chunk.length - 1]!.timestamp.slice(0, 10),
      supporting_events: chunk.map((e) => e.id),
      trend,
    });
  }

  return entries;
}
