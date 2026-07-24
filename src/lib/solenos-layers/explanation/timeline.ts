import {
  appendTimelineEntry,
  createEmptyTimeline,
  timelineForSituation,
  type TimelineEntry,
  type TimelineLog,
} from "../../ui-runtime";
import type { ExplanationTimelineEvent } from "../types";

export type WriteTimelineEventParams = {
  situationId: string;
  type: TimelineEntry["type"];
  summary: string;
  timestamp?: string;
};

/**
 * EXPLANATION — Timeline writer (WHAT happened).
 * Hard separation from Decision History (WHY).
 * Must NEVER influence decisions.
 */
export function writeExplanationTimelineEvent(
  log: TimelineLog,
  params: WriteTimelineEventParams,
): { log: TimelineLog; event: ExplanationTimelineEvent } {
  const next = appendTimelineEntry(log, {
    situationId: params.situationId,
    type: params.type,
    summary: params.summary,
    timestamp: params.timestamp,
  });
  const entry = next.entries[next.entries.length - 1]!;
  return {
    log: next,
    event: toExplanationTimelineEvent(entry),
  };
}

export function toExplanationTimelineEvent(
  entry: TimelineEntry,
): ExplanationTimelineEvent {
  return {
    id: entry.id,
    situationId: entry.situationId,
    type: entry.type,
    summary: entry.summary,
    timestamp: entry.timestamp,
  };
}

export { createEmptyTimeline, timelineForSituation, appendTimelineEntry };
export type { TimelineEntry, TimelineLog };
