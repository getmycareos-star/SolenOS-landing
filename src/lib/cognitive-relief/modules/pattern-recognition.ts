import type { PatternContext, TaggedEventLogEntry } from "../types";

function daysBetween(a: string, b: string): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / (1000 * 60 * 60 * 24);
}

function monthsLabel(days: number): string {
  if (days < 45) return "the last month";
  if (days < 90) return "the last 2 months";
  if (days < 180) return "the last few months";
  return "the last year";
}

/**
 * Match new tags against prior tagged_event_log — surfaces unprompted when match exists.
 */
export function computePatternContext(
  newTags: TaggedEventLogEntry[],
  log: TaggedEventLogEntry[],
  now = new Date().toISOString(),
): PatternContext | null {
  if (newTags.length === 0) return null;

  let best: {
    tag: string;
    matches: TaggedEventLogEntry[];
  } | null = null;

  for (const tag of newTags) {
    const prior = log.filter(
      (e) => e.tag === tag.tag && e.raw_entry_id !== tag.raw_entry_id,
    );
    if (prior.length === 0) continue;
    if (!best || prior.length > best.matches.length) {
      best = { tag: tag.tag, matches: prior };
    }
  }

  if (!best) {
    return {
      seen_before: false,
      frequency: 0,
      last_occurrence: null,
      note: "",
    };
  }

  const allMatches = [...best.matches].sort((a, b) => b.date.localeCompare(a.date));
  const lastOccurrence = allMatches[0]?.date ?? null;
  const frequency = allMatches.length + 1;
  const windowDays = lastOccurrence ? daysBetween(now, allMatches[allMatches.length - 1]!.date) : 60;
  const daysSince = lastOccurrence ? Math.round(daysBetween(now, lastOccurrence)) : null;

  const note =
    daysSince != null
      ? `This (${best.tag.replace(/_/g, " ")}) has happened ${frequency} times in ${monthsLabel(windowDays)}, most recently ${daysSince} day${daysSince === 1 ? "" : "s"} ago.`
      : `This (${best.tag.replace(/_/g, " ")}) has appeared before in the record.`;

  return {
    seen_before: true,
    frequency,
    last_occurrence: lastOccurrence,
    note,
  };
}
