import { TIMELINE_STORAGE_KEY } from "./contract-constants";
import type { TimelineEntry, TimelineEntryType, TimelineLog } from "./types";

function createEntryId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `tl_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function freezeEntry(entry: TimelineEntry): TimelineEntry {
  return Object.freeze({ ...entry });
}

export function createEmptyTimeline(): TimelineLog {
  return Object.freeze({ entries: Object.freeze([]) as readonly TimelineEntry[] });
}

export type AppendTimelineParams = {
  type: TimelineEntryType;
  summary: string;
  situationId: string;
  timestamp?: string;
};

/**
 * Append-only: returns a new TimelineLog. Never mutates prior entries.
 * No edit or delete API — immutability is enforced by frozen entries.
 */
export function appendTimelineEntry(
  log: TimelineLog,
  params: AppendTimelineParams,
): TimelineLog {
  const entry = freezeEntry({
    id: createEntryId(),
    timestamp: params.timestamp ?? new Date().toISOString(),
    type: params.type,
    summary: params.summary,
    situationId: params.situationId,
  });

  return Object.freeze({
    entries: Object.freeze([...log.entries, entry]),
  });
}

export function timelineForSituation(
  log: TimelineLog,
  situationId: string,
): readonly TimelineEntry[] {
  return log.entries.filter((e) => e.situationId === situationId);
}

export function serializeTimeline(log: TimelineLog): string {
  return JSON.stringify({ entries: log.entries });
}

export function parseTimeline(raw: string | null): TimelineLog {
  if (!raw) return createEmptyTimeline();
  try {
    const parsed = JSON.parse(raw) as { entries?: TimelineEntry[] };
    if (!Array.isArray(parsed.entries)) return createEmptyTimeline();
    return Object.freeze({
      entries: Object.freeze(parsed.entries.map(freezeEntry)),
    });
  } catch {
    return createEmptyTimeline();
  }
}

export function loadTimelineFromStorage(): TimelineLog {
  if (typeof window === "undefined") return createEmptyTimeline();
  return parseTimeline(window.localStorage.getItem(TIMELINE_STORAGE_KEY));
}

export function persistTimeline(log: TimelineLog): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TIMELINE_STORAGE_KEY, serializeTimeline(log));
}

/** Intentionally absent — timeline is append-only. */
export const TIMELINE_MUTATION_FORBIDDEN = [
  "edit",
  "update",
  "delete",
  "splice",
  "silent_removal",
] as const;
