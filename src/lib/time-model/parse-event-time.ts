import type { EventTime, ParseEventTimeResult } from "./types";

const YESTERDAY = /\byesterday\b/i;
const TODAY = /\btoday\b/i;
const LAST_WEEK = /\b(last week|past week)\b/i;
const SOMETIME = /\b(sometime|around|approximately|about)\b/i;
const DAYS_AGO = /\b(\d+)\s+days?\s+ago\b/i;
const MONTH_DAY = /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:,?\s*(\d{4}))?\b/i;
const ISO_DATE = /\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/;
const WEEKDAY = /\b(on\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;

function isoDate(y: number, m: number, d: number): string {
  return new Date(Date.UTC(y, m - 1, d)).toISOString();
}

function weekRangeFromNow(reference: Date): { start: string; end: string } {
  const end = new Date(reference);
  end.setUTCHours(23, 59, 59, 999);
  const start = new Date(reference);
  start.setUTCDate(start.getUTCDate() - 7);
  start.setUTCHours(0, 0, 0, 0);
  return { start: start.toISOString(), end: end.toISOString() };
}

function daysAgoDate(days: number, reference: Date): string {
  const d = new Date(reference);
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(12, 0, 0, 0);
  return d.toISOString();
}

/** Parse real-world time references from natural language text. */
export function parseEventTimeFromText(
  text: string,
  ingestionTime: string = new Date().toISOString(),
): ParseEventTimeResult {
  const ref = new Date(ingestionTime);

  const daysAgo = text.match(DAYS_AGO);
  if (daysAgo) {
    const n = Number(daysAgo[1]);
    const start = daysAgoDate(n, ref);
    return {
      event_time: { type: "exact", start, confidence: 0.85 },
      clarification_question: null,
    };
  }

  if (YESTERDAY.test(text)) {
    const start = daysAgoDate(1, ref);
    return {
      event_time: { type: "exact", start, confidence: 0.9 },
      clarification_question: null,
    };
  }

  if (TODAY.test(text)) {
    const start = new Date(ref);
    start.setUTCHours(12, 0, 0, 0);
    return {
      event_time: { type: "exact", start: start.toISOString(), confidence: 0.95 },
      clarification_question: null,
    };
  }

  if (LAST_WEEK.test(text) || (SOMETIME.test(text) && LAST_WEEK.test(text))) {
    const range = weekRangeFromNow(ref);
    return {
      event_time: { type: "range", start: range.start, end: range.end, confidence: 0.5 },
      clarification_question: "Can you narrow down when this happened last week?",
    };
  }

  const monthDay = text.match(MONTH_DAY);
  if (monthDay) {
    const monthNames = [
      "january", "february", "march", "april", "may", "june",
      "july", "august", "september", "october", "november", "december",
    ];
    const month = monthNames.indexOf(monthDay[1]!.toLowerCase());
    const day = Number(monthDay[2]);
    const year = monthDay[3] ? Number(monthDay[3]) : ref.getUTCFullYear();
    const start = isoDate(year, month + 1, day);
    return {
      event_time: {
        type: monthDay[3] ? "exact" : "approximate",
        start,
        confidence: monthDay[3] ? 0.9 : 0.7,
      },
      clarification_question: monthDay[3] ? null : "Which year did this occur?",
    };
  }

  const isoMatch = text.match(ISO_DATE);
  if (isoMatch) {
    let y = Number(isoMatch[3]);
    if (y < 100) y += 2000;
    const start = isoDate(y, Number(isoMatch[1]), Number(isoMatch[2]));
    return {
      event_time: { type: "exact", start, confidence: 0.88 },
      clarification_question: null,
    };
  }

  if (WEEKDAY.test(text) && SOMETIME.test(text)) {
    return {
      event_time: { type: "approximate", start: ref.toISOString(), confidence: 0.45 },
      clarification_question: "Which day exactly did this happen?",
    };
  }

  if (SOMETIME.test(text) || LAST_WEEK.test(text)) {
    const range = weekRangeFromNow(ref);
    return {
      event_time: { type: "range", start: range.start, end: range.end, confidence: 0.5 },
      clarification_question: "When did this happen?",
    };
  }

  if (/\b(recently|a few days ago|earlier)\b/i.test(text)) {
    const range = weekRangeFromNow(ref);
    return {
      event_time: { type: "range", start: range.start, end: range.end, confidence: 0.4 },
      clarification_question: "When did this happen?",
    };
  }

  return {
    event_time: { type: "unknown", confidence: 0 },
    clarification_question: "When did this happen?",
  };
}

export function createExactEventTime(iso: string, confidence = 1): EventTime {
  return { type: "exact", start: iso, confidence };
}

export function createIngestionTime(iso?: string): string {
  return iso ?? new Date().toISOString();
}

/** Sort key for temporal ordering — uses start of range or ingestion fallback. */
export function temporalSortKey(eventTime: EventTime, ingestionTime: string): string {
  if (eventTime.start) return eventTime.start;
  if (eventTime.end) return eventTime.end;
  return ingestionTime;
}

export function formatEventTimeLabel(eventTime: EventTime): string {
  if (eventTime.type === "unknown") return "Time unknown";
  if (eventTime.type === "range" && eventTime.start && eventTime.end) {
    const s = new Date(eventTime.start).toLocaleDateString();
    const e = new Date(eventTime.end).toLocaleDateString();
    return `${s} – ${e} (approx.)`;
  }
  if (eventTime.start) {
    const d = new Date(eventTime.start).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    if (eventTime.type === "approximate") return `${d} (approx.)`;
    return d;
  }
  return "Time uncertain";
}
