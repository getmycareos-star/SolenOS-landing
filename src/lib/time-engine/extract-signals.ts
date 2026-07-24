import type { TimeInputSignals } from "./types";

const EXPLICIT_TIME_PATTERNS: Array<{ label: string; re: RegExp }> = [
  {
    label: "clock_time",
    re: /\b(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)|(?:0?\d|1\d|2[0-3]):[0-5]\d)\b/i,
  },
  {
    label: "iso_or_numeric_date",
    re: /\b(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b/,
  },
  {
    label: "weekday_named",
    re: /\b(on\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
  },
];

const RELATIVE_TIME_PATTERNS: Array<{ label: string; re: RegExp; roughHours?: number }> = [
  { label: "right_now", re: /\b(right now|immediately|asap|this (minute|instant))\b/i, roughHours: 0 },
  { label: "within_hours", re: /\bwithin\s+(\d+)\s*hours?\b/i },
  { label: "in_hours", re: /\bin\s+(\d+)\s*hours?\b/i },
  { label: "in_minutes", re: /\bin\s+(\d+)\s*minutes?\b/i, roughHours: 0.5 },
  { label: "today", re: /\b(today|tonight|this (morning|afternoon|evening))\b/i, roughHours: 8 },
  { label: "tomorrow", re: /\b(tomorrow|tmrw)\b/i, roughHours: 24 },
  { label: "in_days", re: /\bin\s+(\d+)\s*days?\b/i },
  { label: "this_week", re: /\b(this week|next few days|in a (few|couple) days)\b/i, roughHours: 48 },
  { label: "next_week", re: /\b(next week|in a week)\b/i, roughHours: 96 },
  { label: "soon", re: /\bsoon\b/i, roughHours: 36 },
  { label: "later_generic", re: /\b(later|eventually|when (I|we) can|no rush)\b/i, roughHours: 120 },
];

/** Soft cues — never treated as deadlines; only when no explicit/relative. */
const INFERRED_TIME_PATTERNS: Array<{ label: string; re: RegExp }> = [
  { label: "medication_timing_cue", re: /\b(before (bed|eating)|with food|morning dose|night dose)\b/i },
  { label: "appointment_cue", re: /\b(appointment|follow[- ]?up|scheduled)\b/i },
  { label: "meal_routine_cue", re: /\b(breakfast|lunch|dinner|meal)\b/i },
];

function firstMatch(text: string, patterns: Array<{ label: string; re: RegExp }>): string | undefined {
  for (const { label, re } of patterns) {
    const m = text.match(re);
    if (m) return `${label}:${m[0]}`;
  }
  return undefined;
}

/**
 * Extract time signals from input text.
 * Does NOT invent deadlines — missingTime stays true when nothing temporal is found.
 */
export function extractTimeInputSignals(input: string): TimeInputSignals {
  const text = input.trim();
  if (!text) {
    return { missingTime: true };
  }

  const explicitTime = firstMatch(text, EXPLICIT_TIME_PATTERNS);
  const relativeTime = firstMatch(text, RELATIVE_TIME_PATTERNS);

  let inferredTime: string | undefined;
  if (!explicitTime && !relativeTime) {
    inferredTime = firstMatch(text, INFERRED_TIME_PATTERNS);
  }

  const missingTime = !explicitTime && !relativeTime && !inferredTime;

  return {
    ...(explicitTime ? { explicitTime } : {}),
    ...(relativeTime ? { relativeTime } : {}),
    ...(inferredTime ? { inferredTime } : {}),
    missingTime,
  };
}

/** Rough hours-until from relative/explicit match text — classification aid only. */
export function estimateHoursUntil(signals: TimeInputSignals): number | undefined {
  const source = signals.explicitTime ?? signals.relativeTime ?? signals.inferredTime;
  if (!source) return undefined;

  const withinHours = source.match(/within\s+(\d+)\s*hours?/i);
  if (withinHours) return Number(withinHours[1]);

  const inHours = source.match(/in\s+(\d+)\s*hours?/i);
  if (inHours) return Number(inHours[1]);

  const inMinutes = source.match(/in\s+(\d+)\s*minutes?/i);
  if (inMinutes) return Number(inMinutes[1]) / 60;

  const inDays = source.match(/in\s+(\d+)\s*days?/i);
  if (inDays) return Number(inDays[1]) * 24;

  if (/right_now|immediately|asap|this (minute|instant)/i.test(source)) return 0;
  if (/today|tonight|this (morning|afternoon|evening)/i.test(source)) return 8;
  if (/tomorrow|tmrw/i.test(source)) return 24;
  if (/this week|next few days|in a (few|couple) days|soon/i.test(source)) return 48;
  if (/next week|in a week/i.test(source)) return 96;
  if (/later|eventually|when (I|we) can|no rush/i.test(source)) return 120;
  if (/medication_timing|meal_routine|before (bed|eating)/i.test(source)) return 3;
  if (/appointment|follow/i.test(source)) return 12;

  // Explicit clock without relative → treat as TODAY window by default.
  if (/clock_time|iso_or_numeric|weekday/i.test(source)) return 10;

  return undefined;
}
