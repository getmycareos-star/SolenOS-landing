import type { CareEventRecord } from "@/lib/care-events";
import {
  inferContinuousEventType,
  parseStructuredFromMetadata,
} from "./structure-input";
import type {
  CareRecordSearchResult,
  CareRecordTimelineEntry,
  ContinuousCareEventType,
  HistoricalContextMatch,
  HistoricalContextResult,
} from "./types";

function toTimelineEntry(event: CareEventRecord): CareRecordTimelineEntry {
  const eventType = inferContinuousEventType(event.content);
  const structured = parseStructuredFromMetadata(
    event.metadata,
    event.content,
    eventType,
    event.occurred_at ?? event.created_at,
  );

  return {
    id: event.id,
    event_type: structured.event_type,
    date: structured.date,
    created_at: event.created_at,
    content: event.content,
    source_type: event.source_type,
    structured,
  };
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

function scoreEvent(queryTokens: string[], event: CareRecordTimelineEntry, rawQuery: string): number {
  const haystack = [
    event.content,
    event.structured.summary,
    ...event.structured.symptoms_mentioned,
    ...event.structured.decisions_made,
    ...event.structured.people_involved,
    ...event.structured.watch_for,
    event.event_type.replace(/_/g, " "),
  ]
    .join(" ")
    .toLowerCase();

  let score = 0;
  for (const token of queryTokens) {
    if (haystack.includes(token)) score += 1;
  }

  const q = rawQuery.toLowerCase();

  // Symptom continuity — link new symptoms to prior medication/appointment records
  if (/\b(dizz|confus|fall|pain|appetite)\w*/i.test(q)) {
    if (/\b(dizz|confus|fall|pain|appetite)\w*/i.test(haystack)) score += 3;
    if (event.event_type === "medication_change" || event.event_type === "appointment") {
      score += 2;
    }
  }

  if (/\b(med|medication|pill|dose)\w*/i.test(q) && event.event_type === "medication_change") {
    score += 2;
  }

  return score;
}

export function buildTimeline(events: CareEventRecord[]): CareRecordTimelineEntry[] {
  return events
    .map(toTimelineEntry)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function searchCareRecord(
  events: CareEventRecord[],
  query: string,
  limit = 20,
): CareRecordSearchResult {
  const timeline = buildTimeline(events);
  const q = query.trim();
  if (!q) {
    return { query: q, matches: timeline.slice(0, limit), total_in_record: timeline.length };
  }

  const tokens = tokenize(q);
  const scored = timeline
    .map((entry) => ({ entry, score: scoreEvent(tokens, entry, q) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.entry.date.localeCompare(a.entry.date));

  return {
    query: q,
    matches: scored.slice(0, limit).map((x) => x.entry),
    total_in_record: timeline.length,
  };
}

function relevanceNote(entry: CareRecordTimelineEntry, query: string): string {
  if (entry.structured.decisions_made.length > 0) {
    return entry.structured.decisions_made[0]!;
  }
  if (entry.structured.watch_for.length > 0) {
    return `Watch for: ${entry.structured.watch_for.join(", ")}`;
  }
  if (entry.event_type === "medication_change") {
    return "Medication change on record — may relate to current symptoms.";
  }
  return entry.structured.summary;
}

export function retrieveHistoricalContext(
  events: CareEventRecord[],
  query: string,
  limit = 5,
): HistoricalContextResult {
  const search = searchCareRecord(events, query, limit);

  const matches: HistoricalContextMatch[] = search.matches.map((entry) => ({
    event_id: entry.id,
    event_type: entry.event_type,
    date: entry.date,
    summary: entry.structured.summary,
    relevance_note: relevanceNote(entry, query),
    structured: entry.structured,
  }));

  return {
    query: query.trim(),
    matches,
    evidence_backed: true,
  };
}

export function mapLegacyEventType(type: string): ContinuousCareEventType {
  const map: Record<string, ContinuousCareEventType> = {
    observation: "observation",
    fall: "fall",
    medication_change: "medication_change",
    symptom: "symptom",
    appointment: "appointment",
    behavior: "behavior",
    task: "task",
    unknown: "unknown",
  };
  return map[type] ?? inferContinuousEventType(type);
}
